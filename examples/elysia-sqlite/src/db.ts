/**
 * Database module for SQLite operations
 * Uses Bun's built-in SQLite driver
 */

import { Database } from "bun:sqlite";
import type { SQLResult } from "@filtron/sql";

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
	verified: boolean;
	created_at: string;
}

/**
 * Database instance (in-memory)
 */
export const db = new Database(":memory:");

/**
 * Initialize the database schema
 */
export function initDatabase(): void {
	// Enable foreign keys
	db.exec("PRAGMA foreign_keys = ON");

	// Create users table
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

	// Create indexes for commonly filtered fields
	db.exec("CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)");
	db.exec("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)");
	db.exec("CREATE INDEX IF NOT EXISTS idx_users_age ON users(age)");
	db.exec("CREATE INDEX IF NOT EXISTS idx_users_verified ON users(verified)");
}

/**
 * Clear all data from the database
 */
export function clearDatabase(): void {
	db.exec("DELETE FROM users");
}

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
	const query = db.query<User, unknown[]>(sql);
	return query.all(...sqlResult.params);
}

/**
 * Count total users
 */
export function countUsers(): number {
	const query = db.query<{ count: number }, []>(
		"SELECT COUNT(*) as count FROM users",
	);
	return query.get()?.count ?? 0;
}

/**
 * Count users with Filtron filtering
 */
export function countFilteredUsers(sqlResult: SQLResult): number {
	const sql = `SELECT COUNT(*) as count FROM users WHERE ${sqlResult.sql}`;
	const query = db.query<{ count: number }, unknown[]>(sql);
	return query.get(...sqlResult.params)?.count ?? 0;
}

/**
 * Insert a new user
 */
export function insertUser(
	user: Omit<User, "id" | "created_at">,
): User | null {
	const query = db.query<
		User,
		[string, string, number, string, string, number]
	>(`
    INSERT INTO users (name, email, age, status, role, verified)
    VALUES (?, ?, ?, ?, ?, ?)
    RETURNING *
  `);

	return query.get(
		user.name,
		user.email,
		user.age,
		user.status,
		user.role,
		user.verified ? 1 : 0,
	);
}

/**
 * Get user by ID
 */
export function getUserById(id: number): User | null {
	const query = db.query<User, [number]>("SELECT * FROM users WHERE id = ?");
	return query.get(id);
}

/**
 * Update user
 */
export function updateUser(
	id: number,
	updates: Partial<Omit<User, "id" | "created_at">>,
): User | null {
	const fields: string[] = [];
	const values: unknown[] = [];

	if (updates.name !== undefined) {
		fields.push("name = ?");
		values.push(updates.name);
	}
	if (updates.email !== undefined) {
		fields.push("email = ?");
		values.push(updates.email);
	}
	if (updates.age !== undefined) {
		fields.push("age = ?");
		values.push(updates.age);
	}
	if (updates.status !== undefined) {
		fields.push("status = ?");
		values.push(updates.status);
	}
	if (updates.role !== undefined) {
		fields.push("role = ?");
		values.push(updates.role);
	}
	if (updates.verified !== undefined) {
		fields.push("verified = ?");
		values.push(updates.verified ? 1 : 0);
	}

	if (fields.length === 0) {
		return getUserById(id);
	}

	values.push(id);

	const sql = `UPDATE users SET ${fields.join(", ")} WHERE id = ? RETURNING *`;
	const query = db.query<User, unknown[]>(sql);
	return query.get(...values);
}

/**
 * Delete user
 */
export function deleteUser(id: number): boolean {
	const query = db.query<never, [number]>("DELETE FROM users WHERE id = ?");
	query.run(id);
	return db.changes > 0;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
	db.close();
}