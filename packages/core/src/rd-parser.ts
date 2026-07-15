/**
 * Recursive Descent Parser for Filtron
 * https://en.wikipedia.org/wiki/Recursive_descent_parser
 *
 * Grammar (in order of precedence, lowest to highest):
 *
 *   Query             = OrExpression
 *   OrExpression      = AndExpression (OR AndExpression)*
 *   AndExpression     = NotExpression (AND NotExpression)*
 *   NotExpression     = NOT NotExpression | PrimaryExpression
 *   PrimaryExpression = '(' OrExpression ')' | '-' FieldName | FieldExpression
 *   FieldExpression   = FieldName ('?' | EXISTS | ComparisonOp Value | OneOfOp '[' Values ']')?
 *   FieldName         = IDENT ('.' IDENT)*
 *   Value             = STRING | NUMBER | BOOLEAN | DottedIdent | Range
 *   Values            = Value (',' Value)*        (ranges are rejected)
 *   Range             = NUMBER '..' NUMBER        (only with =, : or !=)
 */

import { FiltronParseError } from "./errors";
import { Lexer, type Token, type TokenType, type StringToken, type NumberToken } from "./lexer";
import type { ParseOptions } from "./parser";
import type { ASTNode, Value, ComparisonOperator, OneOfExpression } from "./types";

/**
 * Default maximum query length in characters
 */
const DEFAULT_MAX_LENGTH = 10000;

/**
 * Default maximum combined nesting depth of parenthesized groups and NOT
 */
const DEFAULT_MAX_DEPTH = 64;

/**
 * Parser for Filtron queries
 */
class Parser {
	private lexer: Lexer;
	private current: Token;
	private nextToken: Token | null = null;
	private depth = 0;
	private readonly maxDepth: number;

	constructor(input: string, maxLength: number, maxDepth: number) {
		if (input.length > maxLength) {
			throw new FiltronParseError(`Query exceeds maximum length of ${maxLength} characters`, 0);
		}
		this.maxDepth = maxDepth;
		this.lexer = new Lexer(input);
		this.current = this.lexer.next();
	}

	/**
	 * Advance to the next token and return the previous one
	 */
	private advance(): Token {
		const prev = this.current;
		if (this.nextToken) {
			this.current = this.nextToken;
			this.nextToken = null;
		} else {
			this.current = this.lexer.next();
		}
		return prev;
	}

	/**
	 * Check if current token matches the given type
	 */
	private check(type: TokenType): boolean {
		return this.current.type === type;
	}

	/**
	 * Consume a token of the expected type, or throw an error
	 */
	private expect(type: TokenType, message?: string): Token {
		if (this.current.type !== type) {
			const msg = message ?? `Expected ${type}, got ${this.current.type}`;
			throw new FiltronParseError(msg, this.current.start);
		}
		return this.advance();
	}

	/**
	 * Parse a complete query
	 */
	parse(): ASTNode {
		if (this.check("EOF")) {
			throw new FiltronParseError("Empty query", 0);
		}

		const result = this.parseOrExpression();

		if (!this.check("EOF")) {
			throw new FiltronParseError(`Unexpected token: ${this.current.type}`, this.current.start);
		}

		return result;
	}

	/**
	 * Parse OR expression
	 * OrExpression = AndExpression (OR AndExpression)*
	 *
	 * Chains build a single flat node. An operand that is itself an OR
	 * (only possible through parentheses) is spliced in, so children never
	 * contain a direct OR child.
	 */
	private parseOrExpression(): ASTNode {
		const first = this.parseAndExpression();
		if (!this.check("OR")) {
			return first;
		}

		const children: ASTNode[] = first.type === "or" ? [...first.children] : [first];
		while (this.check("OR")) {
			this.advance();
			const operand = this.parseAndExpression();
			if (operand.type === "or") {
				children.push(...operand.children);
			} else {
				children.push(operand);
			}
		}

		return { type: "or", children };
	}

