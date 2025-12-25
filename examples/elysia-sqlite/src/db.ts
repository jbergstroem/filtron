/**
 * Database module for SQLite operations
 * Uses Bun's built-in SQLite driver
 */

import type { SQLResult } from "@filtron/sql";
import { faker } from "@faker-js/faker";
import { Database } from "bun:sqlite";

/**
 * User model interface
 */
export interface User {
	id: number;
	name: string;
	email: string;
	age: number;
	status: string;
	role: string;
	verified: number;
	created_at: string;
}

/**
 * Database instance (in-memory)
 */
export const db = new Database(":memory:");

/**
 * Get all users without filtering
 */
export function getAllUsers(): User[] {
	const query = db.query<User, []>("SELECT * FROM users ORDER BY id");
	return query.all();
}

/**
 * Get users with Filtron filtering
 */
export function getFilteredUsers(sqlResult: SQLResult): User[] {
	const sql = `SELECT * FROM users WHERE ${sqlResult.sql} ORDER BY id`;
	const query = db.query<User, any[]>(sql);
	return query.all(...sqlResult.params);
}

/**
 * Count total users
 */
export function countUsers(): number {
	const query = db.query<{ count: number }, []>("SELECT COUNT(*) as count FROM users");
	return query.get()?.count ?? 0;
}

const SEED = 12345;

/**
 * Generate sample users using Faker
 */
function generateUsers(count: number) {
	faker.seed(SEED);

	const statuses = ["active", "inactive", "pending", "suspended"];
	const roles = ["admin", "moderator", "user"];

	const users = [];

	for (let i = 0; i < count; i++) {
		// Bias towards active users and regular users
		const status = i < count * 0.6 ? "active" : faker.helpers.arrayElement(statuses);
		const role = i < 3 ? "admin" : i < 6 ? "moderator" : faker.helpers.arrayElement(roles);
		const verified = faker.datatype.boolean({ probability: 0.7 }) ? 1 : 0;

		users.push({
			name: faker.person.fullName(),
			email: faker.internet.email().toLowerCase(),
			age: faker.number.int({ min: 18, max: 65 }),
			status,
			role,
			verified,
		});
	}

	return users;
}

/**
 * Initialize database and seed with data
 */
export function seedDatabase(db: Database, count: number = 500): void {
	db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      age INTEGER NOT NULL,
      status TEXT NOT NULL,
      role TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

	db.exec("CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)");
	db.exec("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)");
	db.exec("CREATE INDEX IF NOT EXISTS idx_users_age ON users(age)");
	db.exec("CREATE INDEX IF NOT EXISTS idx_users_verified ON users(verified)");

	// Check if already seeded
	const result = db.query<{ count: number }, []>("SELECT COUNT(*) as count FROM users").get();
	if (result && result.count > 0) {
		return;
	}

	// Generate and insert users
	const users = generateUsers(count);
	const insertStmt = db.prepare(
		"INSERT INTO users (name, email, age, status, role, verified) VALUES (?, ?, ?, ?, ?, ?)",
	);

	for (const user of users) {
		insertStmt.run(user.name, user.email, user.age, user.status, user.role, user.verified);
	}
}

// Run seed if called directly (useful for testing seed logic)
if (import.meta.main) {
	const db = new Database(":memory:");
	seedDatabase(db);
	console.log("✓ In-memory database seeded successfully");
	db.close();
}
