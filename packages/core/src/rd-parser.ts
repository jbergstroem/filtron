/**
 * Recursive Descent Parser for Filtron
 *
 * Grammar (in order of precedence, lowest to highest):
 *
 *   Query         = OrExpression
 *   OrExpression  = AndExpression (OR AndExpression)*
 *   AndExpression = NotExpression (AND NotExpression)*
 *   NotExpression = NOT NotExpression | PrimaryExpression
 *   PrimaryExpression = '(' OrExpression ')' | FieldExpression
 *   FieldExpression = FieldName ('?' | EXISTS | ComparisonOp Value RangeSuffix? | OneOfOp '[' Values ']')?
 *   FieldName     = IDENT ('.' IDENT)*
 *   Value         = STRING | NUMBER | BOOLEAN | DottedIdent
 *   Values        = Value (',' Value)*
 *   RangeSuffix   = '..' NUMBER
 */

import { Lexer, type Token, type TokenType } from "./lexer";
import type {
	ASTNode,
	Value,
	ComparisonOperator,
	ComparisonExpression,
	OneOfExpression,
	NotOneOfExpression,
	ExistsExpression,
	BooleanFieldExpression,
	RangeExpression,
} from "./types";

/**
 * Parser error with position information
 */
export class ParseError extends Error {
	constructor(
		message: string,
		public position: number,
	) {
		super(message);
		this.name = "ParseError";
	}
}

/**
 * Recursive descent parser for Filtron queries
 */
export class Parser {
	private lexer: Lexer;
	private current: Token;

	constructor(input: string) {
		this.lexer = new Lexer(input);
		this.current = this.lexer.next();
	}

	/**
	 * Advance to the next token and return the previous one
	 */
	private advance(): Token {
		const prev = this.current;
		this.current = this.lexer.next();
		return prev;
	}

	/**
	 * Check if current token matches the given type
	 */
	private check(type: TokenType): boolean {
		return this.current.type === type;
	}

	/**
	 * Check if current token matches any of the given types
	 */
	private checkAny(...types: TokenType[]): boolean {
		return types.includes(this.current.type);
	}

	/**
	 * Consume a token of the expected type, or throw an error
	 */
	private expect(type: TokenType, message?: string): Token {
		if (this.current.type !== type) {
			const msg = message ?? `Expected ${type}, got ${this.current.type}`;
			throw new ParseError(msg, this.current.start);
		}
		return this.advance();
	}

	/**
	 * Parse a complete query
	 */
	parse(): ASTNode {
		if (this.check("EOF")) {
			throw new ParseError("Empty query", 0);
		}

		const result = this.parseOrExpression();

		if (!this.check("EOF")) {
			throw new ParseError(`Unexpected token: ${this.current.type}`, this.current.start);
		}

		return result;
	}

	/**
	 * Parse OR expression (lowest precedence)
	 * OrExpression = AndExpression (OR AndExpression)*
	 */
	private parseOrExpression(): ASTNode {
		let left = this.parseAndExpression();

		while (this.check("OR")) {
			this.advance(); // consume OR
			const right = this.parseAndExpression();
			left = { type: "or", left, right };
		}

		return left;
	}

	/**
	 * Parse AND expression
	 * AndExpression = NotExpression (AND NotExpression)*
	 */
	private parseAndExpression(): ASTNode {
		let left = this.parseNotExpression();

		while (this.check("AND")) {
			this.advance(); // consume AND
			const right = this.parseNotExpression();
			left = { type: "and", left, right };
		}

		return left;
	}

	/**
	 * Parse NOT expression
	 * NotExpression = NOT NotExpression | PrimaryExpression
	 */
	private parseNotExpression(): ASTNode {
		if (this.check("NOT")) {
			this.advance(); // consume NOT
			const expression = this.parseNotExpression();
			return { type: "not", expression };
		}

		return this.parsePrimaryExpression();
	}

	/**
	 * Parse primary expression (highest precedence)
	 * PrimaryExpression = '(' OrExpression ')' | FieldExpression
	 */
	private parsePrimaryExpression(): ASTNode {
		// Parenthesized expression
		if (this.check("LPAREN")) {
			this.advance(); // consume (
			const expr = this.parseOrExpression();
			this.expect("RPAREN", "Expected closing parenthesis");
			return expr;
		}

		return this.parseFieldExpression();
	}

