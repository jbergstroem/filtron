/**
 * @filtron/sql - SQL WHERE clause generator for Filtron AST
 *
 * Converts Filtron AST nodes to parameterized SQL WHERE clauses with safe
 * parameter binding to prevent SQL injection.
 *
 * @example
 * ```typescript
 * import { parse } from '@filtron/core';
 * import { toSQL } from '@filtron/sql';
 *
 * const result = parse('age > 18 AND status = "active"');
 * if (result.success) {
 *   const { sql, params } = toSQL(result.ast);
 *   // sql: "age > $1 AND status = $2"
 *   // params: [18, "active"]
 *
 *   // Use with your database:
 *   const users = await db.query(`SELECT * FROM users WHERE ${sql}`, params);
 * }
 * ```
 */

export {
	toSQL,
	escapeLike,
	contains,
	prefix,
	suffix,
} from "./src/converter.js";
export type { SQLResult, SQLOptions } from "./src/converter.js";