	/**
	 * Parse AND expression
	 * AndExpression = NotExpression (AND NotExpression)*
	 *
	 * Chains build a single flat node, splicing parenthesized AND operands
	 * like parseOrExpression does.
	 */
	private parseAndExpression(): ASTNode {
		const first = this.parseNotExpression();
		if (!this.check("AND")) {
			return first;
		}

		const children: ASTNode[] = first.type === "and" ? [...first.children] : [first];
		while (this.check("AND")) {
			this.advance();
			const operand = this.parseNotExpression();
			if (operand.type === "and") {
				children.push(...operand.children);
			} else {
				children.push(operand);
			}
		}

		return { type: "and", children };
	}

	/**
	 * Parse NOT expression
	 * NotExpression = NOT NotExpression | PrimaryExpression
	 */
	private parseNotExpression(): ASTNode {
		if (this.check("NOT")) {
			if (++this.depth > this.maxDepth) {
				throw new FiltronParseError(
					`Query exceeds maximum nesting depth of ${this.maxDepth}`,
					this.current.start,
				);
			}
			this.advance();
			const expression = this.parseNotExpression();
			this.depth--;
			return { type: "not", expression };
		}

		return this.parsePrimaryExpression();
	}

	/**
	 * Parse primary expression (highest precedence)
	 * PrimaryExpression = '(' OrExpression ')' | '-' FieldName | FieldExpression
	 */
	private parsePrimaryExpression(): ASTNode {
		// Field expressions dominate; check IDENT first to keep the common
		// path at a single comparison
		if (this.check("IDENT")) {
			return this.parseFieldExpression();
		}

		// Parenthesized expression
		if (this.check("LPAREN")) {
			if (++this.depth > this.maxDepth) {
				throw new FiltronParseError(
					`Query exceeds maximum nesting depth of ${this.maxDepth}`,
					this.current.start,
				);
			}
			this.advance();
			const expr = this.parseOrExpression();
			this.expect("RPAREN", "Expected closing parenthesis");
			this.depth--;
			return expr;
		}

		// Negated exists: -field
		if (this.check("MINUS")) {
			this.advance();
			const field = this.parseFieldName();
			return { type: "exists", field, negated: true };
		}

		// Not a valid primary; parseFieldExpression reports the error
		return this.parseFieldExpression();
	}

	/**
	 * Parse field expression
	 * FieldExpression = FieldName ('?' | EXISTS | ComparisonOp Value | OneOfOp '[' Values ']')?
	 */
	private parseFieldExpression(): ASTNode {
		const field = this.parseFieldName();
		const t = this.current.type;

		// Exists check with ? or EXISTS
		if (t === "QUESTION" || t === "EXISTS") {
			this.advance();
			return { type: "exists", field, negated: false };
		}

		// Membership: field : [values]
		if (t === "COLON" && this.peekNextIsLBracket()) {
			this.advance();
			return this.parseOneOfArray(field, false);
		}

		// Negated membership: field !: [values]
		if (t === "NOT_COLON") {
			this.advance();
			return this.parseOneOfArray(field, true);
		}

		// Comparison with operator
		if (
			t === "EQ" ||
			t === "NEQ" ||
			t === "GT" ||
			t === "GTE" ||
			t === "LT" ||
			t === "LTE" ||
			t === "LIKE" ||
			t === "COLON"
		) {
			const opToken = this.advance();
			const operator = this.tokenToOperator(opToken);

			const value = this.parseValue();
			if (value.type === "range" && operator !== "=" && operator !== ":" && operator !== "!=") {
				throw new FiltronParseError(
					`Range values require the =, : or != operator, got ${operator}`,
					opToken.start,
				);
			}

			return {
				type: "comparison",
				field,
				operator,
				value,
			};
		}

		// Boolean field shorthand (just the field name)
		return { type: "booleanField", field };
	}

	/**
	 * Check if the token after the current one is LBRACKET
	 * (used to distinguish : as oneOf vs : as comparison operator)
	 */
	private peekNextIsLBracket(): boolean {
		if (!this.nextToken) {
			this.nextToken = this.lexer.next();
		}
		return this.nextToken.type === "LBRACKET";
	}

