/**
 * @filtron/js - In-memory JavaScript array filtering using Filtron AST
 *
 * Converts Filtron AST nodes to predicate functions that can filter arrays
 * of JavaScript objects.
 *
 * @example
 * ```typescript
 * import { parse } from '@filtron/core';
 * import { toFilter } from '@filtron/js';
 *
 * const result = parse('age > 18 AND status = "active"');
 * if (result.success) {
 *   const filter = toFilter(result.ast);
 *
 *   const users = [
 *     { name: 'Alice', age: 25, status: 'active' },
 *     { name: 'Bob', age: 16, status: 'active' },
 *     { name: 'Charlie', age: 30, status: 'inactive' },
 *   ];
 *
 *   const filtered = users.filter(filter);
 *   // [{ name: 'Alice', age: 25, status: 'active' }]
 * }
 * ```
 */

export { toFilter, nestedAccessor } from "./src/filter.js";
export type { FilterPredicate, FilterOptions } from "./src/filter.js";
