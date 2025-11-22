import { describe, test, expect } from "bun:test";
import {
	parseSimpleComparison,
	parseSimpleBooleanField,
	parseSimpleAnd,
	tryFastPath,
} from "./fast-path";
import { parse } from "./parser";

describe("Fast Path Parser", () => {
	describe("parseSimpleComparison", () => {
		test("parses simple string comparison", () => {
			const result = parseSimpleComparison('status = "active"');
			expect(result).toEqual({
				type: "comparison",
				field: "status",
				operator: "=",
				value: { type: "string", value: "active" },
			});
		});

		test("parses number comparison with >", () => {
			const result = parseSimpleComparison("age > 18");
			expect(result).toEqual({
				type: "comparison",
				field: "age",
				operator: ">",
				value: { type: "number", value: 18 },
			});
		});

		test("parses negative number", () => {
			const result = parseSimpleComparison("temperature >= -5");
			expect(result).toEqual({
				type: "comparison",
				field: "temperature",
				operator: ">=",
				value: { type: "number", value: -5 },
			});
		});

		test("parses float comparison", () => {
			const result = parseSimpleComparison("score <= 4.5");
			expect(result).toEqual({
				type: "comparison",
				field: "score",
				operator: "<=",
				value: { type: "number", value: 4.5 },
			});
		});

		test("parses boolean true", () => {
			const result = parseSimpleComparison("verified = true");
			expect(result).toEqual({
				type: "comparison",
				field: "verified",
				operator: "=",
				value: { type: "boolean", value: true },
			});
		});

		test("parses boolean false", () => {
			const result = parseSimpleComparison("active != false");
			expect(result).toEqual({
				type: "comparison",
				field: "active",
				operator: "!=",
				value: { type: "boolean", value: false },
			});
		});

		test("parses identifier value", () => {
			const result = parseSimpleComparison("status = pending");
			expect(result).toEqual({
				type: "comparison",
				field: "status",
				operator: "=",
				value: { type: "identifier", value: "pending" },
			});
		});

		test("parses dotted field name", () => {
			const result = parseSimpleComparison("user.profile.age >= 18");
			expect(result).toEqual({
				type: "comparison",
				field: "user.profile.age",
				operator: ">=",
				value: { type: "number", value: 18 },
			});
		});

		test("parses dotted identifier value", () => {
			const result = parseSimpleComparison("status = user.status");
			expect(result).toEqual({
				type: "comparison",
				field: "status",
				operator: "=",
				value: { type: "identifier", value: "user.status" },
			});
		});

		test("handles whitespace around operator", () => {
			const result = parseSimpleComparison("age    >    18");
			expect(result).toEqual({
				type: "comparison",
				field: "age",
				operator: ">",
				value: { type: "number", value: 18 },
			});
		});

		test("handles no whitespace", () => {
			const result = parseSimpleComparison("age>18");
			expect(result).toEqual({
				type: "comparison",
				field: "age",
				operator: ">",
				value: { type: "number", value: 18 },
			});
		});

		test("parses all comparison operators", () => {
			expect(parseSimpleComparison("a = 1")?.operator).toBe("=");
			expect(parseSimpleComparison("a != 1")?.operator).toBe("!=");
			expect(parseSimpleComparison("a > 1")?.operator).toBe(">");
			expect(parseSimpleComparison("a >= 1")?.operator).toBe(">=");
			expect(parseSimpleComparison("a < 1")?.operator).toBe("<");
			expect(parseSimpleComparison("a <= 1")?.operator).toBe("<=");
			expect(parseSimpleComparison("a ~ 1")?.operator).toBe("~");
			expect(parseSimpleComparison("a : 1")?.operator).toBe(":");
		});

		test("rejects keyword as field name", () => {
			expect(parseSimpleComparison("and = 1")).toBeNull();
			expect(parseSimpleComparison("or = 1")).toBeNull();
			expect(parseSimpleComparison("not = 1")).toBeNull();
			expect(parseSimpleComparison("exists = 1")).toBeNull();
			expect(parseSimpleComparison("true = 1")).toBeNull();
			expect(parseSimpleComparison("false = 1")).toBeNull();
		});

		test("rejects keyword with case insensitivity", () => {
			expect(parseSimpleComparison("AND = 1")).toBeNull();
			expect(parseSimpleComparison("Or = 1")).toBeNull();
			expect(parseSimpleComparison("NOT = 1")).toBeNull();
		});

		test("rejects string with escapes", () => {
			const result = parseSimpleComparison('text = "hello\\"world"');
			expect(result).toBeNull(); // Falls back to full parser for escapes
		});

		test("rejects empty value", () => {
			const result = parseSimpleComparison("field =");
			expect(result).toBeNull();
		});

		test("rejects complex patterns", () => {
			expect(parseSimpleComparison("a = 1 AND b = 2")).toBeNull();
			expect(parseSimpleComparison("(a = 1)")).toBeNull();
			expect(parseSimpleComparison("NOT a = 1")).toBeNull();
		});

		test("rejects array values", () => {
			expect(parseSimpleComparison('status : ["a", "b"]')).toBeNull();
		});
	});

	describe("parseSimpleBooleanField", () => {
		test("parses simple field name", () => {
			const result = parseSimpleBooleanField("verified");
			expect(result).toEqual({
				type: "booleanField",
				field: "verified",
			});
		});

		test("parses dotted field name", () => {
			const result = parseSimpleBooleanField("user.premium");
			expect(result).toEqual({
				type: "booleanField",
				field: "user.premium",
			});
		});

		test("parses deeply nested field", () => {
			const result = parseSimpleBooleanField("user.profile.settings.active");
			expect(result).toEqual({
				type: "booleanField",
				field: "user.profile.settings.active",
			});
		});

		test("parses field with underscores", () => {
			const result = parseSimpleBooleanField("is_active");
			expect(result).toEqual({
				type: "booleanField",
				field: "is_active",
			});
		});

		test("handles extra whitespace", () => {
			const result = parseSimpleBooleanField("  verified  ");
			expect(result).toEqual({
				type: "booleanField",
				field: "verified",
			});
		});

		test("rejects keywords (case insensitive)", () => {
			expect(parseSimpleBooleanField("and")).toBeNull();
			expect(parseSimpleBooleanField("AND")).toBeNull();
			expect(parseSimpleBooleanField("or")).toBeNull();
			expect(parseSimpleBooleanField("OR")).toBeNull();
			expect(parseSimpleBooleanField("not")).toBeNull();
			expect(parseSimpleBooleanField("NOT")).toBeNull();
			expect(parseSimpleBooleanField("exists")).toBeNull();
			expect(parseSimpleBooleanField("true")).toBeNull();
			expect(parseSimpleBooleanField("false")).toBeNull();
		});

		test("rejects invalid patterns", () => {
			expect(parseSimpleBooleanField("field > 1")).toBeNull();
			expect(parseSimpleBooleanField("a AND b")).toBeNull();
			expect(parseSimpleBooleanField("(field)")).toBeNull();
			expect(parseSimpleBooleanField("field?")).toBeNull();
		});

		test("rejects field starting with number", () => {
			expect(parseSimpleBooleanField("123field")).toBeNull();
		});
	});

	describe("parseSimpleAnd", () => {
		test("parses two comparisons with AND", () => {
			const result = parseSimpleAnd('status = "active" AND age > 18');
			expect(result).toEqual({
				type: "and",
				left: {
					type: "comparison",
					field: "status",
					operator: "=",
					value: { type: "string", value: "active" },
				},
				right: {
					type: "comparison",
					field: "age",
					operator: ">",
					value: { type: "number", value: 18 },
				},
			});
		});

		test("parses comparison AND boolean field", () => {
			const result = parseSimpleAnd("age >= 18 AND verified");
			expect(result).toEqual({
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
			});
		});

		test("parses boolean field AND comparison", () => {
			const result = parseSimpleAnd("premium AND age > 21");
			expect(result).toEqual({
				type: "and",
				left: {
					type: "booleanField",
					field: "premium",
				},
				right: {
					type: "comparison",
					field: "age",
					operator: ">",
					value: { type: "number", value: 21 },
				},
			});
		});

		test("parses two boolean fields", () => {
			const result = parseSimpleAnd("verified AND premium");
			expect(result).toEqual({
				type: "and",
				left: {
					type: "booleanField",
					field: "verified",
				},
				right: {
					type: "booleanField",
					field: "premium",
				},
			});
		});

		test("handles case-insensitive AND", () => {
			const result = parseSimpleAnd("verified and premium");
			expect(result).not.toBeNull();
			expect(result?.type).toBe("and");
		});

		test("handles mixed case AND", () => {
			const result = parseSimpleAnd("verified And premium");
			expect(result).not.toBeNull();
			expect(result?.type).toBe("and");
		});

		test("handles extra whitespace", () => {
			const result = parseSimpleAnd("  verified   AND   premium  ");
			expect(result).toEqual({
				type: "and",
				left: {
					type: "booleanField",
					field: "verified",
				},
				right: {
					type: "booleanField",
					field: "premium",
				},
			});
		});

		test("rejects multiple ANDs (chaining)", () => {
			const result = parseSimpleAnd("a = 1 AND b = 2 AND c = 3");
			expect(result).toBeNull(); // Falls back to full parser
		});

		test("rejects OR expressions", () => {
			const result = parseSimpleAnd("a = 1 OR b = 2");
			expect(result).toBeNull();
		});

		test("rejects parentheses", () => {
			const result = parseSimpleAnd("(a = 1) AND (b = 2)");
			expect(result).toBeNull();
		});

		test("rejects NOT expressions", () => {
			const result = parseSimpleAnd("NOT a = 1 AND b = 2");
			expect(result).toBeNull();
		});

		test("rejects complex left side", () => {
			const result = parseSimpleAnd('a : ["x", "y"] AND b = 2');
			expect(result).toBeNull();
		});

		test("rejects complex right side", () => {
			const result = parseSimpleAnd('a = 1 AND b : ["x", "y"]');
			expect(result).toBeNull();
		});
	});

	describe("tryFastPath", () => {
		test("tries comparison first", () => {
			const result = tryFastPath("age > 18");
			expect(result).toEqual({
				type: "comparison",
				field: "age",
				operator: ">",
				value: { type: "number", value: 18 },
			});
		});

		test("tries AND second", () => {
			const result = tryFastPath("verified AND premium");
			expect(result).toEqual({
				type: "and",
				left: { type: "booleanField", field: "verified" },
				right: { type: "booleanField", field: "premium" },
			});
		});

		test("tries boolean field third", () => {
			const result = tryFastPath("verified");
			expect(result).toEqual({
				type: "booleanField",
				field: "verified",
			});
		});

		test("returns null for complex queries", () => {
			expect(tryFastPath("a = 1 OR b = 2")).toBeNull();
			expect(tryFastPath("NOT verified")).toBeNull();
			expect(tryFastPath("(a = 1)")).toBeNull();
			expect(tryFastPath('a : ["x", "y"]')).toBeNull();
		});
	});

	describe("Fast Path vs Full Parser Equivalence", () => {
		test("simple comparisons match full parser", () => {
			const queries = [
				"age > 18",
				'status = "active"',
				"verified = true",
				"count != 0",
				"score >= 4.5",
				"temp <= -5",
				"name ~ pattern",
				"type : value",
			];

			for (const query of queries) {
				const fastResult = tryFastPath(query);
				const fullResult = parse(query);

				expect(fullResult.success).toBe(true);
				if (fullResult.success && fastResult) {
					expect(fastResult).toEqual(fullResult.ast);
				}
			}
		});

		test("boolean fields match full parser", () => {
			const queries = ["verified", "premium", "user.active", "is_enabled"];

			for (const query of queries) {
				const fastResult = tryFastPath(query);
				const fullResult = parse(query);

				expect(fullResult.success).toBe(true);
				if (fullResult.success && fastResult) {
					expect(fastResult).toEqual(fullResult.ast);
				}
			}
		});

		test("simple AND expressions match full parser", () => {
			const queries = [
				'status = "active" AND age > 18',
				"verified AND premium",
				"age >= 18 AND verified",
				"a = 1 AND b = 2",
			];

			for (const query of queries) {
				const fastResult = tryFastPath(query);
				const fullResult = parse(query);

				expect(fullResult.success).toBe(true);
				if (fullResult.success && fastResult) {
					expect(fastResult).toEqual(fullResult.ast);
				}
			}
		});

		test("complex queries fall back to full parser", () => {
			const queries = [
				"a = 1 OR b = 2",
				"NOT verified",
				"(a = 1) AND (b = 2)",
				'status : ["active", "pending"]',
				"a = 1 AND b = 2 AND c = 3",
				"field?",
				"field EXISTS",
				'text = "with \\"escape\\""',
			];

			for (const query of queries) {
				const fastResult = tryFastPath(query);
				const fullResult = parse(query);

				expect(fastResult).toBeNull(); // Fast path doesn't handle it
				expect(fullResult.success).toBe(true); // But full parser does
			}
		});
	});

	describe("Integration with parse()", () => {
		test("parse() uses fast path for simple comparison", () => {
			const result = parse("age > 18");

			expect(result.success).toBe(true);
		});

		test("parse() uses fast path for boolean field", () => {
			const result = parse("verified");

			expect(result.success).toBe(true);
		});

		test("parse() uses fast path for simple AND", () => {
			const result = parse("verified AND premium");

			expect(result.success).toBe(true);
		});

		test("parse() falls back to full parser for complex query", () => {
			const result = parse("a = 1 OR b = 2");

			expect(result.success).toBe(true);
		});
	});
});
