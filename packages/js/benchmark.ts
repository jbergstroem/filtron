/**
 * Performance benchmark for @filtron/js
 * Measures overhead of converting Filtron AST to filter predicates
 *
 * Run with: bun run benchmark.ts
 */

import { parse, parseOrThrow } from "@filtron/core";
import { heapStats } from "bun:jsc";
import { bench, group, run } from "mitata";
import { toFilter, nestedAccessor } from "./index.js";

console.log("=== @filtron/js Benchmark Suite ===\n");
console.log("Measuring overhead of AST → Filter predicate conversion\n");

// Helper to prevent optimization
function doNotOptimize(value: unknown) {
	if (Math.random() > 2) {
		console.log(value);
	}
	return value;
}

// ============================================================================
// Simple Queries - Baseline vs With Filter Creation
// ============================================================================

group("Simple Queries - Overhead Analysis", () => {
	const queries = ["age > 18", 'status = "active"', "verified", "email?", "NOT suspended"];

	for (const query of queries) {
		bench(`parse only: ${query}`, () => {
			const result = parse(query);
			return doNotOptimize(result);
		});

		bench(`parse + toFilter: ${query}`, () => {
			const result = parse(query);
			if (result.success) {
				const filter = toFilter(result.ast);
				return doNotOptimize(filter);
			}
			return result;
		});
	}
});

// ============================================================================
// Complex Queries - Real-world Overhead
// ============================================================================

group("Complex Queries - Overhead Analysis", () => {
	const complexQueries = [
		'age > 18 AND status = "active"',
		'(role = "admin" OR role = "moderator") AND verified',
		'age >= 21 AND verified AND role : ["user", "premium"]',
		'status : ["pending", "approved", "active"] AND NOT suspended',
		'(age > 18 AND verified) OR (role = "admin" AND NOT suspended)',
	];

	for (const query of complexQueries) {
		bench(`parse only: ${query.substring(0, 40)}...`, () => {
			const result = parse(query);
			return doNotOptimize(result);
		});

		bench(`parse + toFilter: ${query.substring(0, 40)}...`, () => {
			const result = parse(query);
			if (result.success) {
				const filter = toFilter(result.ast);
				return doNotOptimize(filter);
			}
			return result;
		});
	}
});

// ============================================================================
// Filter Creation Only - Isolated Overhead
// ============================================================================

group("Filter Creation Only (Pre-parsed AST)", () => {
	// Pre-parse queries to measure just filter conversion
	const asts = {
		simple: parseOrThrow("age > 18"),
		comparison: parseOrThrow('status = "active"'),
		boolean: parseOrThrow("age > 18 AND verified"),
		complex: parseOrThrow('(role = "admin" OR role = "moderator") AND verified'),
		oneOf: parseOrThrow('status : ["pending", "approved", "active"]'),
		nested: parseOrThrow('(age > 18 AND verified) OR (role = "admin" AND NOT suspended)'),
	};

	bench("toFilter: simple comparison", () => {
		return doNotOptimize(toFilter(asts.simple));
	});

	bench("toFilter: string comparison", () => {
		return doNotOptimize(toFilter(asts.comparison));
	});

	bench("toFilter: AND expression", () => {
		return doNotOptimize(toFilter(asts.boolean));
	});

	bench("toFilter: complex OR/AND", () => {
		return doNotOptimize(toFilter(asts.complex));
	});

	bench("toFilter: oneOf clause", () => {
		return doNotOptimize(toFilter(asts.oneOf));
	});

	bench("toFilter: deeply nested", () => {
		return doNotOptimize(toFilter(asts.nested));
	});
});

// ============================================================================
// Options - Performance Impact
// ============================================================================

group("Options Overhead", () => {
	const ast = parseOrThrow('age > 18 AND status = "active"');

	bench("no options", () => {
		return doNotOptimize(toFilter(ast));
	});

	bench("with caseInsensitive", () => {
		return doNotOptimize(toFilter(ast, { caseInsensitive: true }));
	});

	bench("with allowedFields", () => {
		return doNotOptimize(toFilter(ast, { allowedFields: ["age", "status", "verified"] }));
	});

	bench("with fieldMapping", () => {
		return doNotOptimize(
			toFilter(ast, {
				fieldMapping: { age: "userAge", status: "userStatus" },
			}),
		);
	});

	bench("with nestedAccessor", () => {
		return doNotOptimize(
			toFilter(ast, {
				fieldAccessor: nestedAccessor(),
			}),
		);
	});
});

