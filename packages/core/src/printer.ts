/**
 * Canonical printer for Filtron ASTs
 */

import type { ASTNode, TemporalPoint, Value } from "./types";

/**
 * Language precedence (lowest to highest): OR < AND < NOT < primary.
 * A child wraps in parentheses only when it binds looser than its parent.
 */
const PREC_OR = 1;
const PREC_AND = 2;
const PREC_NOT = 3;

/**
 * Prints an AST as canonical Filtron query text
 *
 * Parsing the output reproduces the AST: parseOrThrow(print(ast))
 * is deeply equal to ast for any parser-produced tree. Parentheses
 * appear only where a child binds looser than its parent, strings are
 * double-quoted with escapes, and temporal values print behind @.
 * Useful for canonicalizing queries (cache keys, logs) and roundtrip
 * testing.
 *
 * @param node - The AST node to print
 * @returns The canonical query text
 *
 * @example
 * ```typescript
 * import { parseOrThrow, print } from "@filtron/core";
 *
 * print(parseOrThrow("(a AND (b OR c))"));
 * // "a AND (b OR c)"
 * ```
 */
export function print(node: ASTNode): string {
	return printNode(node, 0);
}

/**
 * Recursively prints a node under the given parent precedence
 */
function printNode(node: ASTNode, parentPrec: number): string {
	switch (node.type) {
		case "or": {
			let text = printNode(node.children[0], PREC_OR);
			for (let i = 1; i < node.children.length; i++) {
				text += " OR " + printNode(node.children[i], PREC_OR);
			}
			return parentPrec > PREC_OR ? `(${text})` : text;
		}
		case "and": {
			let text = printNode(node.children[0], PREC_AND);
			for (let i = 1; i < node.children.length; i++) {
				text += " AND " + printNode(node.children[i], PREC_AND);
			}
			return parentPrec > PREC_AND ? `(${text})` : text;
		}
		case "not":
			return `NOT ${printNode(node.expression, PREC_NOT)}`;
		case "comparison":
			return `${node.field} ${node.operator} ${printValue(node.value)}`;
		case "oneOf": {
			const values = node.values.map(printValue).join(", ");
			return `${node.field} ${node.negated ? "!:" : ":"} [${values}]`;
		}
		case "exists":
			return node.negated ? `-${node.field}` : `${node.field}?`;
		case "booleanField":
			return node.field;
		default: {
			// TypeScript exhaustiveness check
			const _exhaustive: never = node;
			throw new Error(`Unknown node type: ${(node as ASTNode).type}`);
		}
	}
}

/**
 * Prints a value in comparison or membership position
 */
function printValue(value: Value): string {
	switch (value.type) {
		case "string":
			return `"${escapeString(value.value)}"`;
		case "number":
			return String(value.value);
		case "boolean":
			return value.value ? "true" : "false";
		case "identifier":
			return value.value;
		case "range":
			if (value.kind === "temporal") {
				return `@${printTemporalPoint(value.min)}..${printTemporalPoint(value.max)}`;
			}
			return `${value.min}..${value.max}`;
		case "date":
		case "now":
			return `@${printTemporalPoint(value)}`;
		default: {
			// TypeScript exhaustiveness check
			const _exhaustive: never = value;
			throw new Error(`Unknown value type: ${(value as Value).type}`);
		}
	}
}

/**
 * Prints a temporal point without its sigil
 */
function printTemporalPoint(point: TemporalPoint): string {
	switch (point.type) {
		case "date":
			return point.value;
		case "now": {
			if (point.offset === null) {
				return "now";
			}
			const { amount, unit } = point.offset;
			return amount < 0 ? `now-${-amount}${unit}` : `now+${amount}${unit}`;
		}
		default: {
			// TypeScript exhaustiveness check
			const _exhaustive: never = point;
			throw new Error(`Unknown temporal point type: ${(point as TemporalPoint).type}`);
		}
	}
}

/**
 * Escapes a string literal for double-quoted output, reversing the
 * lexer's escape handling
 */
function escapeString(value: string): string {
	let result = "";
	for (const char of value) {
		switch (char) {
			case "\\":
				result += "\\\\";
				break;
			case '"':
				result += '\\"';
				break;
			case "\n":
				result += "\\n";
				break;
			case "\t":
				result += "\\t";
				break;
			case "\r":
				result += "\\r";
				break;
			default:
				result += char;
		}
	}
	return result;
}
