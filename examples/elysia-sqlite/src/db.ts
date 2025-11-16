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
