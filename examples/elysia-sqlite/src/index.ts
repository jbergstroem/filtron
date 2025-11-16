/**
 * Main Elysia application
 * Demonstrates dynamic filtering using Filtron query language with Elysia and SQLite
 */

import { Elysia } from "elysia";
import { parse } from "@filtron/core";
import { toSQL } from "@filtron/sql";
import {
	db,
	getAllUsers,
	getFilteredUsers,
	countUsers,
	countFilteredUsers,
} from "./db";
import { seedDatabase } from "./seed";

/**
 * Initialize database and seed on startup if empty
 */
seedDatabase(db);

/**
 * Create Elysia app with filtering API
 */
export const app = new Elysia()
	// List users with optional filtering
	.get("/users", ({ query, set }) => {
		try {
			const filterQuery = query.filter as string | undefined;

			// If no filter, return all users
			if (!filterQuery) {
				const users = getAllUsers();
				return {
					success: true,
					data: users,
					count: users.length,
					total: countUsers(),
					filter: null,
				};
			}

			// Parse Filtron query
			const parseResult = parse(filterQuery);

			if (!parseResult.success) {
				set.status = 400;
				return {
					success: false,
					error: "Invalid filter query",
					message: parseResult.message,
					details: parseResult.error,
					hint: 'Example: ?filter=age > 30 or ?filter=status = "active"',
				};
			}

			// Convert AST to SQL
			const sqlResult = toSQL(parseResult.ast, {
				parameterStyle: "question", // SQLite uses ? placeholders
			});

			// Execute query
			const users = getFilteredUsers(sqlResult);

			return {
				success: true,
				data: users,
				count: users.length,
				total: countUsers(),
				filter: {
					query: filterQuery,
					sql: sqlResult.sql,
					params: sqlResult.params,
				},
			};
		} catch (error) {
			set.status = 500;
			return {
				success: false,
				error: "Internal server error",
				message: error instanceof Error ? error.message : String(error),
			};
		}
	}).listen(3000);
