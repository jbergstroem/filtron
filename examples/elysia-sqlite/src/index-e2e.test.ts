/**
 * E2E tests for the Elysia + SQLite + Filtron API
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db, seedDatabase } from "./db";
import { app } from "./index";

const BASE_URL = `http://localhost:3000`;

let server: ReturnType<typeof app.listen>;

beforeAll(async () => {
	seedDatabase(db, 500);
	server = app.listen(3000);
	await new Promise((resolve) => setTimeout(resolve, 100));
});

afterAll(async () => {
	if (server) {
		await server.stop();
	}
});

describe("Elysia E2E Tests", () => {
	test("should get all users without filter", async () => {
		const response = await fetch(`${BASE_URL}/users`);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.data).toBeArray();
		expect(data.count).toBe(500);
		expect(data.total).toBe(500);
		expect(data.filter).toBeNull();
	});

	test("should filter by status", async () => {
		const response = await fetch(
			`${BASE_URL}/users?filter=${encodeURIComponent('status = "active"')}`,
		);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.data.every((u: any) => u.status === "active")).toBe(true);
	});

	test("should filter with AND operator", async () => {
		const response = await fetch(
			`${BASE_URL}/users?filter=${encodeURIComponent('status = "active" AND verified')}`,
		);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(
			data.data.every((u: any) => u.status === "active" && u.verified),
		).toBe(true);
	});

	test("should filter with one-of operator", async () => {
		const response = await fetch(
			`${BASE_URL}/users?filter=${encodeURIComponent('role:["admin","moderator"]')}`,
		);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(
			data.data.every((u: any) => u.role === "admin" || u.role === "moderator"),
		).toBe(true);
	});

	test("should filter with comparison operators", async () => {
		const response1 = await fetch(
			`${BASE_URL}/users?filter=${encodeURIComponent("age >= 30")}`,
		);
		const data1 = await response1.json();
		expect(data1.data.every((u: any) => u.age >= 30)).toBe(true);

		const response2 = await fetch(
			`${BASE_URL}/users?filter=${encodeURIComponent("age < 30")}`,
		);
		const data2 = await response2.json();
		expect(data2.data.every((u: any) => u.age < 30)).toBe(true);
	});

	test("should filter with range query", async () => {
		const response = await fetch(
			`${BASE_URL}/users?filter=${encodeURIComponent("age >= 30 AND age <= 40")}`,
		);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.data.every((u: any) => u.age >= 30 && u.age <= 40)).toBe(true);
	});

	test("should filter with contains operator", async () => {
		const response = await fetch(
			`${BASE_URL}/users?filter=${encodeURIComponent('name ~ "%a%"')}`,
		);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.count).toBeGreaterThan(0);
	});

	test("should filter with complex nested query", async () => {
		const response = await fetch(
			`${BASE_URL}/users?filter=${encodeURIComponent("(age < 25 OR age > 50) AND verified")}`,
		);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(
			data.data.every((u: any) => (u.age < 25 || u.age > 50) && u.verified),
		).toBe(true);
	});

	test("should handle invalid filter syntax", async () => {
		const response = await fetch(
			`${BASE_URL}/users?filter=${encodeURIComponent("age >> 30")}`,
		);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBeDefined();
	});

	test("should return filter metadata", async () => {
		const response = await fetch(
			`${BASE_URL}/users?filter=${encodeURIComponent('age > 25 AND status = "active"')}`,
		);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.filter).toBeDefined();
		expect(data.filter.query).toBe('age > 25 AND status = "active"');
		expect(data.filter.sql).toContain("age");
		expect(data.filter.sql).toContain("status");
		expect(data.filter.params).toEqual([25, "active"]);
	});
});