	/**
	 * Parse field expression
	 * FieldExpression = FieldName ('?' | EXISTS | ComparisonOp Value RangeSuffix? | OneOfOp '[' Values ']')?
	 */
	private parseFieldExpression(): ASTNode {
		const field = this.parseFieldName();

		// Exists check with ?
		if (this.check("QUESTION")) {
			this.advance(); // consume ?
			return { type: "exists", field } as ExistsExpression;
		}

		// Exists check with EXISTS keyword
		if (this.check("EXISTS")) {
			this.advance(); // consume EXISTS
			return { type: "exists", field } as ExistsExpression;
		}

		// OneOf: field : [values]
		if (this.check("COLON") && this.peekNextIsLBracket()) {
			this.advance(); // consume :
			return this.parseOneOfArray(field, "oneOf");
		}

		// NotOneOf: field !: [values]
		if (this.check("NOT_COLON")) {
			this.advance(); // consume !:
			return this.parseOneOfArray(field, "notOneOf");
		}

		// Comparison with operator
		if (this.isComparisonOperator()) {
			const opToken = this.advance();
			const operator = this.tokenToOperator(opToken);

			// Check for range expression: field = min..max
			if (operator === "=" && this.check("NUMBER")) {
				const minToken = this.advance();
				const min = minToken.value as number;

				if (this.check("DOTDOT")) {
					this.advance(); // consume ..
					const maxToken = this.expect("NUMBER", "Expected number after '..'");
					const max = maxToken.value as number;
					return { type: "range", field, min, max } as RangeExpression;
				}

				// Not a range, just a regular comparison with a number
				return {
					type: "comparison",
					field,
					operator,
					value: { type: "number", value: min },
				} as ComparisonExpression;
			}

			const value = this.parseValue();
			return { type: "comparison", field, operator, value } as ComparisonExpression;
		}

		// Boolean field shorthand (just the field name)
		return { type: "booleanField", field } as BooleanFieldExpression;
	}

	/**
	 * Check if the token after the current one is LBRACKET
	 * (used to distinguish : as oneOf vs : as comparison operator)
	 */
	private peekNextIsLBracket(): boolean {
		const savedPos = this.lexer["pos"];
		const savedCurrent = this.current;
		const next = this.lexer.next();
		this.lexer["pos"] = savedPos;
		this.current = savedCurrent;
		return next.type === "LBRACKET";
	}

	/**
	 * Check if current token is a comparison operator
	 */
	private isComparisonOperator(): boolean {
		return this.checkAny("EQ", "NEQ", "GT", "GTE", "LT", "LTE", "LIKE", "COLON");
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
				throw new ParseError(`Invalid operator: ${token.type}`, token.start);
		}
	}

	/**
	 * Parse a field name (possibly dotted)
	 * FieldName = IDENT ('.' IDENT)*
	 */
	private parseFieldName(): string {
		const first = this.expect("IDENT", "Expected field name");
		let name = first.value as string;

		while (this.check("DOT")) {
			this.advance(); // consume .
			const next = this.expect("IDENT", "Expected identifier after '.'");
			name += "." + next.value;
		}

		return name;
	}

	/**
	 * Parse oneOf/notOneOf array
	 * '[' Values ']'
	 */
	private parseOneOfArray(field: string, type: "oneOf" | "notOneOf"): OneOfExpression | NotOneOfExpression {
		this.expect("LBRACKET", "Expected '[' after operator");

		const values: Value[] = [];

		// Handle non-empty array
		if (!this.check("RBRACKET")) {
			values.push(this.parseValue());

			while (this.check("COMMA")) {
				this.advance(); // consume ,
				values.push(this.parseValue());
			}
		}

		this.expect("RBRACKET", "Expected ']' to close array");

		if (values.length === 0) {
			throw new ParseError("Array cannot be empty", this.current.start);
		}

		return { type, field, values };
	}

	/**
	 * Parse a value
	 * Value = STRING | NUMBER | BOOLEAN | DottedIdent
	 */
	private parseValue(): Value {
		// String literal
		if (this.check("STRING")) {
			const token = this.advance();
			return { type: "string", value: token.value as string };
		}

		// Number literal
		if (this.check("NUMBER")) {
			const token = this.advance();
			return { type: "number", value: token.value as number };
		}

		// Boolean literal
		if (this.check("TRUE")) {
			this.advance();
			return { type: "boolean", value: true };
		}
		if (this.check("FALSE")) {
			this.advance();
			return { type: "boolean", value: false };
		}

		// Identifier (possibly dotted)
		if (this.check("IDENT")) {
			const first = this.advance();
			let value = first.value as string;

			while (this.check("DOT")) {
				this.advance(); // consume .
				const next = this.expect("IDENT", "Expected identifier after '.'");
				value += "." + next.value;
			}

			return { type: "identifier", value };
		}

		throw new ParseError(`Expected value, got ${this.current.type}`, this.current.start);
	}
}

/**
 * Parse a Filtron query string into an AST
 *
 * @param input - The query string to parse
 * @returns The parsed AST
 * @throws ParseError if the query is invalid
 */
export function parseQuery(input: string): ASTNode {
	const parser = new Parser(input);
	return parser.parse();
}
