/**
 * Performance benchmark for @filtron/core
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

// Memory analysis
const testQuery = 'age > 18 AND status = "active" AND verified';
printMemory([measureMemory("parse", 1000, () => parse(testQuery))]);

// Throughput
const parseTime = measureTime(() => parse(testQuery));
console.log(`\nThroughput: ${Math.round(1000 / parseTime).toLocaleString()} ops/sec`);

await run();
