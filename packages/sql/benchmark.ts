/**
 * Performance benchmark for @filtron/sql
 * Measures overhead of converting Filtron AST to SQL
 *
 * Run with: bun run benchmark.ts
 */

import { parse, parseOrThrow } from "@filtron/core";
import { heapStats } from "bun:jsc";
import { bench, group, run } from "mitata";
import { toSQL } from "./index.js";

console.log("=== @filtron/sql Benchmark Suite ===\n");
console.log("Measuring overhead of AST → SQL conversion\n");

// Helper to prevent optimization
function doNotOptimize(value: unknown) {
	if (Math.random() > 2) {
		console.log(value);
	}
	return value;
}

// ============================================================================
// Simple Queries - Baseline vs With SQL Conversion
// ============================================================================

group("Simple Queries - Overhead Analysis", () => {
	const queries = ["age > 18", 'status = "active"', "verified", "email?", "NOT suspended"];

	for (const query of queries) {
		bench(`parse only: ${query}`, () => {
			const result = parse(query);
			return doNotOptimize(result);
		});

		bench(`parse + toSQL: ${query}`, () => {
			const result = parse(query);
			if (result.success) {
				const sql = toSQL(result.ast);
				return doNotOptimize(sql);
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

		bench(`parse + toSQL: ${query.substring(0, 40)}...`, () => {
			const result = parse(query);
			if (result.success) {
				const sql = toSQL(result.ast);
				return doNotOptimize(sql);
			}
			return result;
		});
	}
});

// ============================================================================
// SQL Conversion Only - Isolated Overhead
// ============================================================================

group("SQL Conversion Only (Pre-parsed AST)", () => {
	// Pre-parse queries to measure just SQL conversion
	const asts = {
		simple: parseOrThrow("age > 18"),
		comparison: parseOrThrow('status = "active"'),
		boolean: parseOrThrow("age > 18 AND verified"),
		complex: parseOrThrow('(role = "admin" OR role = "moderator") AND verified'),
		oneOf: parseOrThrow('status : ["pending", "approved", "active"]'),
		nested: parseOrThrow('(age > 18 AND verified) OR (role = "admin" AND NOT suspended)'),
	};

	bench("toSQL: simple comparison", () => {
		return doNotOptimize(toSQL(asts.simple));
	});

	bench("toSQL: string comparison", () => {
		return doNotOptimize(toSQL(asts.comparison));
	});

	bench("toSQL: AND expression", () => {
		return doNotOptimize(toSQL(asts.boolean));
	});

	bench("toSQL: complex OR/AND", () => {
		return doNotOptimize(toSQL(asts.complex));
	});

	bench("toSQL: IN clause", () => {
		return doNotOptimize(toSQL(asts.oneOf));
	});

	bench("toSQL: deeply nested", () => {
		return doNotOptimize(toSQL(asts.nested));
	});
});

// ============================================================================
// Parameter Styles - Performance Impact
// ============================================================================

group("Parameter Styles", () => {
	const ast = parseOrThrow('age > 18 AND status = "active" AND role : ["user", "admin"]');

	bench("numbered ($1, $2, $3)", () => {
		return doNotOptimize(toSQL(ast, { parameterStyle: "numbered" }));
	});

	bench("question (?, ?, ?)", () => {
		return doNotOptimize(toSQL(ast, { parameterStyle: "question" }));
	});
});

// ============================================================================
// Field Mapping - Performance Impact
// ============================================================================

group("Field Mapping Overhead", () => {
	const ast = parseOrThrow('age > 18 AND status = "active" AND verified');

	bench("no field mapper", () => {
		return doNotOptimize(toSQL(ast));
	});

	bench("simple field mapper (table prefix)", () => {
		return doNotOptimize(
			toSQL(ast, {
				fieldMapper: (field) => `users.${field}`,
			}),
		);
	});

	bench("complex field mapper (escaping)", () => {
		return doNotOptimize(
			toSQL(ast, {
				fieldMapper: (field) => `"${field.toUpperCase()}"`,
			}),
		);
	});
});

// ============================================================================
// Throughput Test - End-to-End
// ============================================================================

group("Throughput - Parse + SQL Generation", () => {
	const queries = {
		simple: "age > 18",
		moderate: 'age > 18 AND status = "active"',
		complex: '(role = "admin" OR role = "moderator") AND verified AND age >= 21',
	};

	bench("simple query", () => {
		const result = parse(queries.simple);
		if (result.success) {
			return doNotOptimize(toSQL(result.ast));
		}
		return result;
	});

	bench("moderate query", () => {
		const result = parse(queries.moderate);
		if (result.success) {
			return doNotOptimize(toSQL(result.ast));
		}
		return result;
	});

	bench("complex query", () => {
		const result = parse(queries.complex);
		if (result.success) {
			return doNotOptimize(toSQL(result.ast));
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

measureMemory("Parse + toSQL", 1000, () => {
	const result = parse(testQuery);
	if (result.success) {
		toSQL(result.ast);
	}
});

measureMemory("toSQL only (pre-parsed)", 1000, () => {
	toSQL(testAst);
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

const parseAndSQLTime = measureTime(() => {
	const result = parse(testQuery);
	if (result.success) {
		toSQL(result.ast);
	}
}, iterations);

const sqlOnlyTime = measureTime(() => {
	toSQL(testAst);
}, iterations);

console.log(`Parse only:          ${(parseOnlyTime * 1000).toFixed(3)} μs`);
console.log(`Parse + toSQL:       ${(parseAndSQLTime * 1000).toFixed(3)} μs`);
console.log(`toSQL only:          ${(sqlOnlyTime * 1000).toFixed(3)} μs`);
console.log(
	`\nOverhead:            ${(sqlOnlyTime * 1000).toFixed(3)} μs (${((sqlOnlyTime / parseOnlyTime) * 100).toFixed(1)}% of parse time)`,
);
console.log(
	`Total time:          ${(parseAndSQLTime * 1000).toFixed(3)} μs (${((parseAndSQLTime / parseOnlyTime) * 100).toFixed(1)}% of parse time)`,
);

const throughputParseOnly = 1000 / parseOnlyTime;
const throughputParseAndSQL = 1000 / parseAndSQLTime;

console.log(`\nThroughput (parse):  ${Math.round(throughputParseOnly).toLocaleString()} ops/sec`);
console.log(`Throughput (+ SQL):  ${Math.round(throughputParseAndSQL).toLocaleString()} ops/sec`);

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
console.log(`- SQL conversion adds ~${(sqlOnlyTime * 1000).toFixed(1)}μs overhead per query`);
console.log(`- This is ~${((sqlOnlyTime / parseOnlyTime) * 100).toFixed(0)}% of the parse time`);
console.log(
	`- Total throughput: ${Math.round(throughputParseAndSQL).toLocaleString()} queries/sec (parse + SQL)`,
);
