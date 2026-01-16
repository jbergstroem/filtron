// Minimal example of generating a SQL WHERE clause from a Filtron query.
// Run with: bun run examples/simple.ts

import { parseOrThrow } from "@filtron/core";
import { toSQL } from "../src/converter";

const ast = parseOrThrow('age >= 18 AND status = "active"');
const { sql, params } = toSQL(ast);

console.log("SQL:", sql);
// Output: SQL: (age >= $1 AND status = $2)

console.log("Params:", params);
// Output: Params: [18, "active"]

// Use with your database:
// await db.query(`SELECT * FROM users WHERE ${sql}`, params);
