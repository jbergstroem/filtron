import type { FiltronActionDict } from "./grammar.ohm-bundle.js";
import type { ASTNode, Value } from "./types";

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

		// Build dotted path with direct concatenation
		let result = first.sourceString;
		for (let i = 0; i < len; i++) {
			result += "." + children[i].sourceString;
		}
		return result;
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

		let result = "";
		for (let i = 0; i < len; i++) {
			const char = children[i];
			const source = char.sourceString;
			// Escaped characters have length > 1 (backslash + character)
			if (source.length > 1 && source[0] === "\\") {
				// Get the character after the backslash
				const escapedChar = source[1];
				// Handle common escape sequences
				switch (escapedChar) {
					case "n":
						result += "\n";
						break;
					case "t":
						result += "\t";
						break;
					case "r":
						result += "\r";
						break;
					case "\\":
						result += "\\";
						break;
					case '"':
						result += '"';
						break;
					default:
						result += escapedChar;
				}
			} else {
				result += source;
			}
		}
		return { type: "string", value: result };
	},

	numberLiteral_float(sign: any, whole: any, _dot: any, frac: any): Value {
		const value = Number.parseFloat(
			sign.sourceString + whole.sourceString + "." + frac.sourceString,
		);
		return { type: "number", value };
	},

	numberLiteral_int(sign: any, digits: any): Value {
		const value = Number.parseInt(sign.sourceString + digits.sourceString, 10);
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

	Value_simpleIdent(ident: any): Value {
		return ident.toAST();
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
