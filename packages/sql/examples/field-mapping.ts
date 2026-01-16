// Mapping and quoting field names for SQL generation.
// Run with: bun run examples/field-mapping.ts

import { parseOrThrow } from "@filtron/core";
import { toSQL } from "../src/converter";

const ast = parseOrThrow('verified AND role = "admin"');

// Add table prefix to all fields
const withTable = toSQL(ast, {
	fieldMapper: (field) => `users.${field}`,
});
console.log("With table:", withTable.sql);
// Output: (users.verified = $1 AND users.role = $2)

// Quote field names (useful for reserved words or case-sensitive names)
const quoted = toSQL(ast, {
	fieldMapper: (field) => `"${field}"`,
});
console.log("Quoted:", quoted.sql);
// Output: ("verified" = $1 AND "role" = $2)

// Combine table prefix with quoting
const combined = toSQL(ast, {
	fieldMapper: (field) => `"users"."${field}"`,
});
console.log("Combined:", combined.sql);
// Output: ("users"."verified" = $1 AND "users"."role" = $2)