// ============================================================================
// Throughput Test - End-to-End
// ============================================================================

group("Throughput - Parse + Filter Creation", () => {
	const queries = {
		simple: "age > 18",
		moderate: 'age > 18 AND status = "active"',
		complex: '(role = "admin" OR role = "moderator") AND verified AND age >= 21',
	};

	bench("simple query", () => {
		const result = parse(queries.simple);
		if (result.success) {
			return doNotOptimize(toFilter(result.ast));
		}
		return result;
	});

	bench("moderate query", () => {
		const result = parse(queries.moderate);
		if (result.success) {
			return doNotOptimize(toFilter(result.ast));
		}
		return result;
	});

	bench("complex query", () => {
		const result = parse(queries.complex);
		if (result.success) {
			return doNotOptimize(toFilter(result.ast));
		}
		return result;
	});
});

// ============================================================================
// Memory Usage Analysis
// ============================================================================

console.log("\n--- Memory Usage Analysis ---\n");

function measureMemory(label: string, iterations: number, fn: () => void) {
	if (global.gc) {
		global.gc();
	}

	const before = heapStats();

	for (let i = 0; i < iterations; i++) {
		fn();
	}

	if (global.gc) {
		global.gc();
	}

	const after = heapStats();
	const avgBytes = (after.heapSize - before.heapSize) / iterations;

	console.log(`${label.padEnd(40)} ${(avgBytes / 1024).toFixed(2)} KB per operation`);
}

const testQuery = 'age > 18 AND status = "active" AND verified';
const testAst = parseOrThrow(testQuery);

measureMemory("Parse only", 1000, () => {
	parse(testQuery);
});

measureMemory("Parse + toFilter", 1000, () => {
	const result = parse(testQuery);
	if (result.success) {
		toFilter(result.ast);
	}
});

measureMemory("toFilter only (pre-parsed)", 1000, () => {
	toFilter(testAst);
});

// ============================================================================
// Overhead Calculation
// ============================================================================

console.log("\n--- Overhead Calculation ---\n");

function measureTime(fn: () => void, iterations: number): number {
	const start = performance.now();
	for (let i = 0; i < iterations; i++) {
		fn();
	}
	const end = performance.now();
	return (end - start) / iterations;
}

const iterations = 10000;

const parseOnlyTime = measureTime(() => {
	parse(testQuery);
}, iterations);

const parseAndFilterTime = measureTime(() => {
	const result = parse(testQuery);
	if (result.success) {
		toFilter(result.ast);
	}
}, iterations);

const filterOnlyTime = measureTime(() => {
	toFilter(testAst);
}, iterations);

console.log(`Parse only:          ${(parseOnlyTime * 1000).toFixed(3)} μs`);
console.log(`Parse + toFilter:    ${(parseAndFilterTime * 1000).toFixed(3)} μs`);
console.log(`toFilter only:       ${(filterOnlyTime * 1000).toFixed(3)} μs`);
console.log(
	`\nOverhead:            ${(filterOnlyTime * 1000).toFixed(3)} μs (${((filterOnlyTime / parseOnlyTime) * 100).toFixed(1)}% of parse time)`,
);
console.log(
	`Total time:          ${(parseAndFilterTime * 1000).toFixed(3)} μs (${((parseAndFilterTime / parseOnlyTime) * 100).toFixed(1)}% of parse time)`,
);

const throughputParseOnly = 1000 / parseOnlyTime;
const throughputParseAndFilter = 1000 / parseAndFilterTime;

console.log(`\nThroughput (parse):  ${Math.round(throughputParseOnly).toLocaleString()} ops/sec`);
console.log(
	`Throughput (+ toFilter):  ${Math.round(throughputParseAndFilter).toLocaleString()} ops/sec`,
);

// ============================================================================
// Run Benchmarks
// ============================================================================

console.log("\n--- Running Detailed Benchmarks ---\n");

await run({
	silent: false,
	avg: true,
	json: false,
	colors: true,
	min_max: true,
	collect: false,
	percentiles: true,
});

console.log("\n=== Benchmark Complete ===\n");
console.log("Summary:");
console.log(`- Filter creation adds ~${(filterOnlyTime * 1000).toFixed(1)}μs overhead per query`);
console.log(`- This is ~${((filterOnlyTime / parseOnlyTime) * 100).toFixed(0)}% of the parse time`);
console.log(
	`- Total throughput: ${Math.round(throughputParseAndFilter).toLocaleString()} queries/sec (parse + toFilter)`,
);
