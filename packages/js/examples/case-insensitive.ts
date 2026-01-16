// Case-insensitive string comparisons.
// Run with: bun run examples/case-insensitive.ts

import { parseOrThrow } from "@filtron/core";
import { toFilter } from "../src/filter";

const users = [
	{ name: "Alice", status: "ACTIVE" },
	{ name: "Bob", status: "Active" },
	{ name: "Charlie", status: "inactive" },
];

const ast = parseOrThrow('status = "active"');

// With caseInsensitive: true, matches "ACTIVE", "Active", "active", etc.
const filter = toFilter(ast, { caseInsensitive: true });
const result = users.filter(filter);

console.log(result);
// Output: [
//   { name: "Alice", status: "ACTIVE" },
//   { name: "Bob", status: "Active" }
// ]
