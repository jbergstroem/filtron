/**
 * Benchmark script for Elysia + Filtron request lifecycle
 * Measures each phase: request handling, parsing, SQL generation, database query, response
 */

import { Database } from "bun:sqlite";
import { formatTime } from "@filtron/benchmark";
import { parse } from "@filtron/core";
import type { SQLResult } from "@filtron/sql";
import { toSQL } from "@filtron/sql";
import { Elysia } from "elysia";
import { seedDatabase } from "./src/db";

interface User {
	id: number;
	name: string;
	email: string;
	age: number;
	status: string;
	role: string;
	verified: number;
	created_at: string;
}

// Sample queries to benchmark
const queries = [
	'status = "active"',
	'role : ["admin", "moderator"]',
	'(role = "admin" OR role = "moderator") AND age > 25',
];

const WARMUP_RUNS = 50;
const BENCH_RUNS = 500;

async function benchmark() {
	// Create and seed database
	const db = new Database(":memory:");
	seedDatabase(db, 500);

	const getFilteredUsers = (sqlResult: SQLResult): User[] => {
		const sql = `SELECT * FROM users WHERE ${sqlResult.sql} ORDER BY id`;
		const query = db.query<User, (string | number | boolean | null)[]>(sql);
		return query.all(...(sqlResult.params as (string | number | boolean | null)[]));
	};

	const getAllUsers = (): User[] => {
		const query = db.query<User, []>("SELECT * FROM users ORDER BY id");
		return query.all();
	};

	// Create a minimal Elysia app for benchmarking
	const app = new Elysia().get("/users", ({ query }) => {
		const filterQuery = query.filter as string | undefined;

		if (!filterQuery) {
			return { data: getAllUsers() };
		}

		const parseResult = parse(filterQuery);
		if (!parseResult.success) {
			return { error: "Invalid query" };
		}

		const sqlResult = toSQL(parseResult.ast, { parameterStyle: "question" });
		const users = getFilteredUsers(sqlResult);
		return { data: users };
	});

	// Start server
	const server = app.listen(0);
	const port = server.server?.port;
	const baseUrl = `http://localhost:${port}`;

	console.log("Elysia + SQLite Full Request Lifecycle Benchmark");
	console.log("=".repeat(65));
	console.log(`Database: 500 users, ${BENCH_RUNS} iterations per query\n`);

	// Benchmark each query via HTTP
	for (const filterQuery of queries) {
		const url = `${baseUrl}/users?filter=${encodeURIComponent(filterQuery)}`;

		// Warmup - sequential requests are intentional for consistent timing
		for (let i = 0; i < WARMUP_RUNS; i++) {
			await fetch(url); // eslint-disable-line no-await-in-loop
		}

		// Benchmark full HTTP request - sequential for accurate per-request timing
		let httpTotal = 0;
		for (let i = 0; i < BENCH_RUNS; i++) {
			const start = performance.now();
			await fetch(url); // eslint-disable-line no-await-in-loop
			httpTotal += performance.now() - start;
		}
		const httpAvg = httpTotal / BENCH_RUNS; // ms

		// Benchmark individual components (without HTTP overhead)
		let parseTotal = 0;
		let sqlTotal = 0;
		let dbTotal = 0;

		for (let i = 0; i < BENCH_RUNS; i++) {
			const parseStart = performance.now();
			const parseResult = parse(filterQuery);
			parseTotal += performance.now() - parseStart;

			if (!parseResult.success) continue;

			const sqlStart = performance.now();
			const sqlResult = toSQL(parseResult.ast, { parameterStyle: "question" });
			sqlTotal += performance.now() - sqlStart;

			const dbStart = performance.now();
			getFilteredUsers(sqlResult);
			dbTotal += performance.now() - dbStart;
		}

		const parseAvg = parseTotal / BENCH_RUNS; // ms
		const sqlAvg = sqlTotal / BENCH_RUNS; // ms
		const dbAvg = dbTotal / BENCH_RUNS; // ms
		const filtronTotal = parseAvg + sqlAvg;

		// Elysia overhead = HTTP total - measured work (parse + sql + db)
		const elysiaOverhead = httpAvg - filtronTotal - dbAvg;

		console.log(`Query: ${filterQuery}`);
		console.log(`  HTTP request:   ${formatTime(httpAvg)} (full round-trip)`);
		console.log(`  ├─ Elysia:      ${formatTime(elysiaOverhead)}`);
		console.log(`  ├─ Parse:       ${formatTime(parseAvg)}`);
		console.log(`  ├─ SQL gen:     ${formatTime(sqlAvg)}`);
		console.log(`  ├─ Database:    ${formatTime(dbAvg)}`);
		console.log(
			`  Filtron total:  ${formatTime(filtronTotal)} (${((filtronTotal / httpAvg) * 100).toFixed(1)}% of request)`,
		);
		console.log();
	}

	await server.stop();
	db.close();
}

void benchmark();
