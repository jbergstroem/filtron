/**
 * Performance benchmark for @filtron/sql
 * Run with: bun run benchmark.ts
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
import { toSQL } from "./index.js";

// Pre-parsed ASTs for isolated conversion benchmarks
const asts = {
	simple: parseOrThrow("age > 18"),
	medium: parseOrThrow('status = "active" AND age >= 18'),
	complex: parseOrThrow('(role = "admin" OR role = "moderator") AND verified'),
	oneOf: parseOrThrow('status : ["pending", "approved", "active"]'),
};

group("toSQL only", () => {
	bench("simple", () => do_not_optimize(toSQL(asts.simple)));
	bench("medium", () => do_not_optimize(toSQL(asts.medium)));
	bench("complex", () => do_not_optimize(toSQL(asts.complex)));
	bench("oneOf", () => do_not_optimize(toSQL(asts.oneOf)));
});

group("parse + toSQL", () => {
	bench("$query", function* (state: BenchState) {
		const query = state.get("query");
		yield () => {
			const result = parse(query);
			if (result.success) do_not_optimize(toSQL(result.ast));
		};
	}).args("query", [...queries.simple.slice(0, 2), ...queries.medium.slice(0, 2)]);
});

group("Parameter styles", () => {
	bench("numbered", () => do_not_optimize(toSQL(asts.medium, { parameterStyle: "numbered" })));
	bench("question", () => do_not_optimize(toSQL(asts.medium, { parameterStyle: "question" })));
});

// Memory & overhead analysis
const testQuery = 'age > 18 AND status = "active" AND verified';
const testAst = parseOrThrow(testQuery);

printMemory([
	measureMemory("parse", 1000, () => parse(testQuery)),
	measureMemory("parse + toSQL", 1000, () => {
		const r = parse(testQuery);
		if (r.success) toSQL(r.ast);
	}),
	measureMemory("toSQL only", 1000, () => toSQL(testAst)),
]);

const parseTime = measureTime(() => parse(testQuery));
const convertTime = measureTime(() => toSQL(testAst));
const totalTime = measureTime(() => {
	const r = parse(testQuery);
	if (r.success) toSQL(r.ast);
});

printOverhead("toSQL", parseTime, convertTime, totalTime);

await run();
