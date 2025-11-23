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

describe("Fast Path Parser", () => {
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

			expect(parseSimpleAnd('role = "admin" AND age > 18')).toMatchObject({
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

			expect(parseSimpleAnd('verified AND status : ["active"]')).toMatchObject({
				right: { type: "oneOf" },
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
		});
	});

	describe("parseSimpleOr", () => {
		test("parses OR with 2-5 terms", () => {
			expect(parseSimpleOr("verified OR premium")).toEqual({
				type: "or",
				left: { type: "booleanField", field: "verified" },
				right: { type: "booleanField", field: "premium" },
			});

			expect(
				parseSimpleOr('role = "admin" OR role = "moderator"'),
			).toMatchObject({
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
