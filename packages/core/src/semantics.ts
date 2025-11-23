import type { FiltronActionDict } from "./grammar.ohm-bundle.js";
import type { ASTNode, Value } from "./types";

/**
 * Escape sequence mapping for string literals
 * Using a map lookup is faster than switch statements
 */
const ESCAPE_MAP: Record<string, string> = {
	n: "\n",
	t: "\t",
	r: "\r",
	"\\": "\\",
	'"': '"',
};

/**
 * Semantic actions for converting Ohm parse tree to Filtron AST
 */
export const semanticActions: FiltronActionDict<
	ASTNode | Value | Value[] | string
> = {
	Query(orExpr: any): ASTNode {
		return orExpr.toAST();
	},

	OrExpression(first: any, _ops: any, rest: any): ASTNode {
		let result = first.toAST();
		const children = rest.children;
		const len = children.length;

		// Build left-associative tree directly without map() + reduce()
		// This avoids creating intermediate arrays and reduces allocations
		for (let i = 0; i < len; i++) {
			result = {
				type: "or",
				left: result,
				right: children[i].toAST(),
			};
		}

		return result;
	},

	AndExpression(first: any, _ops: any, rest: any): ASTNode {
		let result = first.toAST();
		const children = rest.children;
		const len = children.length;

		// Build left-associative tree directly without map() + reduce()
		// This avoids creating intermediate arrays and reduces allocations
		for (let i = 0; i < len; i++) {
			result = {
				type: "and",
				left: result,
				right: children[i].toAST(),
			};
		}

		return result;
	},

	NotExpression_negation(_not: any, expr: any): ASTNode {
		return {
			type: "not",
			expression: expr.toAST(),
		};
	},

	NotExpression(expr: any): ASTNode {
		return expr.toAST();
	},

	PrimaryExpression_parens(_open: any, expr: any, _close: any): ASTNode {
		return expr.toAST();
	},

	PrimaryExpression(expr: any): ASTNode {
		return expr.toAST();
	},

	FieldExpression_existsQuestion(field: any, _q: any): ASTNode {
		return {
			type: "exists",
			field: field.toAST(),
		};
	},

	FieldExpression_existsKeyword(field: any, _exists: any): ASTNode {
		return {
			type: "exists",
			field: field.toAST(),
		};
	},

	FieldExpression_notOneOf(
		field: any,
		_op: any,
		_open: any,
		values: any,
		_close: any,
	): ASTNode {
		const children = values.asIteration().children;
		const len = children.length;
		const valueArray: Value[] = [];

		for (let i = 0; i < len; i++) {
			valueArray.push(children[i].toAST());
		}

		return {
			type: "notOneOf",
			field: field.toAST(),
			values: valueArray,
		};
	},

	FieldExpression_oneOf(
		field: any,
		_op: any,
		_open: any,
		values: any,
		_close: any,
	): ASTNode {
		const children = values.asIteration().children;
		const len = children.length;
		const valueArray: Value[] = [];

		for (let i = 0; i < len; i++) {
			valueArray.push(children[i].toAST());
		}

		return {
			type: "oneOf",
			field: field.toAST(),
			values: valueArray,
		};
	},

	FieldExpression_comparison(field: any, op: any, value: any): ASTNode {
		return {
			type: "comparison",
			field: field.toAST(),
			operator: op.sourceString as any,
			value: value.toAST(),
		};
	},

	FieldExpression_booleanField(field: any): ASTNode {
		return {
			type: "booleanField",
			field: field.toAST(),
		};
	},

	FieldName(first: any, _dots: any, idents: any): string {
		const children = idents.children;
		const len = children.length;

		// Early exit for simple field names (most common case)
		if (len === 0) {
			return first.sourceString;
		}

		// Build dotted path with array join (faster than string concatenation)
		// Use map to construct array efficiently without pre-allocating undefined values
		return [
			first.sourceString,
			...children.map((c: any) => c.sourceString),
		].join(".");
	},

	Value(value: any): Value {
		return value.toAST();
	},

	stringLiteral(_open: any, chars: any, _close: any): Value {
		const children = chars.children;
		const len = children.length;

		// Early exit for empty strings
		if (len === 0) {
			return { type: "string", value: "" };
		}

		// Fast path: check if any escapes exist (most strings have no escapes)
		let hasEscapes = false;
		for (let i = 0; i < len; i++) {
			if (children[i].sourceString.length > 1) {
				hasEscapes = true;
				break;
			}
		}

		if (!hasEscapes) {
			// Fast path for unescaped strings: use map to construct array efficiently
			const value = children.map((c: any) => c.sourceString).join("");
			return { type: "string", value };
		}

		// Slow path: handle escape sequences
		let result = "";
		for (let i = 0; i < len; i++) {
			const source = children[i].sourceString;
			// Escaped characters have length > 1 (backslash + character)
			if (source.length > 1 && source[0] === "\\") {
				// Get the character after the backslash and lookup in map
				const escapedChar = source[1];
				const unescaped = ESCAPE_MAP[escapedChar];
				result += unescaped !== undefined ? unescaped : escapedChar;
			} else {
				result += source;
			}
		}
		return { type: "string", value: result };
	},

	numberLiteral_float(
		this: any,
		_sign: any,
		_whole: any,
		_dot: any,
		_frac: any,
	): Value {
		// Use entire matched source directly (zero-copy, faster than concatenation)
		const value = Number.parseFloat(this.sourceString);
		return { type: "number", value };
	},

	numberLiteral_int(this: any, _sign: any, _digits: any): Value {
		// Use entire matched source directly (zero-copy, faster than concatenation)
		const value = Number.parseInt(this.sourceString, 10);
		return { type: "number", value };
	},

	booleanLiteral(bool: any): Value {
		return {
			type: "boolean",
			value: bool.sourceString.toLowerCase() === "true",
		};
	},

	ident(this: any, _start: any, _rest: any): Value {
		return { type: "identifier", value: this.sourceString };
	},

	Value_dottedIdent(first: any, _dots: any, idents: any): Value {
		const children = idents.children;
		const len = children.length;

		// Early exit for simple identifiers
		if (len === 0) {
			return { type: "identifier", value: first.sourceString };
		}

		// Build dotted identifier
		let result = first.sourceString;
		for (let i = 0; i < len; i++) {
			result += "." + children[i].sourceString;
		}
		return { type: "identifier", value: result };
	},

	// These just pass through the source string for keywords
	or(_or: any): any {
		return _or;
	},

	and(_and: any): any {
		return _and;
	},

	not(_not: any): any {
		return _not;
	},

	exists(_exists: any): any {
		return _exists;
	},

	true(_true: any): any {
		return _true;
	},

	false(_false: any): any {
		return _false;
	},

	// Operators
	oneOfOp(_op: any): any {
		return _op;
	},

	notOneOfOp(_op: any): any {
		return _op;
	},

	ComparisonOp(_op: any): any {
		return _op;
	},
};
