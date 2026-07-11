/**
 * JS Filter Benchmark Suite
 *
 * Continuous performance tracking using tinybench + CodSpeed
 * Run: bun run bench:js
 */

import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { parse } from "@filtron/core";
import { toFilter, nestedAccessor } from "@filtron/js";
import { Bench } from "tinybench";

const bench = withCodSpeed(
	new Bench({
		warmupIterations: 10,
		iterations: 100,
	}),
);

// Pre-parse ASTs for isolated filter creation benchmarks
const simpleAST = parse("age > 18");
const mediumAST = parse('status = "active" AND age >= 18');
const complexAST = parse('(role = "admin" OR role = "moderator") AND status = "active"');
// Large oneOf (>12 items) to test Set-based lookup optimization
const largeOneOfAST = parse(
	'status : ["s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "s12", "s13", "s14"] AND age > 18',
);

const andChainAST = parse('verified AND age > 18 AND status = "active" AND role = "user"');
const nestedAST = parse("profile.age > 21");

// Validate ASTs
if (
	!simpleAST.success ||
	!mediumAST.success ||
	!complexAST.success ||
	!largeOneOfAST.success ||
	!andChainAST.success ||
	!nestedAST.success
) {
	throw new Error("Failed to parse test queries");
}

// Sample data for filtering tests
const users = Array.from({ length: 1000 }, (_, i) => ({
	id: i + 1,
	name: `User ${i + 1}`,
	age: 18 + (i % 50),
	status: i % 3 === 0 ? "active" : i % 3 === 1 ? "pending" : "inactive",
	verified: i % 2 === 0,
	role: i % 10 === 0 ? "admin" : i % 5 === 0 ? "moderator" : "user",
	suspended: i % 20 === 0,
}));

// Pre-compile filters for array filtering benchmarks
const simpleFilter = toFilter(simpleAST.ast);
const mediumFilter = toFilter(mediumAST.ast);
const complexFilter = toFilter(complexAST.ast);
const largeOneOfFilter = toFilter(largeOneOfAST.ast);
const andChainFilter = toFilter(andChainAST.ast);
const nestedFilter = toFilter(nestedAST.ast, { fieldAccessor: nestedAccessor() });

// Data set with nested objects for accessor benchmarks
const nestedUsers = Array.from({ length: 1000 }, (_, i) => ({
	id: i + 1,
	profile: { age: 18 + (i % 50) },
}));

// Filter creation benchmarks (isolated overhead)
bench
	.add("toFilter: simple", () => {
		toFilter(simpleAST.ast);
	})
	.add("toFilter: medium", () => {
		toFilter(mediumAST.ast);
	})
	.add("toFilter: complex", () => {
		toFilter(complexAST.ast);
	});

// Array filtering benchmarks (1000 items)
bench
	.add("filter array: simple", () => {
		users.filter(simpleFilter);
	})
	.add("filter array: medium", () => {
		users.filter(mediumFilter);
	})
	.add("filter array: complex", () => {
		users.filter(complexFilter);
	})
	.add("filter array: large oneOf", () => {
		users.filter(largeOneOfFilter);
	})
	.add("filter array: AND chain", () => {
		users.filter(andChainFilter);
	})
	.add("filter array: nested accessor", () => {
		nestedUsers.filter(nestedFilter);
	});

// End-to-end pipeline benchmarks
bench
	.add("pipeline: simple end-to-end", () => {
		const result = parse("age > 18");
		if (result.success) {
			const filter = toFilter(result.ast);
			users.filter(filter);
		}
	})
	.add("pipeline: medium end-to-end", () => {
		const result = parse('status = "active" AND age >= 18');
		if (result.success) {
			const filter = toFilter(result.ast);
			users.filter(filter);
		}
	})
	.add("pipeline: complex end-to-end", () => {
		const result = parse('(role = "admin" OR role = "moderator") AND status = "active"');
		if (result.success) {
			const filter = toFilter(result.ast);
			users.filter(filter);
		}
	});

async function main() {
	await bench.run();

	console.table(bench.table());
}

main().catch(console.error);
