/**
 * Basic examples of using @filtron/sql
 * Run with: bun run examples/basic.ts
 */

import { parse, parseOrThrow } from "@filtron/core";
import { toSQL, contains } from "../index.js";

// ANSI color codes for pretty output
const colors = {
	reset: "\x1b[0m",
	bright: "\x1b[1m",
	dim: "\x1b[2m",
	cyan: "\x1b[36m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	magenta: "\x1b[35m",
	gray: "\x1b[90m",
	blue: "\x1b[34m",
};

// Helper to print section headers
function section(num: number, title: string) {
	console.log(`${colors.bright}${colors.cyan}${num}. ${title}${colors.reset}`);
}

// Helper to print error messages
function error(message: string) {
	console.log(`${colors.red}✗ ${message}${colors.reset}`);
}

// Helper to print info
function info(label: string, value: string) {
	console.log(`${colors.gray}${label}:${colors.reset} ${colors.yellow}${value}${colors.reset}`);
}

// Helper to print SQL output
function printSQL(label: string, value: string) {
	console.log(`${colors.gray}${label}:${colors.reset} ${colors.blue}${value}${colors.reset}`);
}

console.log(
	`${colors.bright}${colors.magenta}=== Filtron SQL Converter Examples ===${colors.reset}\n`,
);

// Example 1: Basic comparison with PostgreSQL style
section(1, "Basic Comparison (PostgreSQL)");
const query1 = 'age > 18 AND status = "active"';
const ast1 = parseOrThrow(query1);
const result1 = toSQL(ast1);
info("Query", query1);
printSQL("SQL", result1.sql);
info("Params", JSON.stringify(result1.params));
console.log();

// Example 2: MySQL/SQLite style with question marks
section(2, "MySQL/SQLite Style");
const query2 = 'price <= 100 AND category : ["electronics", "computers"]';
const ast2 = parseOrThrow(query2);
const result2 = toSQL(ast2, { parameterStyle: "question" });
info("Query", query2);
printSQL("SQL", result2.sql);
info("Params", JSON.stringify(result2.params));
console.log();

// Example 3: Field mapping with table prefix
section(3, "Field Mapping (table prefix)");
const query3 = 'verified AND role = "admin"';
const ast3 = parseOrThrow(query3);
const result3 = toSQL(ast3, {
	fieldMapper: (field) => `users.${field}`,
});
info("Query", query3);
printSQL("SQL", result3.sql);
info("Params", JSON.stringify(result3.params));
console.log();

// Example 4: Complex nested query
section(4, "Complex Nested Query");
const query4 = '(role = "admin" OR role = "moderator") AND NOT suspended AND email?';
const ast4 = parseOrThrow(query4);
const result4 = toSQL(ast4);
info("Query", query4);
printSQL("SQL", result4.sql);
info("Params", JSON.stringify(result4.params));
console.log();

// Example 5: One-of expression (IN clause)
section(5, "One-of Expression (IN clause)");
const query5 = 'status : ["pending", "approved", "active"]';
const ast5 = parseOrThrow(query5);
const result5 = toSQL(ast5);
info("Query", query5);
printSQL("SQL", result5.sql);
info("Params", JSON.stringify(result5.params));
console.log();

// Example 6: LIKE operator with valueMapper
section(6, "LIKE Operator (with automatic wildcards)");
const query6 = 'name ~ "john" AND age >= 18';
const ast6 = parseOrThrow(query6);
const result6 = toSQL(ast6, { valueMapper: contains });
info("Query", query6);
printSQL("SQL", result6.sql);
info("Params", JSON.stringify(result6.params));
console.log(
	`${colors.dim}Using valueMapper: contains() automatically adds wildcards${colors.reset}`,
);
console.log();

// Example 6b: LIKE operator with manual wildcards
section("6b", "LIKE Operator (manual wildcards)");
const query6b = 'name ~ "%john%" AND age >= 18';
const ast6b = parseOrThrow(query6b);
const result6b = toSQL(ast6b);
info("Query", query6b);
printSQL("SQL", result6b.sql);
info("Params", JSON.stringify(result6b.params));
console.log(`${colors.dim}Manual approach: wildcards included in query string${colors.reset}`);
console.log();

// Example 7: Real-world scenario - User search
section(7, "Real-world User Search");
const userQuery = 'age >= 21 AND verified AND role !: ["guest", "banned"]';
const userAst = parseOrThrow(userQuery);
const userResult = toSQL(userAst, {
	fieldMapper: (field) => `users.${field}`,
	parameterStyle: "numbered",
});
info("Query", userQuery);
printSQL("SQL", userResult.sql);
info("Params", JSON.stringify(userResult.params));
console.log(`${colors.dim}Full query:${colors.reset}`);
console.log(`  ${colors.blue}SELECT * FROM users WHERE ${userResult.sql};${colors.reset}`);
console.log();

// Example 8: Error handling
section(8, "Error Handling");
const invalidQuery = "age > AND status =";
const parseResult = parse(invalidQuery);
info("Query", invalidQuery);
if (parseResult.success) {
	const sqlResult = toSQL(parseResult.ast);
	printSQL("SQL", sqlResult.sql);
} else {
	error("Parse failed");
	console.log(`${colors.dim}${parseResult.error}${colors.reset}`);
}
console.log();

// Example 9: Custom start index for combining queries
section(9, "Combining Queries with Custom Start Index");
const baseQuery = 'status = "active"';
const filterQuery = "age > 18";
const baseAst = parseOrThrow(baseQuery);
const filterAst = parseOrThrow(filterQuery);

const baseResult = toSQL(baseAst);
const filterResult = toSQL(filterAst, {
	startIndex: baseResult.params.length + 1,
});

info("Base query", baseQuery);
info("Filter query", filterQuery);
printSQL("Combined SQL", `${baseResult.sql} AND ${filterResult.sql}`);
info("Combined Params", JSON.stringify([...baseResult.params, ...filterResult.params]));
console.log();

// Example 10: Field mapper with escaping/quoting
section(10, "Field Mapper with Quoting");
const query10 = 'userName = "john" AND firstName ~ "doe"';
const ast10 = parseOrThrow(query10);
const result10 = toSQL(ast10, {
	fieldMapper: (field) => `"${field}"`,
	parameterStyle: "question",
});
info("Query", query10);
printSQL("SQL", result10.sql);
info("Params", JSON.stringify(result10.params));
console.log();

// Example 11: Range expressions (BETWEEN)
section(11, "Range Expressions (BETWEEN)");
const query11 = "age = 18..65 AND salary = 50000..150000";
const ast11 = parseOrThrow(query11);
const result11 = toSQL(ast11);
info("Query", query11);
printSQL("SQL", result11.sql);
info("Params", JSON.stringify(result11.params));
console.log(`${colors.dim}Range syntax "min..max" converts to SQL BETWEEN${colors.reset}`);
console.log();

console.log(`${colors.bright}${colors.green}=== Examples Complete ===${colors.reset}`);
