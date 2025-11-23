/**
 * Core Parser Benchmark Suite
 *
 * Continuous performance tracking using tinybench + CodSpeed
 * Run: bun run bench:core
 */

import { Bench } from "tinybench";
import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { parse } from "@filtron/core";

const bench = withCodSpeed(
	new Bench({
		warmupIterations: 100,
		warmupTime: 100,
		iterations: 1000,
	}),
);

bench
	.add("simple: age > 18", () => {
		parse("age > 18");
	})
	.add("simple: status equals", () => {
		parse('status = "active"');
	})
	.add("simple: boolean field", () => {
		parse("verified");
	})
	.add("simple: exists check", () => {
		parse("email?");
	})
	.add("simple: NOT expression", () => {
		parse("NOT suspended");
	});

bench
	.add("medium: AND with comparison", () => {
		parse('status = "active" AND age >= 18');
	})
	.add("medium: multiple AND", () => {
		parse("verified AND premium AND age > 21");
	})
	.add("medium: OR conditions", () => {
		parse('role = "admin" OR role = "moderator"');
	})
	.add("medium: one-of array", () => {
		parse('status : ["pending", "approved", "active"]');
	})
	.add("medium: nested fields", () => {
		parse("user.profile.age >= 18 AND user.verified = true");
	})
	.add("medium: exists with AND", () => {
		parse("email? AND verified = true AND age > 18");
	});

bench
	.add("complex: parentheses with AND/OR", () => {
		parse(
			'(role = "admin" OR role = "moderator") AND status = "active" AND age >= 18',
		);
	})
	.add("complex: multiple arrays", () => {
		parse(
			'status : ["active", "pending"] AND role : ["admin", "moderator", "user"] AND verified',
		);
	})
	.add("complex: deep nesting", () => {
		parse("(a = 1 AND (b = 2 OR c = 3)) AND (d = 4 OR (e = 5 AND f = 6))");
	})
	.add("complex: mixed operators", () => {
		parse(
			'email? AND verified = true AND status : ["active", "premium"] AND user.age >= 18 AND NOT suspended',
		);
	})
	.add("complex: permission check", () => {
		parse(
			'(user.role = "admin" AND permissions.write) OR (user.role = "moderator" AND permissions.moderate)',
		);
	});

bench
	.add("api: user search", () => {
		parse('(name ~ "john" OR email ~ "john") AND status = "active"');
	})
	.add("api: date range with status", () => {
		parse(
			'createdAt >= "2024-01-01" AND createdAt <= "2024-12-31" AND status : ["active", "pending"]',
		);
	})
	.add("api: role-based filter", () => {
		parse('verified = true AND role : ["user", "premium"] AND NOT suspended');
	});

bench
	.add("error: invalid syntax", () => {
		parse("this is not valid");
	})
	.add("error: incomplete expression", () => {
		parse("age > ");
	});

async function main() {
	await bench.run();

	console.table(bench.table());
}

main().catch(console.error);
