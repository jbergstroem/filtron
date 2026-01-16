// Minimal example of filtering an array with a Filtron query.
// Run with: bun run examples/simple.ts

import { parseOrThrow } from "@filtron/core";
import { toFilter } from "../src/filter";

const users = [
	{ name: "Alice", age: 25, status: "active" },
	{ name: "Bob", age: 16, status: "active" },
	{ name: "Charlie", age: 30, status: "inactive" },
];

const ast = parseOrThrow('age >= 18 AND status = "active"');
const filter = toFilter(ast);
const result = users.filter(filter);

console.log(result);
// Output: [{ name: "Alice", age: 25, status: "active" }]
