// Combining multiple Filtron queries with custom parameter indexing.
// Run with: bun run examples/combining-queries.ts

import { parseOrThrow } from "@filtron/core";
import { toSQL } from "../src/converter";

// Build a complex query from multiple parts
const baseAst = parseOrThrow('status = "active"');
const filterAst = parseOrThrow("age >= 18");

const baseResult = toSQL(baseAst);
const filterResult = toSQL(filterAst, {
	startIndex: baseResult.params.length + 1,
});

const combinedSql = `${baseResult.sql} AND ${filterResult.sql}`;
const combinedParams = [...baseResult.params, ...filterResult.params];

console.log("SQL:", combinedSql);
// Output: status = $1 AND age >= $2

console.log("Params:", combinedParams);
// Output: ["active", 18]
