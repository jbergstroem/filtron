/**
 * Performance benchmark for Filtron parser using mitata
 *
 * Run with: bun bench
 */

import { heapStats } from "bun:jsc";
import { bench, group, run, do_not_optimize } from "mitata";
import { parse } from "./dist/index";

// Simple queries - single operations
group("Simple Queries", () => {
	bench("$query", function* (state) {
		const query = state.get("query");
		yield {
			[0]() {
				return query;
			},
			bench(q) {
				return do_not_optimize(parse(q));
			},
		};
	})
		.args("query", [
			"age > 18",
			'status = "active"',
			"verified",
			"email?",
			"NOT suspended",
		])
		.gc("inner");
});

// Medium queries - 2-3 conditions
group("Medium Queries", () => {
	bench("$query", function* (state) {
		const query = state.get("query");
		yield {
			[0]() {
				return query;
			},
			bench(q) {
				return do_not_optimize(parse(q));
			},
		};
	})
		.args("query", [
			'status = "active" AND age >= 18',
			"verified AND premium AND age > 21",
			'role = "admin" OR role = "moderator" OR role = "user"',
			'status : ["pending", "approved", "active"]',
			"user.profile.age >= 18 AND user.verified = true",
			"email? AND verified = true AND age > 18",
		])
		.gc("inner");
});

// Complex queries - nested, 5+ conditions
group("Complex Queries", () => {
	bench("$query", function* (state) {
		const query = state.get("query");
		yield {
			[0]() {
				return query;
			},
			bench(q) {
				return do_not_optimize(parse(q));
			},
		};
	})
		.args("query", [
			'(role = "admin" OR role = "moderator") AND status = "active" AND age >= 18',
			'status : ["active", "pending"] AND role : ["admin", "moderator", "user"] AND verified',
			"(a = 1 AND (b = 2 OR c = 3)) AND (d = 4 OR (e = 5 AND f = 6))",
			'email? AND verified = true AND status : ["active", "premium"] AND user.age >= 18 AND NOT suspended',
			'(user.role = "admin" AND permissions.write) OR (user.role = "moderator" AND permissions.moderate)',
		])
		.gc("inner");
});

// Run benchmarks with mitata recommended settings
await run({
	units: false, // Don't show units in results
	silent: false,
	avg: true,
	json: false,
	colors: true,
	min_max: true,
	collect: true,
	percentiles: true,
});

// Memory analysis
console.log("\n" + "=".repeat(60));
console.log("💾 MEMORY ANALYSIS");
console.log("=".repeat(60));

// Get initial heap stats
const heapBefore = heapStats();
console.log("\n📈 Initial Heap Stats:");
console.log(`   Heap Size:     ${(heapBefore.heapSize / 1024).toFixed(2)} KB`);
console.log(
	`   Heap Capacity: ${(heapBefore.heapCapacity / 1024).toFixed(2)} KB`,
);
console.log(`   Objects:       ${heapBefore.objectCount.toLocaleString()}`);

// Perform a batch of parses
console.log("\n🔄 Parsing 10,000 queries...");
const queries = [
	"age > 18",
	'status = "active" AND verified',
	"email? OR phone?",
	'role : ["admin", "user"]',
	"NOT suspended",
	"(a = 1 OR b = 2) AND c = 3",
	"user.profile.verified = true",
	'status : ["pending", "active"] AND age >= 18',
];

const startTime = Bun.nanoseconds();
for (let i = 0; i < 10000; i++) {
	const query = queries[i % queries.length];
	parse(query);
}
const endTime = Bun.nanoseconds();
const totalMs = (endTime - startTime) / 1_000_000;

console.log(`   ✅ Completed in ${totalMs.toFixed(2)}ms`);
console.log(`   ⚡ Average: ${(totalMs / 10000).toFixed(3)}ms per parse`);
console.log(
	`   🚀 Throughput: ${Math.floor(10000 / (totalMs / 1000)).toLocaleString()} parses/sec`,
);

// Get heap stats after parsing
const heapAfter = heapStats();
console.log("\n📊 Heap Stats After Parsing:");
console.log(`   Heap Size:     ${(heapAfter.heapSize / 1024).toFixed(2)} KB`);
console.log(
	`   Heap Capacity: ${(heapAfter.heapCapacity / 1024).toFixed(2)} KB`,
);
console.log(`   Objects:       ${heapAfter.objectCount.toLocaleString()}`);

// Calculate deltas
const heapDelta = heapAfter.heapSize - heapBefore.heapSize;
const objectDelta = heapAfter.objectCount - heapBefore.objectCount;

console.log("\n📉 Memory Delta:");
console.log(`   Heap Growth:   ${(heapDelta / 1024).toFixed(2)} KB`);
console.log(
	`   Object Delta:  ${objectDelta > 0 ? "+" : ""}${objectDelta.toLocaleString()}`,
);

// Force GC and check again
console.log("\n♻️  Running garbage collection...");
Bun.gc(true);
const heapAfterGC = heapStats();

console.log("\n📊 Heap Stats After GC:");
console.log(`   Heap Size:     ${(heapAfterGC.heapSize / 1024).toFixed(2)} KB`);
console.log(
	`   Heap Capacity: ${(heapAfterGC.heapCapacity / 1024).toFixed(2)} KB`,
);
console.log(`   Objects:       ${heapAfterGC.objectCount.toLocaleString()}`);

const freedBytes = heapAfter.heapSize - heapAfterGC.heapSize;
const freedObjects = heapAfter.objectCount - heapAfterGC.objectCount;

console.log("\n♻️  Garbage Collection Impact:");
console.log(`   Memory Freed:  ${(freedBytes / 1024).toFixed(2)} KB`);
console.log(`   Objects Freed: ${freedObjects.toLocaleString()}`);