	/**
	 * Convert a token to its corresponding comparison operator
	 */
	private tokenToOperator(token: Token): ComparisonOperator {
		switch (token.type) {
			case "EQ":
				return "=";
			case "NEQ":
				return "!=";
			case "GT":
				return ">";
			case "GTE":
				return ">=";
			case "LT":
				return "<";
			case "LTE":
				return "<=";
			case "LIKE":
				return "~";
			case "COLON":
				return ":";
			default:
				throw new FiltronParseError(`Invalid operator: ${token.type}`, token.start);
		}
	}

	/**
	 * Parse a field name (possibly dotted)
	 * FieldName = IDENT ('.' IDENT)*
	 */
	private parseFieldName(): string {
		const first = this.expect("IDENT", "Expected field name") as StringToken;
		let name = first.value;

		while (this.check("DOT")) {
			this.advance(); // consume .
			const next = this.expect("IDENT", "Expected identifier after '.'") as StringToken;
			name += "." + next.value;
		}

		return name;
	}

	/**
	 * Parse membership array
	 * '[' Values ']'
	 */
	private parseOneOfArray(field: string, negated: boolean): OneOfExpression {
		this.expect("LBRACKET", "Expected '[' after operator");

		const values: Value[] = [];

		// Handle non-empty array
		if (!this.check("RBRACKET")) {
			values.push(this.parseArrayValue());

			while (this.check("COMMA")) {
				this.advance(); // consume ,
				values.push(this.parseArrayValue());
			}
		}

		this.expect("RBRACKET", "Expected ']' to close array");

		if (values.length === 0) {
			throw new FiltronParseError("Array cannot be empty", this.current.start);
		}

		return { type: "oneOf", field, values, negated };
	}

	/**
	 * Parse a value
	 * Value = STRING | NUMBER | BOOLEAN | DottedIdent
	 */
	/**
	 * Parse a value inside a membership array, where ranges are not allowed
	 */
	private parseArrayValue(): Value {
		const start = this.current.start;
		const value = this.parseValue();
		if (value.type === "range") {
			throw new FiltronParseError("Range values are not allowed in arrays", start);
		}
		return value;
	}

	private parseValue(): Value {
		const t = this.current.type;

		// String literal
		if (t === "STRING") {
			const token = this.advance() as StringToken;
			return { type: "string", value: token.value };
		}

		// Number literal, or a range when followed by '..'
		if (t === "NUMBER") {
			const token = this.advance() as NumberToken;
			if (this.check("DOTDOT")) {
				this.advance();
				const maxToken = this.expect("NUMBER", "Expected number after '..'") as NumberToken;
				if (token.value > maxToken.value) {
					throw new FiltronParseError(
						`Range min (${token.value}) must not exceed max (${maxToken.value})`,
						token.start,
					);
				}
				return { type: "range", min: token.value, max: maxToken.value };
			}
			return { type: "number", value: token.value };
		}

		// Boolean literal
		if (t === "TRUE") {
			this.advance();
			return { type: "boolean", value: true };
		}
		if (t === "FALSE") {
			this.advance();
			return { type: "boolean", value: false };
		}

		// Identifier (possibly dotted)
		if (t === "IDENT") {
			const first = this.advance() as StringToken;
			let value = first.value;

			while (this.check("DOT")) {
				this.advance(); // consume .
				const next = this.expect("IDENT", "Expected identifier after '.'") as StringToken;
				value += "." + next.value;
			}

			return { type: "identifier", value };
		}

		throw new FiltronParseError(`Expected value, got ${t}`, this.current.start);
	}
}

/**
 * Parse a Filtron query string into an AST
 *
 * @param input - The query string to parse
 * @param options - Optional parse limits
 * @returns The parsed AST
 * @throws FiltronParseError if the query is invalid or exceeds a limit
 */
export function parseQuery(input: string, options?: ParseOptions): ASTNode {
	const parser = new Parser(
		input,
		options?.maxLength ?? DEFAULT_MAX_LENGTH,
		options?.maxDepth ?? DEFAULT_MAX_DEPTH,
	);
	return parser.parse();
}
