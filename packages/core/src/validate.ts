/**
 * Field validation for Filtron AST
 */

import type { ASTNode } from "./types";
import { walk } from "./walker";

/**
 * Validates that every field referenced in an AST is in the allowlist
 *
 * Walks the AST in pre-order and throws on the first field that is not
 * in `allowedFields`. Useful for guarding hand-built ASTs and untrusted
 * queries before generating filters or SQL.
 *
 * @param node - The AST node to validate
 * @param allowedFields - Field names that are allowed to appear in the AST
 * @throws Error if a field is not in the allowlist
 *
 * @example
 * ```typescript
 * import { parseOrThrow, validateFields } from "@filtron/core";
 *
 * const ast = parseOrThrow("password = \"hunter2\"");
 * validateFields(ast, ["name", "age"]);
 * // Error: Field "password" is not allowed. Allowed fields: name, age
 * ```
 */
export function validateFields(node: ASTNode, allowedFields: readonly string[]): void {
	const allowed = new Set(allowedFields);
	walk(node, (current) => {
		if ("field" in current && !allowed.has(current.field)) {
			throw new Error(
				`Field "${current.field}" is not allowed. Allowed fields: ${allowedFields.join(", ")}`,
			);
		}
		return undefined;
	});
}
