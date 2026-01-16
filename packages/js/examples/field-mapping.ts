// Mapping query field names to different object property names.
// Run with: bun run examples/field-mapping.ts

import { parseOrThrow } from "@filtron/core";
import { toFilter } from "../src/filter";

const users = [
	{ fullName: "Alice Smith", emailAddress: "alice@example.com", isActive: true },
	{ fullName: "Bob Jones", emailAddress: "bob@example.com", isActive: false },
];

// Allow queries to use friendly field names
const ast = parseOrThrow('name ~ "Alice" AND active');
const filter = toFilter(ast, {
	fieldMapping: {
		name: "fullName",
		email: "emailAddress",
		active: "isActive",
	},
});

const result = users.filter(filter);

console.log(result);
// Output: [{ fullName: "Alice Smith", emailAddress: "alice@example.com", isActive: true }]
