/**
 * SQL Converter Benchmark Suite
 *
 * Continuous performance tracking using tinybench + CodSpeed
 * Run: bun run bench:sql
 */

import { Bench } from "tinybench";
import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { parse } from "@filtron/core";
import { toSQL } from "@filtron/sql";

const bench = withCodSpeed(
	new Bench({
		warmupIterations: 10,
		iterations: 100,
	}),
);

const simpleAST = parse("age > 18");
const mediumAST = parse('status = "active" AND age >= 18');
const complexAST = parse(
	'(role = "admin" OR role = "moderator") AND status = "active"',
);

// Validate ASTs
if (!simpleAST.success || !mediumAST.success || !complexAST.success) {
	throw new Error("Failed to parse test queries");
}

bench
	.add("sql: simple", () => {
		toSQL(simpleAST.ast);
	})
	.add("sql: medium", () => {
		toSQL(mediumAST.ast);
	})
	.add("sql: complex", () => {
		toSQL(complexAST.ast);
	});

bench
	.add("pipeline: simple end-to-end", () => {
		const result = parse("age > 18");
		if (result.success) {
			toSQL(result.ast);
		}
	})
	.add("pipeline: medium end-to-end", () => {
		const result = parse('status = "active" AND age >= 18');
		if (result.success) {
			toSQL(result.ast);
		}
	});

async function main() {
	await bench.run();

	console.table(
		bench.tasks.map(({ name, result }) => ({
			Benchmark: name,
			"ops/sec": result?.hz?.toFixed(0) || "N/A",
			"avg (µs)": result?.mean ? (result.mean * 1000000).toFixed(2) : "N/A",
		})),
	);
}

main().catch(console.error);
