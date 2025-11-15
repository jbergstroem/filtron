/**
 * Integration example showing complete filtron + @filtron/sql workflow
 * Run with: bun run examples/integration.ts
 */

import { parse, parseOrThrow } from "@filtron/core";
import { toSQL } from "../index.js";

// Simulated database interface (represents postgres, mysql, sqlite, etc.)
interface Database {
	query(sql: string, params: unknown[]): Promise<unknown[]>;
}

// Mock database for demonstration
const mockDb: Database = {
	async query(sql: string, params: unknown[]) {
		console.log(`  [DB] SELECT * FROM users WHERE ${sql}`);
		console.log(`  [DB] Params: ${JSON.stringify(params)}`);
		return [
			{ id: 1, name: "Alice", age: 25, role: "admin", verified: true },
			{ id: 2, name: "Bob", age: 30, role: "user", verified: true },
		];
	},
};

console.log("=== Filtron + SQL Integration Examples ===\n");

// Example 1: Basic API filtering endpoint
console.log("1. API Filtering Endpoint:");
console.log("   Simulating: GET /users?filter=age > 18 AND verified\n");

async function getUsersEndpoint(filterQuery: string) {
	try {
		// Parse the filter query
		const ast = parseOrThrow(filterQuery);

		// Convert to SQL
		const { sql, params } = toSQL(ast, {
			fieldMapper: (field) => `users.${field}`,
			parameterStyle: "numbered",
		});

		// Execute database query
		const users = await mockDb.query(sql, params);

		return { success: true, data: users };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

const result1 = await getUsersEndpoint("age > 18 AND verified");
console.log(`  Result: ${JSON.stringify(result1.success)}\n`);

// Example 2: Multi-database support (PostgreSQL vs MySQL)
console.log("2. Multi-Database Support:\n");

const query2 = 'role : ["admin", "moderator"] AND NOT suspended';
const ast2 = parseOrThrow(query2);

console.log("   PostgreSQL:");
const pgResult = toSQL(ast2, { parameterStyle: "numbered" });
console.log(`   SQL:    ${pgResult.sql}`);
console.log(`   Params: ${JSON.stringify(pgResult.params)}\n`);

console.log("   MySQL/SQLite:");
const mysqlResult = toSQL(ast2, { parameterStyle: "question" });
console.log(`   SQL:    ${mysqlResult.sql}`);
console.log(`   Params: ${JSON.stringify(mysqlResult.params)}\n`);

// Example 3: Complex search with error handling
console.log("3. Search with Error Handling:\n");

async function searchUsers(userInput: string) {
	console.log(`   User input: "${userInput}"`);

	const parseResult = parse(userInput);

	if (!parseResult.success) {
		console.log(`   ❌ Invalid query: ${parseResult.error.split("\n")[0]}`);
		return { error: "Invalid filter syntax" };
	}

	const { sql, params } = toSQL(parseResult.ast, {
		fieldMapper: (field) => `u.${field}`,
	});

	console.log(`   ✓ Valid SQL: ${sql}`);
	console.log(`   ✓ Params: ${JSON.stringify(params)}`);

	return { sql, params };
}

await searchUsers('age >= 21 AND status = "active"');
console.log();
await searchUsers("age >= AND status"); // Invalid
console.log();

// Example 4: Dynamic query building with pagination
console.log("4. Dynamic Query Building with Pagination:\n");

interface QueryOptions {
	filter?: string;
	page?: number;
	limit?: number;
}

async function getPaginatedUsers(options: QueryOptions) {
	const { filter, page = 1, limit = 10 } = options;

	let whereClause = "1 = 1"; // Default: return all
	let params: unknown[] = [];

	if (filter) {
		const ast = parseOrThrow(filter);
		const result = toSQL(ast, {
			startIndex: 1, // Start params at $1
		});
		whereClause = result.sql;
		params = result.params;
	}

	// Add pagination params
	const offset = (page - 1) * limit;
	params.push(limit, offset);

	const sql = `SELECT * FROM users WHERE ${whereClause} LIMIT $${params.length - 1} OFFSET $${params.length}`;

	console.log(`   Query: ${sql}`);
	console.log(`   Params: ${JSON.stringify(params)}`);

	return { sql, params };
}

await getPaginatedUsers({
	filter: "verified AND age >= 18",
	page: 2,
	limit: 20,
});
console.log();

// Example 5: Field whitelisting for security
console.log("5. Field Whitelisting (Security):\n");

const ALLOWED_FIELDS = new Set(["name", "age", "role", "verified", "status"]);

function secureFieldMapper(field: string): string {
	// Remove any nested field access for this example
	const baseField = field.split(".")[0];

	if (!ALLOWED_FIELDS.has(baseField)) {
		throw new Error(`Field "${field}" is not allowed in queries`);
	}

	// Escape field name
	return `"${baseField}"`;
}

try {
	const safeQuery = "age > 18 AND role = admin";
	const safeAst = parseOrThrow(safeQuery);
	const safeResult = toSQL(safeAst, {
		fieldMapper: secureFieldMapper,
		parameterStyle: "question",
	});
	console.log(`   ✓ Safe query: ${safeResult.sql}`);
	console.log(`   ✓ Params: ${JSON.stringify(safeResult.params)}`);
} catch (error) {
	console.log(`   ❌ ${error instanceof Error ? error.message : error}`);
}
console.log();

// Example 6: Combining base filters with user filters
console.log("6. Combining Base Filters + User Filters:\n");

async function getFilteredData(
	baseFilter: string,
	userFilter?: string,
): Promise<{ sql: string; params: unknown[] }> {
	// Base filter is always applied (e.g., tenant isolation, soft deletes)
	const baseAst = parseOrThrow(baseFilter);
	const baseResult = toSQL(baseAst, { startIndex: 1 });

	if (!userFilter) {
		return baseResult;
	}

	// User filter is optional
	const userAst = parseOrThrow(userFilter);
	const userResult = toSQL(userAst, {
		startIndex: baseResult.params.length + 1,
	});

	// Combine both filters with AND
	const combinedSql = `(${baseResult.sql}) AND (${userResult.sql})`;
	const combinedParams = [...baseResult.params, ...userResult.params];

	return { sql: combinedSql, params: combinedParams };
}

const combined = await getFilteredData(
	"tenant_id = 123 AND deleted = false", // Base: always applied
	'role = "admin" OR role = "moderator"', // User: optional
);

console.log(`   Combined SQL: ${combined.sql}`);
console.log(`   Params: ${JSON.stringify(combined.params)}\n`);

// Example 7: Real-world API controller pattern
console.log("7. API Controller Pattern:\n");

class UserController {
	constructor(private db: Database) {}

	async list(req: { query: { filter?: string } }) {
		try {
			const filterQuery = req.query.filter;

			if (!filterQuery) {
				// No filter - return all (with appropriate defaults)
				const users = await this.db.query("status = $1", ["active"]);
				return { success: true, data: users };
			}

			// Parse and validate filter
			const parseResult = parse(filterQuery);
			if (!parseResult.success) {
				return {
					success: false,
					error: "Invalid filter syntax",
					details: parseResult.error,
				};
			}

			// Convert to SQL
			const { sql, params } = toSQL(parseResult.ast, {
				fieldMapper: (field) => `users.${field}`,
				parameterStyle: "numbered",
			});

			// Add default filters
			const fullSql = `(${sql}) AND users.status = $${params.length + 1}`;
			const fullParams = [...params, "active"];

			// Execute query
			const users = await this.db.query(fullSql, fullParams);

			return { success: true, data: users };
		} catch (error) {
			console.error("Error in UserController.list:", error);
			return { success: false, error: "Internal server error" };
		}
	}
}

const controller = new UserController(mockDb);
const apiResult = await controller.list({
	query: { filter: "age >= 18 AND verified" },
});
console.log(
	`   API Response: ${JSON.stringify({ success: apiResult.success, recordCount: Array.isArray(apiResult.data) ? apiResult.data.length : 0 })}\n`,
);

// Example 8: Performance considerations
console.log("8. Performance Considerations:\n");

console.log("   Parsing and converting 1000 queries:");
const iterations = 1000;
const testQuery = 'age > 18 AND role = "user" AND verified';

const startTime = performance.now();
for (let i = 0; i < iterations; i++) {
	const ast = parseOrThrow(testQuery);
	toSQL(ast);
}
const endTime = performance.now();
const totalTime = endTime - startTime;
const avgTime = totalTime / iterations;

console.log(`   Total time: ${totalTime.toFixed(2)}ms`);
console.log(`   Average: ${avgTime.toFixed(3)}ms per query`);
console.log(`   Throughput: ${(1000 / avgTime).toFixed(0)} queries/sec\n`);

console.log("=== Integration Examples Complete ===");
console.log(
	"\nKey Takeaways:",
	"\n- Always validate user input with parse() before converting to SQL",
	"\n- Use field whitelisting to prevent unauthorized field access",
	"\n- Parameterized queries prevent SQL injection",
	"\n- Combine base filters with user filters for tenant isolation",
	"\n- Performance is excellent for real-time API usage",
);
