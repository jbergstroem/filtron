// Restricting which fields can be used in queries.
// Run with: bun run examples/allowed-fields.ts

import { parseOrThrow } from "@filtron/core";
import { toFilter } from "../src/filter";

const users = [
	{ name: "Alice", age: 25, role: "admin", password: "secret123" },
	{ name: "Bob", age: 30, role: "user", password: "hunter2" },
];

// Only allow filtering by name and role, not age or password
const ast = parseOrThrow('name ~ "Alice"');
const filter = toFilter(ast, {
	allowedFields: ["name", "role"],
});

console.log(users.filter(filter));
// Output: [{ name: "Alice", age: 25, role: "admin", password: "secret123" }]

// Attempting to filter by a non-allowed field throws an error
try {
	const badAst = parseOrThrow("password ~ secret");
	toFilter(badAst, { allowedFields: ["name", "role"] });
} catch (error) {
	console.log("Error:", (error as Error).message);
	// Output: Error: Field "password" is not allowed. Allowed fields: name, role
}
