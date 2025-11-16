import { describe, expect, test } from "bun:test";
import type { ASTNode } from "@filtron/core";
import { toSQL } from "./converter";

describe("SQL", () => {
	describe("Comparison Expressions", () => {
		test("equals operator", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "status",
				operator: "=",
				value: { type: "string", value: "active" },
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("status = $1");
			expect(result.params).toEqual(["active"]);
		});

		test("colon operator (equals)", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "status",
				operator: ":",
				value: { type: "string", value: "active" },
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("status = $1");
			expect(result.params).toEqual(["active"]);
		});

		test("not equals operator", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "role",
				operator: "!=",
				value: { type: "string", value: "guest" },
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("role != $1");
			expect(result.params).toEqual(["guest"]);
		});

		test("greater than operator", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "age",
				operator: ">",
				value: { type: "number", value: 18 },
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("age > $1");
			expect(result.params).toEqual([18]);
		});

		test("greater than or equal operator", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "score",
				operator: ">=",
				value: { type: "number", value: 4.5 },
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("score >= $1");
			expect(result.params).toEqual([4.5]);
		});

		test("less than operator", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "count",
				operator: "<",
				value: { type: "number", value: 100 },
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("count < $1");
			expect(result.params).toEqual([100]);
		});

		test("less than or equal operator", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "priority",
				operator: "<=",
				value: { type: "number", value: 5 },
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("priority <= $1");
			expect(result.params).toEqual([5]);
		});

		test("contains operator (LIKE)", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "name",
				operator: "~",
				value: { type: "string", value: "john" },
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("name LIKE $1");
			expect(result.params).toEqual(["john"]);
		});

		test("boolean value", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "active",
				operator: "=",
				value: { type: "boolean", value: true },
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("active = $1");
			expect(result.params).toEqual([true]);
		});

		test("identifier value", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "status",
				operator: "=",
				value: { type: "identifier", value: "pending" },
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("status = $1");
			expect(result.params).toEqual(["pending"]);
		});
	});

	describe("Boolean Expressions", () => {
		test("AND expression", () => {
			const ast: ASTNode = {
				type: "and",
				left: {
					type: "comparison",
					field: "age",
					operator: ">",
					value: { type: "number", value: 18 },
				},
				right: {
					type: "comparison",
					field: "status",
					operator: "=",
					value: { type: "string", value: "active" },
				},
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("(age > $1 AND status = $2)");
			expect(result.params).toEqual([18, "active"]);
		});

		test("OR expression", () => {
			const ast: ASTNode = {
				type: "or",
				left: {
					type: "comparison",
					field: "role",
					operator: "=",
					value: { type: "string", value: "admin" },
				},
				right: {
					type: "comparison",
					field: "role",
					operator: "=",
					value: { type: "string", value: "moderator" },
				},
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("(role = $1 OR role = $2)");
			expect(result.params).toEqual(["admin", "moderator"]);
		});

		test("NOT expression", () => {
			const ast: ASTNode = {
				type: "not",
				expression: {
					type: "comparison",
					field: "suspended",
					operator: "=",
					value: { type: "boolean", value: true },
				},
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("NOT (suspended = $1)");
			expect(result.params).toEqual([true]);
		});

		test("complex nested expression", () => {
			const ast: ASTNode = {
				type: "and",
				left: {
					type: "or",
					left: {
						type: "comparison",
						field: "role",
						operator: "=",
						value: { type: "string", value: "admin" },
					},
					right: {
						type: "comparison",
						field: "role",
						operator: "=",
						value: { type: "string", value: "moderator" },
					},
				},
				right: {
					type: "comparison",
					field: "status",
					operator: "=",
					value: { type: "string", value: "active" },
				},
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("((role = $1 OR role = $2) AND status = $3)");
			expect(result.params).toEqual(["admin", "moderator", "active"]);
		});
	});

	describe("One-of Expressions", () => {
		test("oneOf with multiple values", () => {
			const ast: ASTNode = {
				type: "oneOf",
				field: "status",
				values: [
					{ type: "string", value: "pending" },
					{ type: "string", value: "approved" },
					{ type: "string", value: "active" },
				],
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("status IN ($1, $2, $3)");
			expect(result.params).toEqual(["pending", "approved", "active"]);
		});

		test("oneOf with single value", () => {
			const ast: ASTNode = {
				type: "oneOf",
				field: "role",
				values: [{ type: "string", value: "admin" }],
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("role IN ($1)");
			expect(result.params).toEqual(["admin"]);
		});

		test("oneOf with empty array", () => {
			const ast: ASTNode = {
				type: "oneOf",
				field: "status",
				values: [],
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("1 = 0"); // Always false
			expect(result.params).toEqual([]);
		});

		test("oneOf with numbers", () => {
			const ast: ASTNode = {
				type: "oneOf",
				field: "priority",
				values: [
					{ type: "number", value: 1 },
					{ type: "number", value: 2 },
					{ type: "number", value: 3 },
				],
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("priority IN ($1, $2, $3)");
			expect(result.params).toEqual([1, 2, 3]);
		});

		test("notOneOf with multiple values", () => {
			const ast: ASTNode = {
				type: "notOneOf",
				field: "status",
				values: [
					{ type: "string", value: "inactive" },
					{ type: "string", value: "deleted" },
				],
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("status NOT IN ($1, $2)");
			expect(result.params).toEqual(["inactive", "deleted"]);
		});

		test("notOneOf with empty array", () => {
			const ast: ASTNode = {
				type: "notOneOf",
				field: "status",
				values: [],
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("1 = 1"); // Always true
			expect(result.params).toEqual([]);
		});
	});

	describe("Exists Expressions", () => {
		test("exists expression", () => {
			const ast: ASTNode = {
				type: "exists",
				field: "email",
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("email IS NOT NULL");
			expect(result.params).toEqual([]);
		});

		test("nested field exists", () => {
			const ast: ASTNode = {
				type: "exists",
				field: "user.profile.avatar",
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("user.profile.avatar IS NOT NULL");
			expect(result.params).toEqual([]);
		});
	});

	describe("Boolean Field Expressions", () => {
		test("boolean field expression", () => {
			const ast: ASTNode = {
				type: "booleanField",
				field: "verified",
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("verified = $1");
			expect(result.params).toEqual([true]);
		});

		test("boolean field with AND", () => {
			const ast: ASTNode = {
				type: "and",
				left: {
					type: "booleanField",
					field: "verified",
				},
				right: {
					type: "booleanField",
					field: "premium",
				},
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("(verified = $1 AND premium = $2)");
			expect(result.params).toEqual([true, true]);
		});
	});

	describe("Parameter Styles", () => {
		test("numbered parameters (PostgreSQL style)", () => {
			const ast: ASTNode = {
				type: "and",
				left: {
					type: "comparison",
					field: "age",
					operator: ">",
					value: { type: "number", value: 18 },
				},
				right: {
					type: "comparison",
					field: "status",
					operator: "=",
					value: { type: "string", value: "active" },
				},
			};

			const result = toSQL(ast, { parameterStyle: "numbered" });
			expect(result.sql).toBe("(age > $1 AND status = $2)");
			expect(result.params).toEqual([18, "active"]);
		});

		test("question mark parameters (MySQL/SQLite style)", () => {
			const ast: ASTNode = {
				type: "and",
				left: {
					type: "comparison",
					field: "age",
					operator: ">",
					value: { type: "number", value: 18 },
				},
				right: {
					type: "comparison",
					field: "status",
					operator: "=",
					value: { type: "string", value: "active" },
				},
			};

			const result = toSQL(ast, { parameterStyle: "question" });
			expect(result.sql).toBe("(age > ? AND status = ?)");
			expect(result.params).toEqual([18, "active"]);
		});

		test("custom start index", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "age",
				operator: ">",
				value: { type: "number", value: 18 },
			};

			const result = toSQL(ast, { startIndex: 5 });
			expect(result.sql).toBe("age > $5");
			expect(result.params).toEqual([18]);
		});
	});

	describe("Field Mapping", () => {
		test("custom field mapper", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "userName",
				operator: "=",
				value: { type: "string", value: "john" },
			};

			const result = toSQL(ast, {
				fieldMapper: (field) => `users.${field}`,
			});

			expect(result.sql).toBe("users.userName = $1");
			expect(result.params).toEqual(["john"]);
		});

		test("field mapper with escaping", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "user-name",
				operator: "=",
				value: { type: "string", value: "john" },
			};

			const result = toSQL(ast, {
				fieldMapper: (field) => `"${field}"`,
			});

			expect(result.sql).toBe('"user-name" = $1');
			expect(result.params).toEqual(["john"]);
		});

		test("field mapper with complex nested expression", () => {
			const ast: ASTNode = {
				type: "and",
				left: {
					type: "comparison",
					field: "age",
					operator: ">",
					value: { type: "number", value: 18 },
				},
				right: {
					type: "oneOf",
					field: "status",
					values: [
						{ type: "string", value: "active" },
						{ type: "string", value: "pending" },
					],
				},
			};

			const result = toSQL(ast, {
				fieldMapper: (field) => `t.${field}`,
			});

			expect(result.sql).toBe("(t.age > $1 AND t.status IN ($2, $3))");
			expect(result.params).toEqual([18, "active", "pending"]);
		});
	});

	describe("Complex Real-world Queries", () => {
		test("user filtering query", () => {
			const ast: ASTNode = {
				type: "and",
				left: {
					type: "and",
					left: {
						type: "comparison",
						field: "age",
						operator: ">=",
						value: { type: "number", value: 18 },
					},
					right: {
						type: "booleanField",
						field: "verified",
					},
				},
				right: {
					type: "or",
					left: {
						type: "comparison",
						field: "role",
						operator: "=",
						value: { type: "string", value: "admin" },
					},
					right: {
						type: "comparison",
						field: "role",
						operator: "=",
						value: { type: "string", value: "moderator" },
					},
				},
			};

			const result = toSQL(ast);
			expect(result.sql).toBe(
				"((age >= $1 AND verified = $2) AND (role = $3 OR role = $4))",
			);
			expect(result.params).toEqual([18, true, "admin", "moderator"]);
		});

		test("product search query", () => {
			const ast: ASTNode = {
				type: "and",
				left: {
					type: "and",
					left: {
						type: "comparison",
						field: "price",
						operator: "<=",
						value: { type: "number", value: 100 },
					},
					right: {
						type: "comparison",
						field: "name",
						operator: "~",
						value: { type: "string", value: "laptop" },
					},
				},
				right: {
					type: "oneOf",
					field: "category",
					values: [
						{ type: "string", value: "electronics" },
						{ type: "string", value: "computers" },
					],
				},
			};

			const result = toSQL(ast, { parameterStyle: "question" });
			expect(result.sql).toBe(
				"((price <= ? AND name LIKE ?) AND category IN (?, ?))",
			);
			expect(result.params).toEqual([
				100,
				"laptop",
				"electronics",
				"computers",
			]);
		});

		test("nested NOT with complex conditions", () => {
			const ast: ASTNode = {
				type: "and",
				left: {
					type: "comparison",
					field: "status",
					operator: "=",
					value: { type: "string", value: "active" },
				},
				right: {
					type: "not",
					expression: {
						type: "or",
						left: {
							type: "booleanField",
							field: "suspended",
						},
						right: {
							type: "booleanField",
							field: "deleted",
						},
					},
				},
			};

			const result = toSQL(ast);
			expect(result.sql).toBe(
				"(status = $1 AND NOT ((suspended = $2 OR deleted = $3)))",
			);
			expect(result.params).toEqual(["active", true, true]);
		});
	});
});
