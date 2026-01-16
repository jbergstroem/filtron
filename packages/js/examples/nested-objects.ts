// Filtering objects with nested properties using nestedAccessor.
// Run with: bun run examples/nested-objects.ts

import { parseOrThrow } from "@filtron/core";
import { toFilter, nestedAccessor } from "../src/filter";

const users = [
	{ name: "Alice", profile: { age: 25, verified: true } },
	{ name: "Bob", profile: { age: 16, verified: true } },
	{ name: "Charlie", profile: { age: 30, verified: false } },
];

// Default behavior: looks for a literal "profile.age" property (won't match)
const astDefault = parseOrThrow("profile.age >= 18");
const filterDefault = toFilter(astDefault);
const defaultResult = users.filter(filterDefault);
console.log("Default accessor:", defaultResult);
// Output: [] (no matches - looks for obj["profile.age"], not obj.profile.age)

// With nestedAccessor: traverses nested properties
const ast = parseOrThrow("profile.age >= 18 AND profile.verified");
const filter = toFilter(ast, {
	fieldAccessor: nestedAccessor(),
});
const result = users.filter(filter);
console.log("Nested accessor:", result);
// Output: [{ name: "Alice", profile: { age: 25, verified: true } }]
