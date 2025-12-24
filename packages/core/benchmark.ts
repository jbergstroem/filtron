/**
 * Performance benchmark for @filtron/core
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
import { parse } from "./dist/index.js";

group("Simple", () => {
	bench("$query", function* (state: BenchState) {
		const query = state.get("query");
		yield () => do_not_optimize(parse(query));
	}).args("query", queries.simple);
});

group("Medium", () => {
	bench("$query", function* (state: BenchState) {
		const query = state.get("query");
		yield () => do_not_optimize(parse(query));
	}).args("query", queries.medium);
});

group("Complex", () => {
	bench("$query", function* (state: BenchState) {
		const query = state.get("query");
		yield () => do_not_optimize(parse(query));
	}).args("query", queries.complex);
});

// Memory & overhead analysis
const testQuery = 'age > 18 AND status = "active" AND verified';
printMemory([measureMemory("parse", 1000, () => parse(testQuery))]);

const parseTime = measureTime(() => parse(testQuery));
printOverhead("parse", parseTime);

await run();
