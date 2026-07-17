/**
 * @filtron/time-resolver - Resolve now-relative temporal values
 *
 * Replaces every now-relative point in a Filtron AST with an absolute
 * date, so the adapters (which reject unresolved relative values) can
 * evaluate the query against a fixed instant.
 *
 * @example
 * ```typescript
 * import { parseOrThrow } from '@filtron/core';
 * import { resolveTemporal } from '@filtron/time-resolver';
 * import { toSQL } from '@filtron/sql';
 *
 * const ast = resolveTemporal(parseOrThrow('created > @now-7d'));
 * const { sql, params } = toSQL(ast);
 * // sql: "created > $1", params: ["2026-07-10T12:00:00.000Z"]
 * ```
 */

export { resolveTemporal } from "./src/resolve.js";
export type { ResolveTemporalOptions } from "./src/resolve.js";
