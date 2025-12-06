/**
 * Performance benchmark for Filtron parser using mitata
 *
 * Run with: bun bench
 */

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
		.args("query", ["age > 18", 'status = "active"', "verified", "email?", "NOT suspended"])
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

await run({
	units: false,
	silent: false,
	avg: true,
	json: false,
	colors: true,
	min_max: true,
	collect: true,
	percentiles: true,
});
