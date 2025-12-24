/**
 * Shared benchmark utilities for local development
 * Uses mitata for detailed performance analysis
 */

import { heapStats } from "bun:jsc";

export { bench, group, run, do_not_optimize } from "mitata";

/** State object passed to generator benchmarks */
export interface BenchState {
	get(name: string): string;
}

/** Standard query sets used across all benchmarks */
export const queries: Record<"simple" | "medium" | "complex", string[]> = {
	simple: ["age > 18", 'status = "active"', "verified", "email?", "NOT suspended"],
	medium: [
		'status = "active" AND age >= 18',
		"verified AND premium AND age > 21",
		'role = "admin" OR role = "moderator"',
		'status : ["pending", "approved", "active"]',
		"user.profile.age >= 18 AND user.verified = true",
	],
	complex: [
		'(role = "admin" OR role = "moderator") AND status = "active" AND age >= 18',
		'status : ["active", "pending"] AND role : ["admin", "moderator", "user"] AND verified',
		"(a = 1 AND (b = 2 OR c = 3)) AND (d = 4 OR (e = 5 AND f = 6))",
		'email? AND verified = true AND status : ["active", "premium"] AND user.age >= 18 AND NOT suspended',
	],
};

/** Measure average memory per operation */
export function measureMemory(
	label: string,
	iterations: number,
	fn: () => void,
): { label: string; kbPerOp: number } {
	if (global.gc) global.gc();
	const before = heapStats();

	for (let i = 0; i < iterations; i++) {
		fn();
	}

	if (global.gc) global.gc();
	const after = heapStats();
	const kbPerOp = Math.max(0, (after.heapSize - before.heapSize) / iterations / 1024);

	return { label, kbPerOp };
}

/** Measure average time per operation in milliseconds */
export function measureTime(fn: () => void, iterations = 10000): number {
	const start = performance.now();
	for (let i = 0; i < iterations; i++) {
		fn();
	}
	return (performance.now() - start) / iterations;
}

/** Print memory results */
export function printMemory(results: Array<{ label: string; kbPerOp: number }>): void {
	console.log("\nMemory:");
	for (const { label, kbPerOp } of results) {
		console.log(`  ${label.padEnd(30)} ${kbPerOp.toFixed(2)} KB/op`);
	}
}

/** Print overhead summary */
export function printOverhead(
	name: string,
	parseTime: number,
	convertTime: number,
	totalTime: number,
): void {
	const overheadPct = parseTime > 0 ? ((convertTime / parseTime) * 100).toFixed(0) : "N/A";
	const throughput = Math.round(1000 / totalTime).toLocaleString();

	console.log(`\n${name}:`);
	console.log(`  parse: ${(parseTime * 1000).toFixed(1)}μs`);
	console.log(`  convert: ${(convertTime * 1000).toFixed(1)}μs (${overheadPct}% of parse)`);
	console.log(`  throughput: ${throughput} ops/sec`);
}
