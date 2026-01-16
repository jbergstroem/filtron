// Using different parameter placeholder styles for various databases.
// Run with: bun run examples/parameter-styles.ts

import { parseOrThrow } from "@filtron/core";
import { toSQL } from "../src/converter";

const ast = parseOrThrow('status = "active" AND age >= 18');

// PostgreSQL/CockroachDB style: $1, $2, $3 (default)
const postgres = toSQL(ast, { parameterStyle: "numbered" });
console.log("PostgreSQL:", postgres.sql);
// Output: (status = $1 AND age >= $2)

// MySQL/SQLite/DuckDB style: ?, ?, ?
const mysql = toSQL(ast, { parameterStyle: "question" });
console.log("MySQL/SQLite:", mysql.sql);
// Output: (status = ? AND age >= ?)

// Both have the same params array
console.log("Params:", postgres.params);
// Output: ["active", 18]
