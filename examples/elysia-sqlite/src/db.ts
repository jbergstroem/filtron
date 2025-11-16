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
