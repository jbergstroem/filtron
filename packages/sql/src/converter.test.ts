import { describe, expect, test } from "bun:test";
import type { ASTNode } from "@filtron/core";
import { toSQL, contains, prefix, suffix } from "./converter";

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
			expect(result.params).toEqual(["%john%"]);
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
				children: [
					{
						type: "comparison",
						field: "age",
						operator: ">",
						value: { type: "number", value: 18 },
					},
					{
						type: "comparison",
						field: "status",
						operator: "=",
						value: { type: "string", value: "active" },
					},
				],
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("age > $1 AND status = $2");
			expect(result.params).toEqual([18, "active"]);
		});

		test("AND chain renders flat", () => {
			const ast: ASTNode = {
				type: "and",
				children: [
					{ type: "booleanField", field: "verified" },
					{ type: "booleanField", field: "premium" },
					{
						type: "comparison",
						field: "age",
						operator: ">",
						value: { type: "number", value: 21 },
					},
				],
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("verified = $1 AND premium = $2 AND age > $3");
			expect(result.params).toEqual([true, true, 21]);
		});

		test("OR expression", () => {
			const ast: ASTNode = {
				type: "or",
				children: [
					{
						type: "comparison",
						field: "role",
						operator: "=",
						value: { type: "string", value: "admin" },
					},
					{
						type: "comparison",
						field: "role",
						operator: "=",
						value: { type: "string", value: "moderator" },
					},
				],
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("role = $1 OR role = $2");
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
			expect(result.sql).toBe("NOT suspended = $1");
			expect(result.params).toEqual([true]);
		});

		test("complex nested expression", () => {
			const ast: ASTNode = {
				type: "and",
				children: [
					{
						type: "or",
						children: [
							{
								type: "comparison",
								field: "role",
								operator: "=",
								value: { type: "string", value: "admin" },
							},
							{
								type: "comparison",
								field: "role",
								operator: "=",
								value: { type: "string", value: "moderator" },
							},
						],
					},
					{
						type: "comparison",
						field: "status",
						operator: "=",
						value: { type: "string", value: "active" },
					},
				],
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("(role = $1 OR role = $2) AND status = $3");
			expect(result.params).toEqual(["admin", "moderator", "active"]);
		});
	});

	describe("Range Expressions", () => {
		test("basic integer range", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "age",
				operator: "=",
				value: { type: "range", kind: "number", min: 18, max: 65 },
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("age BETWEEN $1 AND $2");
			expect(result.params).toEqual([18, 65]);
		});

		test("float range", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "price",
				operator: "=",
				value: { type: "range", kind: "number", min: 9.99, max: 99.99 },
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("price BETWEEN $1 AND $2");
			expect(result.params).toEqual([9.99, 99.99]);
		});

		test("negative number range", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "temperature",
				operator: "=",
				value: { type: "range", kind: "number", min: -20, max: 40 },
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("temperature BETWEEN $1 AND $2");
			expect(result.params).toEqual([-20, 40]);
		});

		test("negated range uses NOT BETWEEN", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "age",
				operator: "!=",
				value: { type: "range", kind: "number", min: 18, max: 65 },
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("age NOT BETWEEN $1 AND $2");
			expect(result.params).toEqual([18, 65]);
		});

		test("range with colon operator uses BETWEEN", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "age",
				operator: ":",
				value: { type: "range", kind: "number", min: 18, max: 65 },
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("age BETWEEN $1 AND $2");
		});

		test("range with an ordering operator throws", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "age",
				operator: ">",
				value: { type: "range", kind: "number", min: 18, max: 65 },
			};

			expect(() => toSQL(ast)).toThrow("Range values require the =, : or != operator");
		});

		test("range value outside a comparison throws", () => {
			const ast: ASTNode = {
				type: "oneOf",
				field: "age",
				negated: false,
				values: [{ type: "range", kind: "number", min: 1, max: 2 }],
			};

			expect(() => toSQL(ast)).toThrow("Range values cannot be used here");
		});

		test("range with field mapper", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "user.age",
				operator: "=",
				value: { type: "range", kind: "number", min: 18, max: 65 },
			};

			const result = toSQL(ast, {
				fieldMapper: (field) => `t.${field}`,
			});

			expect(result.sql).toBe("t.user.age BETWEEN $1 AND $2");
			expect(result.params).toEqual([18, 65]);
		});
	});

	describe("Temporal Values", () => {
		test("date comparison parameterizes the ISO string", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "created",
				operator: ">",
				value: { type: "date", value: "2024-06-01" },
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("created > $1");
			expect(result.params).toEqual(["2024-06-01"]);
		});

		test("date equality and datetime values", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "created",
				operator: "=",
				value: { type: "date", value: "2024-06-01T14:30:00Z" },
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("created = $1");
			expect(result.params).toEqual(["2024-06-01T14:30:00Z"]);
		});

		test("temporal range uses BETWEEN with ISO parameters", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "created",
				operator: "=",
				value: {
					type: "range",
					kind: "temporal",
					min: { type: "date", value: "2024-06-01" },
					max: { type: "date", value: "2024-06-30" },
				},
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("created BETWEEN $1 AND $2");
			expect(result.params).toEqual(["2024-06-01", "2024-06-30"]);
		});

		test("negated temporal range uses NOT BETWEEN", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "created",
				operator: "!=",
				value: {
					type: "range",
					kind: "temporal",
					min: { type: "date", value: "2024-06-01" },
					max: { type: "date", value: "2024-06-30" },
				},
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("created NOT BETWEEN $1 AND $2");
			expect(result.params).toEqual(["2024-06-01", "2024-06-30"]);
		});

		test("contains operator against a date throws", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "created",
				operator: "~",
				value: { type: "date", value: "2024-06-01" },
			};
			expect(() => toSQL(ast)).toThrow("Temporal values cannot be used with the ~ operator");
		});

		test("unresolved now values throw", () => {
			const point: ASTNode = {
				type: "comparison",
				field: "created",
				operator: ">",
				value: { type: "now", offset: { amount: -7, unit: "d" } },
			};
			expect(() => toSQL(point)).toThrow("Unresolved relative time value");

			const range: ASTNode = {
				type: "comparison",
				field: "created",
				operator: "=",
				value: {
					type: "range",
					kind: "temporal",
					min: { type: "now", offset: null },
					max: { type: "date", value: "2024-06-30" },
				},
			};
			expect(() => toSQL(range)).toThrow("Unresolved relative time value");
		});

		test("temporal values in membership arrays throw", () => {
			const ast: ASTNode = {
				type: "oneOf",
				field: "created",
				negated: false,
				values: [{ type: "now", offset: null }],
			};
			expect(() => toSQL(ast)).toThrow("Temporal values cannot be used here");
		});
	});

	describe("One-of Expressions", () => {
		test("oneOf with multiple values", () => {
			const ast: ASTNode = {
				type: "oneOf",
				negated: false,
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
				negated: false,
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
				negated: false,
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
				negated: false,
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
				type: "oneOf",
				negated: true,
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
				type: "oneOf",
				negated: true,
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
				negated: false,
				field: "email",
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("email IS NOT NULL");
			expect(result.params).toEqual([]);
		});

		test("nested field exists", () => {
			const ast: ASTNode = {
				type: "exists",
				negated: false,
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
				children: [
					{
						type: "booleanField",
						field: "verified",
					},
					{
						type: "booleanField",
						field: "premium",
					},
				],
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("verified = $1 AND premium = $2");
			expect(result.params).toEqual([true, true]);
		});
	});

	describe("Parameter Styles", () => {
		test("numbered parameters (PostgreSQL style)", () => {
			const ast: ASTNode = {
				type: "and",
				children: [
					{
						type: "comparison",
						field: "age",
						operator: ">",
						value: { type: "number", value: 18 },
					},
					{
						type: "comparison",
						field: "status",
						operator: "=",
						value: { type: "string", value: "active" },
					},
				],
			};

			const result = toSQL(ast, { parameterStyle: "numbered" });
			expect(result.sql).toBe("age > $1 AND status = $2");
			expect(result.params).toEqual([18, "active"]);
		});

		test("question mark parameters (MySQL/SQLite style)", () => {
			const ast: ASTNode = {
				type: "and",
				children: [
					{
						type: "comparison",
						field: "age",
						operator: ">",
						value: { type: "number", value: 18 },
					},
					{
						type: "comparison",
						field: "status",
						operator: "=",
						value: { type: "string", value: "active" },
					},
				],
			};

			const result = toSQL(ast, { parameterStyle: "question" });
			expect(result.sql).toBe("age > ? AND status = ?");
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

		test("numbered parameters beyond the precomputed table", () => {
			const ast: ASTNode = {
				type: "oneOf",
				negated: false,
				field: "id",
				values: Array.from({ length: 70 }, (_, i) => ({
					type: "number" as const,
					value: i,
				})),
			};

			const result = toSQL(ast);
			expect(result.sql).toContain("$1,");
			expect(result.sql).toContain("$70");
			expect(result.params).toHaveLength(70);
		});
	});

	describe("Dialect Presets", () => {
		const ast: ASTNode = {
			type: "comparison",
			field: "age",
			operator: ">",
			value: { type: "number", value: 18 },
		};

		test("postgres uses numbered parameters", () => {
			const result = toSQL(ast, { dialect: "postgres" });
			expect(result.sql).toBe("age > $1");
			expect(result.params).toEqual([18]);
		});

		test("mysql uses question mark parameters", () => {
			const result = toSQL(ast, { dialect: "mysql" });
			expect(result.sql).toBe("age > ?");
			expect(result.params).toEqual([18]);
		});

		test("unknown dialect throws instead of silently defaulting", () => {
			expect(() => toSQL(ast, { dialect: "oracle" as never })).toThrow("Unknown dialect: oracle");
			expect(() => toSQL(ast, { dialect: null as never })).toThrow("Unknown dialect: null");
		});

		test("sqlite uses question mark parameters", () => {
			const result = toSQL(ast, { dialect: "sqlite" });
			expect(result.sql).toBe("age > ?");
			expect(result.params).toEqual([18]);
		});

		test("explicit parameterStyle overrides the dialect preset", () => {
			const result = toSQL(ast, { dialect: "mysql", parameterStyle: "numbered" });
			expect(result.sql).toBe("age > $1");
			expect(result.params).toEqual([18]);
		});

		test("no dialect keeps the numbered default", () => {
			const result = toSQL(ast, {});
			expect(result.sql).toBe("age > $1");
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
				children: [
					{
						type: "comparison",
						field: "age",
						operator: ">",
						value: { type: "number", value: 18 },
					},
					{
						type: "oneOf",
						negated: false,
						field: "status",
						values: [
							{ type: "string", value: "active" },
							{ type: "string", value: "pending" },
						],
					},
				],
			};

			const result = toSQL(ast, {
				fieldMapper: (field) => `t.${field}`,
			});

			expect(result.sql).toBe("t.age > $1 AND t.status IN ($2, $3)");
			expect(result.params).toEqual([18, "active", "pending"]);
		});
	});

	describe("Allowed Fields", () => {
		test("allows listed fields", () => {
			const ast: ASTNode = {
				type: "and",
				children: [
					{
						type: "comparison",
						field: "age",
						operator: ">",
						value: { type: "number", value: 18 },
					},
					{
						type: "comparison",
						field: "status",
						operator: "=",
						value: { type: "string", value: "active" },
					},
				],
			};

			const result = toSQL(ast, { allowedFields: ["age", "status"] });
			expect(result.sql).toBe("age > $1 AND status = $2");
			expect(result.params).toEqual([18, "active"]);
		});

		test("throws for unlisted field in a hand-built AST", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: 'password" = "" OR "1',
				operator: "=",
				value: { type: "string", value: "secret" },
			};

			expect(() => toSQL(ast, { allowedFields: ["age", "status"] })).toThrow(
				'Field "password" = "" OR "1" is not allowed. Allowed fields: age, status',
			);
		});
	});

	describe("LIKE Value Mapping", () => {
		test("default likeMode wraps LIKE values for contains matching", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "name",
				operator: "~",
				value: { type: "string", value: "an" },
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("name LIKE $1");
			expect(result.params).toEqual(["%an%"]);
		});

		test("default likeMode escapes LIKE metacharacters", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "name",
				operator: "~",
				value: { type: "string", value: "100%" },
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("name LIKE $1");
			expect(result.params).toEqual(["%100\\%%"]);
		});

		test("likeMode 'raw' passes the value through untouched", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "name",
				operator: "~",
				value: { type: "string", value: "100%" },
			};

			const result = toSQL(ast, { likeMode: "raw" });
			expect(result.sql).toBe("name LIKE $1");
			expect(result.params).toEqual(["100%"]);
		});

		test("likeMode 'contains' can be set explicitly", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "name",
				operator: "~",
				value: { type: "string", value: "john" },
			};

			const result = toSQL(ast, { likeMode: "contains" });
			expect(result.sql).toBe("name LIKE $1");
			expect(result.params).toEqual(["%john%"]);
		});

		test("valueMapper takes precedence over likeMode", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "name",
				operator: "~",
				value: { type: "string", value: "john" },
			};

			const result = toSQL(ast, {
				likeMode: "raw",
				valueMapper: prefix,
			});

			expect(result.sql).toBe("name LIKE $1");
			expect(result.params).toEqual(["john%"]);
		});

		test("likeMode does not affect the equals operator", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "name",
				operator: "=",
				value: { type: "string", value: "100%" },
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("name = $1");
			expect(result.params).toEqual(["100%"]);
		});

		test("valueMapper is applied to LIKE operator", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "description",
				operator: "~",
				value: { type: "string", value: "50% off" },
			};

			const result = toSQL(ast, {
				valueMapper: contains,
			});

			expect(result.sql).toBe("description LIKE $1");
			expect(result.params).toEqual(["%50\\% off%"]);
		});

		test("valueMapper is NOT applied to equals operator", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "name",
				operator: "=",
				value: { type: "string", value: "john" },
			};

			const result = toSQL(ast, {
				valueMapper: (value) => `%${value}%`,
			});

			expect(result.sql).toBe("name = $1");
			expect(result.params).toEqual(["john"]);
		});

		test("using contains helper", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "name",
				operator: "~",
				value: { type: "string", value: "john" },
			};

			const result = toSQL(ast, {
				valueMapper: contains,
			});

			expect(result.sql).toBe("name LIKE $1");
			expect(result.params).toEqual(["%john%"]);
		});

		test("using prefix helper", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "username",
				operator: "~",
				value: { type: "string", value: "admin" },
			};

			const result = toSQL(ast, {
				valueMapper: prefix,
			});

			expect(result.sql).toBe("username LIKE $1");
			expect(result.params).toEqual(["admin%"]);
		});

		test("using suffix helper", () => {
			const ast: ASTNode = {
				type: "comparison",
				field: "filename",
				operator: "~",
				value: { type: "string", value: ".pdf" },
			};

			const result = toSQL(ast, {
				valueMapper: suffix,
			});

			expect(result.sql).toBe("filename LIKE $1");
			expect(result.params).toEqual(["%.pdf"]);
		});

		test("valueMapper with multiple LIKE conditions", () => {
			const ast: ASTNode = {
				type: "and",
				children: [
					{
						type: "comparison",
						field: "firstName",
						operator: "~",
						value: { type: "string", value: "john" },
					},
					{
						type: "comparison",
						field: "lastName",
						operator: "~",
						value: { type: "string", value: "doe" },
					},
				],
			};

			const result = toSQL(ast, {
				valueMapper: contains,
			});

			expect(result.sql).toBe("firstName LIKE $1 AND lastName LIKE $2");
			expect(result.params).toEqual(["%john%", "%doe%"]);
		});
	});

	describe("Complex Real-world Queries", () => {
		test("user filtering query", () => {
			// age >= 18 AND verified AND (role = "admin" OR role = "moderator")
			const ast: ASTNode = {
				type: "and",
				children: [
					{
						type: "comparison",
						field: "age",
						operator: ">=",
						value: { type: "number", value: 18 },
					},
					{
						type: "booleanField",
						field: "verified",
					},
					{
						type: "or",
						children: [
							{
								type: "comparison",
								field: "role",
								operator: "=",
								value: { type: "string", value: "admin" },
							},
							{
								type: "comparison",
								field: "role",
								operator: "=",
								value: { type: "string", value: "moderator" },
							},
						],
					},
				],
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("age >= $1 AND verified = $2 AND (role = $3 OR role = $4)");
			expect(result.params).toEqual([18, true, "admin", "moderator"]);
		});

		test("product search query", () => {
			const ast: ASTNode = {
				type: "and",
				children: [
					{
						type: "comparison",
						field: "price",
						operator: "<=",
						value: { type: "number", value: 100 },
					},
					{
						type: "comparison",
						field: "name",
						operator: "~",
						value: { type: "string", value: "laptop" },
					},
					{
						type: "oneOf",
						negated: false,
						field: "category",
						values: [
							{ type: "string", value: "electronics" },
							{ type: "string", value: "computers" },
						],
					},
				],
			};

			const result = toSQL(ast, { parameterStyle: "question" });
			expect(result.sql).toBe("price <= ? AND name LIKE ? AND category IN (?, ?)");
			expect(result.params).toEqual([100, "%laptop%", "electronics", "computers"]);
		});

		test("nested NOT with complex conditions", () => {
			const ast: ASTNode = {
				type: "and",
				children: [
					{
						type: "comparison",
						field: "status",
						operator: "=",
						value: { type: "string", value: "active" },
					},
					{
						type: "not",
						expression: {
							type: "or",
							children: [
								{
									type: "booleanField",
									field: "suspended",
								},
								{
									type: "booleanField",
									field: "deleted",
								},
							],
						},
					},
				],
			};

			const result = toSQL(ast);
			expect(result.sql).toBe("status = $1 AND NOT (suspended = $2 OR deleted = $3)");
			expect(result.params).toEqual(["active", true, true]);
		});
	});
});
