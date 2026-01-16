// Filtering objects with nested properties using nestedAccessor.
// Run with: bun run examples/nested-objects.ts

import { parseOrThrow } from "@filtron/core";
import { toFilter, nestedAccessor } from "../src/filter";

const users = [
	{ name: "Alice", profile: { age: 25, verified: true } },
	{ name: "Bob", profile: { age: 16, verified: true } },
	{ name: "Charlie", profile: { age: 30, verified: false } },
];

const ast = parseOrThrow("profile.age >= 18 AND profile.verified");
const filter = toFilter(ast, {
	fieldAccessor: nestedAccessor(),
});

const result = users.filter(filter);

console.log(result);
// Output: [{ name: "Alice", profile: { age: 25, verified: true } }]
