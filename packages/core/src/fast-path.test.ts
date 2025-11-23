import { describe, test, expect } from "bun:test";
import {
	parseSimpleComparison,
	parseSimpleBooleanField,
	parseSimpleAnd,
	parseSimpleOr,
	parseSimpleNot,
	parseExistsQuestion,
	parseExistsKeyword,
	parseOneOf,
	parseNotOneOf,
	tryFastPath,
} from "./fast-path";
import { parse, parseOrThrow } from "./parser";

describe("Fast Path", () => {
	describe("parseSimpleComparison", () => {
		test("parses various operators and value types", () => {
			expect(parseSimpleComparison('status = "active"')).toMatchObject({
				type: "comparison",
				operator: "=",
				value: { type: "string", value: "active" },
			});

			expect(parseSimpleComparison("age > 18")).toMatchObject({
				type: "comparison",
				operator: ">",
				value: { type: "number", value: 18 },
			});

			expect(parseSimpleComparison("temperature >= -5.5")).toMatchObject({
				operator: ">=",
				value: { type: "number", value: -5.5 },
			});

			expect(parseSimpleComparison("verified != false")).toMatchObject({
				operator: "!=",
				value: { type: "boolean", value: false },
			});

			expect(parseSimpleComparison("status = pending")).toMatchObject({
				value: { type: "identifier", value: "pending" },
			});

			expect(parseSimpleComparison("user.profile.age >= 18")).toMatchObject({
				field: "user.profile.age",
			});
		});

		test("rejects invalid patterns", () => {
			expect(parseSimpleComparison("and = 1")).toBeNull(); // keyword
			expect(parseSimpleComparison('text = "hello\\"world"')).toBeNull(); // escape
			expect(parseSimpleComparison("field = ")).toBeNull(); // empty value
			expect(parseSimpleComparison("field = [1, 2]")).toBeNull(); // array
			expect(parseSimpleComparison('status : ["a"]')).toBeNull(); // oneOf pattern
		});

		test("rejects malformed strings with unescaped quotes", () => {
			expect(parseSimpleComparison('name = "hello"world"')).toBeNull(); // quote in middle
			expect(parseSimpleComparison('name = "hello" world"')).toBeNull(); // quote with space
			expect(parseSimpleComparison('text = "foo"bar"baz"')).toBeNull(); // multiple quotes
			expect(parseSimpleComparison('value = ""test""')).toBeNull(); // double quotes at start
		});
	});

	describe("parseSimpleBooleanField", () => {
		test("parses simple and dotted field names", () => {
			expect(parseSimpleBooleanField("verified")).toEqual({
				type: "booleanField",
				field: "verified",
			});

			expect(parseSimpleBooleanField("user.profile.premium")).toEqual({
				type: "booleanField",
				field: "user.profile.premium",
			});

			expect(parseSimpleBooleanField("  field_name  ")).toMatchObject({
				field: "field_name",
			});
		});

		test("rejects keywords and invalid patterns", () => {
			expect(parseSimpleBooleanField("and")).toBeNull();
			expect(parseSimpleBooleanField("OR")).toBeNull();
			expect(parseSimpleBooleanField("NOT")).toBeNull();
			expect(parseSimpleBooleanField("field = value")).toBeNull();
			expect(parseSimpleBooleanField("123field")).toBeNull();
		});
	});

	describe("parseExistsQuestion", () => {
		test("parses exists check with ?", () => {
			expect(parseExistsQuestion("email?")).toEqual({
				type: "exists",
				field: "email",
			});

			expect(parseExistsQuestion("user.profile.avatar?")).toMatchObject({
				field: "user.profile.avatar",
			});
		});

		test("rejects invalid patterns", () => {
			expect(parseExistsQuestion("and?")).toBeNull(); // keyword
			expect(parseExistsQuestion("email")).toBeNull(); // no ?
			expect(parseExistsQuestion("email? AND verified")).toBeNull(); // extra content
		});
	});

	describe("parseExistsKeyword", () => {
		test("parses exists keyword (case-insensitive)", () => {
			expect(parseExistsKeyword("email exists")).toEqual({
				type: "exists",
				field: "email",
			});

			expect(parseExistsKeyword("name EXISTS")).toMatchObject({
				field: "name",
			});

			expect(parseExistsKeyword("user.bio ExIsTs")).toMatchObject({
				field: "user.bio",
			});
		});

		test("rejects invalid patterns", () => {
			expect(parseExistsKeyword("or exists")).toBeNull();
			expect(parseExistsKeyword("email")).toBeNull();
		});
	});

	describe("parseOneOf", () => {
		test("parses oneOf with various value types", () => {
			expect(parseOneOf('status : ["active", "pending"]')).toEqual({
				type: "oneOf",
				field: "status",
				values: [
					{ type: "string", value: "active" },
					{ type: "string", value: "pending" },
				],
			});

			expect(parseOneOf("role : [1, 2, 3]")).toMatchObject({
				values: [
					{ type: "number", value: 1 },
					{ type: "number", value: 2 },
					{ type: "number", value: 3 },
				],
			});

			expect(parseOneOf('status : ["active", 1, true]')).toMatchObject({
				type: "oneOf",
			});

			expect(parseOneOf('user.role : ["admin"]')).toMatchObject({
				field: "user.role",
			});

			expect(parseOneOf('status:["active","pending"]')).toBeTruthy(); // no whitespace
		});

		test("rejects invalid patterns", () => {
			expect(parseOneOf('not : ["a", "b"]')).toBeNull(); // keyword
			expect(parseOneOf("status : []")).toBeNull(); // empty array
			expect(parseOneOf('text : ["hello\\"world"]')).toBeNull(); // escapes
		});

		test("escaped quotes fallback to full parser but parse correctly", () => {
			// Fast-path detects escapes and returns null for fallback
			expect(parseOneOf('text : ["hello\\"world", "test"]')).toBeNull();
			expect(parseOneOf('msg : ["say \\"hi\\"", "normal"]')).toBeNull();

			// Full parser handles escaped quotes correctly
			const result1 = parse('text : ["hello\\"world", "test"]');
			expect(result1.success).toBe(true);
			if (result1.success) {
				expect(result1.ast).toMatchObject({
					type: "oneOf",
					field: "text",
					values: [
						{ type: "string", value: 'hello"world' },
						{ type: "string", value: "test" },
					],
				});
			}

			// Verify the fix: arrays with escaped quotes don't split at wrong commas
			const result2 = parse('status : ["a\\"b,c", "d"]');
			expect(result2.success).toBe(true);
			if (result2.success) {
				expect(result2.ast).toMatchObject({
					values: [
						{ type: "string", value: 'a"b,c' }, // comma is inside the string
						{ type: "string", value: "d" },
					],
				});
			}
		});
	});

	describe("parseNotOneOf", () => {
		test("parses notOneOf arrays", () => {
			expect(parseNotOneOf('status !: ["banned", "deleted"]')).toEqual({
				type: "notOneOf",
				field: "status",
				values: [
					{ type: "string", value: "banned" },
					{ type: "string", value: "deleted" },
				],
			});

			expect(parseNotOneOf("role !: [0, -1]")).toMatchObject({
				type: "notOneOf",
			});
		});

		test("rejects invalid patterns", () => {
			expect(parseNotOneOf('true !: ["a"]')).toBeNull(); // keyword
			expect(parseNotOneOf("status !: []")).toBeNull(); // empty
		});
	});

	describe("parseSimpleNot", () => {
		test("parses NOT with various inner expressions", () => {
			expect(parseSimpleNot("NOT verified")).toEqual({
				type: "not",
				expression: {
					type: "booleanField",
					field: "verified",
				},
			});

			expect(parseSimpleNot('NOT status = "banned"')).toMatchObject({
				type: "not",
				expression: { type: "comparison" },
			});

			expect(parseSimpleNot("NOT email?")).toMatchObject({
				expression: { type: "exists" },
			});

			expect(parseSimpleNot('NOT status : ["active"]')).toMatchObject({
				expression: { type: "oneOf" },
			});

			expect(parseSimpleNot("not verified")).toBeTruthy(); // case-insensitive
		});

		test("rejects complex patterns", () => {
			expect(parseSimpleNot("NOT NOT verified")).toBeNull(); // double NOT
			expect(parseSimpleNot("NOT (a OR b)")).toBeNull(); // parentheses
			expect(parseSimpleNot("verified")).toBeNull(); // no NOT
		});
	});

	describe("parseSimpleAnd", () => {
		test("parses AND with 2-5 terms", () => {
			expect(parseSimpleAnd("verified AND premium")).toEqual({
				type: "and",
				left: { type: "booleanField", field: "verified" },
				right: { type: "booleanField", field: "premium" },
			});

			expect(parseSimpleAnd("age > 18 AND count < 100")).toMatchObject({
				type: "and",
				left: { type: "comparison" },
				right: { type: "comparison" },
			});

			// 3-term chain (left-associative)
			const threeTerms = parseSimpleAnd("a = 1 AND b = 2 AND c = 3");
			expect(threeTerms).toMatchObject({
				type: "and",
				left: { type: "and" }, // (a AND b)
				right: { type: "comparison" }, // AND c
			});

			expect(parseSimpleAnd("email? AND verified")).toMatchObject({
				left: { type: "exists" },
			});

			expect(parseSimpleAnd("verified AND NOT banned")).toMatchObject({
				right: { type: "not" },
			});

			expect(parseSimpleAnd("verified and premium")).toBeTruthy(); // case-insensitive
		});

		test("rejects invalid patterns", () => {
			expect(parseSimpleAnd("a = 1 OR b = 2")).toBeNull(); // OR
			expect(parseSimpleAnd("(a = 1) AND (b = 2)")).toBeNull(); // parentheses
			expect(
				parseSimpleAnd("a=1 AND b=2 AND c=3 AND d=4 AND e=5 AND f=6"),
			).toBeNull(); // >5 terms
			expect(parseSimpleAnd('role = "admin" AND age > 18')).toBeNull(); // string literals
			expect(parseSimpleAnd('verified AND status : ["active"]')).toBeNull(); // array literals
		});
	});

	describe("parseSimpleOr", () => {
		test("parses OR with 2-5 terms", () => {
			expect(parseSimpleOr("verified OR premium")).toEqual({
				type: "or",
				left: { type: "booleanField", field: "verified" },
				right: { type: "booleanField", field: "premium" },
			});

			expect(parseSimpleOr("age > 18 OR count < 100")).toMatchObject({
				type: "or",
				left: { type: "comparison" },
				right: { type: "comparison" },
			});

			// 3-term chain (left-associative)
			const threeTerms = parseSimpleOr("a = 1 OR b = 2 OR c = 3");
			expect(threeTerms).toMatchObject({
				type: "or",
				left: { type: "or" },
				right: { type: "comparison" },
			});

			expect(parseSimpleOr("email? OR phone?")).toMatchObject({
				left: { type: "exists" },
				right: { type: "exists" },
			});

			expect(parseSimpleOr("verified or premium")).toBeTruthy(); // case-insensitive
		});

		test("rejects invalid patterns", () => {
			expect(parseSimpleOr("a = 1 AND b = 2 OR c = 3")).toBeNull(); // mixed AND/OR
			expect(parseSimpleOr("verified")).toBeNull(); // no OR
			expect(
				parseSimpleOr("a=1 OR b=2 OR c=3 OR d=4 OR e=5 OR f=6"),
			).toBeNull(); // >5 terms
			expect(parseSimpleOr('role = "admin" OR role = "moderator"')).toBeNull(); // string literals
		});
	});

	describe("String Literal Safety", () => {
		test("parseSimpleAnd rejects queries with string literals", () => {
			// These should be rejected to avoid incorrect splitting
			expect(parseSimpleAnd('name = "ANDY" AND age > 18')).toBeNull();
			expect(
				parseSimpleAnd('title = "SENIOR ANALYST" AND verified'),
			).toBeNull();
			expect(
				parseSimpleAnd('text = "foo AND bar" AND status = "active"'),
			).toBeNull();
			expect(
				parseSimpleAnd('description = "Do NOT use" AND verified'),
			).toBeNull();
			expect(
				parseSimpleAnd('status = "pending OR active" AND verified'),
			).toBeNull();
		});

		test("parseSimpleOr rejects queries with string literals", () => {
			// These should be rejected to avoid incorrect splitting
			expect(parseSimpleOr('role = "admin" OR role = "moderator"')).toBeNull();
			expect(
				parseSimpleOr('title = "HISTORY" OR status = "active"'),
			).toBeNull();
			expect(parseSimpleOr('name = "CANDY" OR name = "SANDY"')).toBeNull();
			expect(parseSimpleOr('text = "foo OR bar" OR verified')).toBeNull();
		});

		test("full parser correctly handles AND/OR in string literals", () => {
			// Even though fast-path rejects these, full parser should handle them
			const testCases = [
				'name = "ANDY" AND age > 18',
				'title = "HISTORY" OR role = "admin"',
				'text = "foo AND bar" AND status = "active"',
				'company = "PANDORA" AND verified',
			];

			for (const query of testCases) {
				const result = parse(query);
				expect(result.success).toBe(true);
			}
		});

		test("queries without string literals still use fast-path", () => {
			// These should NOT be rejected - they have no string literals
			expect(parseSimpleAnd("verified AND premium")).not.toBeNull();
			expect(parseSimpleAnd("age > 18 AND count < 100")).not.toBeNull();
			expect(parseSimpleOr("admin OR moderator")).not.toBeNull();
			expect(parseSimpleOr("email? OR phone?")).not.toBeNull();
		});
	});

	describe("tryFastPath", () => {
		test("matches patterns in priority order", () => {
			expect(tryFastPath("age > 18")).toMatchObject({ type: "comparison" });
			expect(tryFastPath("verified")).toMatchObject({ type: "booleanField" });
			expect(tryFastPath("email?")).toMatchObject({ type: "exists" });
			expect(tryFastPath("name exists")).toMatchObject({ type: "exists" });
			expect(tryFastPath('status : ["active"]')).toMatchObject({
				type: "oneOf",
			});
			expect(tryFastPath('status !: ["banned"]')).toMatchObject({
				type: "notOneOf",
			});
			expect(tryFastPath("NOT banned")).toMatchObject({ type: "not" });
			expect(tryFastPath("verified AND premium")).toMatchObject({
				type: "and",
			});
			expect(tryFastPath("admin OR moderator")).toMatchObject({ type: "or" });
			expect(tryFastPath("a = 1 AND b = 2 AND c = 3")).toMatchObject({
				type: "and",
			});
		});

		test("rejects complex queries early", () => {
			expect(tryFastPath("(a OR b) AND c")).toBeNull(); // parentheses
			expect(tryFastPath("")).toBeNull(); // empty
			expect(tryFastPath("a = 1 AND b = 2 OR c = 3")).toBeNull(); // mixed AND/OR
		});
	});

	describe("Full Parser Equivalence", () => {
		test("fast-path AST matches full parser AST", () => {
			const queries = [
				"age > 18",
				'status = "active"',
				"verified",
				"verified AND premium",
				"admin OR moderator",
			];

			for (const query of queries) {
				const fastResult = tryFastPath(query);
				const fullResult = parse(query);

				expect(fastResult).not.toBeNull();
				expect(fullResult.success).toBe(true);
				if (fullResult.success) {
					expect(fastResult).toEqual(fullResult.ast);
				}
			}
		});

		test("complex queries fallback to full parser", () => {
			const queries = [
				"(a = 1) AND (b = 2)",
				"(a OR b) AND c",
				'text = "with \\"escape\\""',
				"a AND b OR c",
			];

			for (const query of queries) {
				const fastResult = tryFastPath(query);
				const fullResult = parse(query);

				expect(fastResult).toBeNull();
				expect(fullResult.success).toBe(true);
			}
		});
	});

	describe("Integration", () => {
		test("parse() uses fast-path by default", () => {
			const result = parse("age > 18");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.ast).toMatchObject({ type: "comparison" });
			}
		});

		test("fastPath option controls behavior", () => {
			const query = 'status = "active"';

			const withFastPath = parse(query, { fastPath: true });
			const withoutFastPath = parse(query, { fastPath: false });

			expect(withFastPath.success).toBe(true);
			expect(withoutFastPath.success).toBe(true);

			if (withFastPath.success && withoutFastPath.success) {
				expect(withFastPath.ast).toEqual(withoutFastPath.ast);
			}
		});

		test("parseOrThrow works with fast-path", () => {
			const ast1 = parseOrThrow('status = "active"', { fastPath: true });
			const ast2 = parseOrThrow('status = "active"', { fastPath: false });
			expect(ast1).toEqual(ast2);

			expect(() => parseOrThrow("invalid query")).toThrow();
		});
	});
});
