/**
 * Pre-order depth-first traversal of a Filtron AST
 */

import type { ASTNode } from "./types";

/**
 * Walks an AST in pre-order depth-first order, calling the visitor on each node
 *
 * The visitor is called on a node before its children. Returning false from
 * the visitor skips that node's children; any other return value (including
 * undefined) descends. Children of "or" and "and" nodes are visited in order;
 * "not" nodes descend through their expression. All other nodes are leaves.
 *
 * @param node - The AST node to walk
 * @param visitor - Called once per visited node; return false to skip children
 *
 * @example
 * ```typescript
 * import { parseOrThrow, walk } from "@filtron/core";
 *
 * const ast = parseOrThrow('age > 18 AND status = "active"');
 * const fields: string[] = [];
 * walk(ast, (node) => {
 *   if ("field" in node) {
 *     fields.push(node.field);
 *   }
 * });
 * // fields: ["age", "status"]
 * ```
 */
export function walk(node: ASTNode, visitor: (node: ASTNode) => boolean | undefined): void {
	if (visitor(node) === false) {
		return;
	}

	switch (node.type) {
		case "or":
		case "and":
			for (const child of node.children) {
				walk(child, visitor);
			}
			return;
		case "not":
			walk(node.expression, visitor);
			return;
		case "comparison":
		case "oneOf":
		case "exists":
		case "booleanField":
		case "range":
			return;
		default: {
			// TypeScript exhaustiveness check
			const _exhaustive: never = node;
			throw new Error(`Unknown node type: ${(node as ASTNode).type}`);
		}
	}
}
