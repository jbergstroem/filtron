/**
 * Performance benchmark for @filtron/js
 * Run with: bun run bench
 */

import {
	bench,
	group,
	run,
	do_not_optimize,
	queries,
	measureMemory,
	measureTime,
	printMemory,
	printOverhead,
	type BenchState,
} from "@filtron/benchmark";
import { parse, parseOrThrow } from "@filtron/core";
import { toFilter } from "./index.js";

// Pre-parsed ASTs for isolated conversion benchmarks
const asts = {
	simple: parseOrThrow("age > 18"),
	medium: parseOrThrow('status = "active" AND age >= 18'),
	complex: parseOrThrow('(role = "admin" OR role = "moderator") AND verified'),
	oneOf: parseOrThrow('status : ["pending", "approved", "active"]'),
	largeOneOf: parseOrThrow(
		'status : ["s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "s12", "s13", "s14"]',
	),
};

// Sample data for filtering tests
const users = Array.from({ length: 1000 }, (_, i) => ({
	id: i + 1,
	age: 18 + (i % 50),
	status: i % 3 === 0 ? "active" : i % 3 === 1 ? "pending" : "inactive",
	verified: i % 2 === 0,
	role: i % 10 === 0 ? "admin" : i % 5 === 0 ? "moderator" : "user",
}));

// Pre-compiled filters
const filters = {
	simple: toFilter(asts.simple),
	medium: toFilter(asts.medium),
	complex: toFilter(asts.complex),
	largeOneOf: toFilter(asts.largeOneOf),
};

group("toFilter only", () => {
	bench("simple", () => do_not_optimize(toFilter(asts.simple)));
	bench("medium", () => do_not_optimize(toFilter(asts.medium)));
	bench("complex", () => do_not_optimize(toFilter(asts.complex)));
	bench("oneOf", () => do_not_optimize(toFilter(asts.oneOf)));
});

group("filter 1000 items", () => {
	bench("simple", () => do_not_optimize(users.filter(filters.simple)));
	bench("medium", () => do_not_optimize(users.filter(filters.medium)));
	bench("complex", () => do_not_optimize(users.filter(filters.complex)));
	bench("largeOneOf", () => do_not_optimize(users.filter(filters.largeOneOf)));
});

group("parse + toFilter", () => {
	bench("$query", function* (state: BenchState) {
		const query = state.get("query");
		yield () => {
			const result = parse(query);
			if (result.success) do_not_optimize(toFilter(result.ast));
		};
	}).args("query", [...queries.simple.slice(0, 2), ...queries.medium.slice(0, 2)]);
});

// Memory & overhead analysis
const testQuery = 'age > 18 AND status = "active" AND verified';
const testAst = parseOrThrow(testQuery);

printMemory([
	measureMemory("parse", 1000, () => parse(testQuery)),
	measureMemory("parse + toFilter", 1000, () => {
		const r = parse(testQuery);
		if (r.success) toFilter(r.ast);
	}),
	measureMemory("toFilter only", 1000, () => toFilter(testAst)),
]);

const parseTime = measureTime(() => parse(testQuery));
const convertTime = measureTime(() => toFilter(testAst));
const totalTime = measureTime(() => {
	const r = parse(testQuery);
	if (r.success) toFilter(r.ast);
});

printOverhead("toFilter", parseTime, convertTime, totalTime);

await run();
