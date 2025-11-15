/**
 * Basic usage examples for the Filtron parser
 *
 * Run this file with: bun run examples/basic.ts
 */

import { parse, parseOrThrow } from "../src/index";

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
};

// Helper to print colored JSON using Bun's built-in inspector
function printJSON(obj: unknown) {
	console.log(Bun.inspect(obj, { colors: true, depth: 10 }));
}

// Helper to print section headers
function section(num: number, title: string) {
	console.log(`${colors.bright}${colors.cyan}${num}. ${title}${colors.reset}`);
}

// Helper to print success messages
function success(message: string) {
	console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

// Helper to print error messages
function error(message: string) {
	console.log(`${colors.red}✗ ${message}${colors.reset}`);
}

// Helper to print info
function info(label: string, value: string) {
	console.log(
		`${colors.gray}${label}:${colors.reset} ${colors.yellow}${value}${colors.reset}`,
	);
}

console.log(
	`${colors.bright}${colors.magenta}=== Filtron Parser Examples ===${colors.reset}\n`,
);

// Example 1: Simple comparison
section(1, "Simple comparison");
const result1 = parse("age > 18");
if (result1.success) {
	printJSON(result1.ast);
}
console.log();

// Example 2: AND operator
section(2, "Multiple conditions with AND");
const result2 = parse('status = "active" AND age >= 18');
if (result2.success) {
	printJSON(result2.ast);
}
console.log();

// Example 3: Field existence
section(3, "Field existence check");
const result3 = parse("email? AND verified = true");
if (result3.success) {
	printJSON(result3.ast);
}
console.log();

// Example 4: One-of expression
section(4, "One-of expression");
const result4 = parse('role : ["admin", "moderator", "user"]');
if (result4.success) {
	printJSON(result4.ast);
}
console.log();

// Example 5: Complex nested query
section(5, "Complex nested query");
const result5 = parse(
	'(role = "admin" OR role = "moderator") AND status = "active"',
);
if (result5.success) {
	printJSON(result5.ast);
}
console.log();

// Example 6: Dotted field names
section(6, "Dotted field names");
const result6 = parse(
	"user.profile.age >= 18 AND user.settings.notifications = true",
);
if (result6.success) {
	printJSON(result6.ast);
}
console.log();

// Example 7: Boolean field shorthand
section(7, "Boolean field shorthand");
const result7 = parse("verified AND premium");
if (result7.success) {
	printJSON(result7.ast);
}
console.log();

// Example 8: Error handling with parse()
section(8, "Error handling with parse()");
const result8 = parse("invalid === query");
if (!result8.success) {
	error("Parse failed");
	console.log(`${colors.dim}${result8.error}${colors.reset}`);
}
console.log();

// Example 9: Error handling with parseOrThrow()
section(9, "Error handling with parseOrThrow()");
try {
	parseOrThrow("invalid query ===");
} catch (e) {
	error("Caught exception");
	console.log(
		`${colors.dim}${e instanceof Error ? e.message : e}${colors.reset}`,
	);
}
console.log();

// Example 10: Real-world use case
section(10, "Real-world user filtering query");
const userQuery = `
	email?
	AND verified = true
	AND status : ["active", "premium"]
	AND user.age >= 18
	AND NOT suspended
`;
const result10 = parse(userQuery);
if (result10.success) {
	success("Valid query parsed successfully");
	info("AST node type", result10.ast.type);
}
