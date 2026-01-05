import { describe, test, expect } from "bun:test";
import { parse, parseOrThrow, FiltronParseError } from "./parser";

describe("Parser API", () => {
	describe("parse()", () => {
		test("returns success result for valid query", () => {
			const result = parse("age > 18");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.ast).toBeDefined();
				expect(result.ast.type).toBe("comparison");
			}
		});

		test("returns success result for complex query", () => {
			const result = parse('email? AND verified = true AND status : ["active", "premium"]');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.ast.type).toBe("and");
			}
		});

		test("returns error result for invalid query", () => {
			const result = parse("age >");
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBeDefined();
				expect(result.message).toBeDefined();
				expect(typeof result.error).toBe("string");
				expect(result.position).toBe(5);
			}
		});

		test("returns error result for empty query", () => {
			const result = parse("");
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Empty query");
				expect(result.position).toBe(0);
			}
		});

		test("returns error result for lexer errors", () => {
			const result = parse('"unterminated string');
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Unterminated string literal");
				expect(result.position).toBe(0);
			}
		});

		test("returns error result for parser errors", () => {
			const result = parse("(age > 18");
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBeDefined();
				expect(result.position).toBe(9);
			}
		});

		test("returns error result for unexpected characters", () => {
			const result = parse("age @ 18");
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Unexpected character");
				expect(result.position).toBe(4);
			}
		});

		test("handles multi-line queries", () => {
			const query = `
				age >= 18
				AND verified = true
				// This is a comment
				AND email?
			`;
			const result = parse(query);
			expect(result.success).toBe(true);
		});

		test("handles queries with comments", () => {
			const result = parse("age > 18 // check age");
			expect(result.success).toBe(true);
		});

		test("preserves error messages from ParseError", () => {
			const result = parse("status : []");
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Array cannot be empty");
			}
		});
	});

	describe("parseOrThrow()", () => {
		test("returns AST on success", () => {
			const ast = parseOrThrow("age > 18");
			expect(ast).toBeDefined();
			expect(ast.type).toBe("comparison");
		});

		test("returns AST for complex queries", () => {
			const ast = parseOrThrow('email? AND status : ["active"]');
			expect(ast.type).toBe("and");
		});

		test("throws FiltronParseError on parse failure", () => {
			expect(() => parseOrThrow("age >")).toThrow(FiltronParseError);
			expect(() => parseOrThrow("age >")).toThrow("Failed to parse Filtron query");
		});

		test("throws FiltronParseError for empty query with position", () => {
			try {
				parseOrThrow("");
			} catch (error) {
				expect(error).toBeInstanceOf(FiltronParseError);
				expect((error as FiltronParseError).position).toBe(0);
				expect((error as FiltronParseError).message).toContain("Empty query");
			}
		});

		test("throws FiltronParseError for lexer errors with position", () => {
			try {
				parseOrThrow('"unterminated');
			} catch (error) {
				expect(error).toBeInstanceOf(FiltronParseError);
				expect((error as FiltronParseError).position).toBe(0);
				expect((error as FiltronParseError).message).toContain("Unterminated string literal");
			}
		});

		test("throws FiltronParseError for invalid syntax with position", () => {
			try {
				parseOrThrow("(age > 18");
			} catch (error) {
				expect(error).toBeInstanceOf(FiltronParseError);
				expect((error as FiltronParseError).position).toBe(9);
			}
		});

		test("error includes position and original error details", () => {
			try {
				parseOrThrow("status : []");
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(FiltronParseError);
				expect((error as FiltronParseError).message).toContain("Failed to parse Filtron query");
				expect((error as FiltronParseError).message).toContain("Array cannot be empty");
				expect((error as FiltronParseError).position).toBeDefined();
			}
		});
	});

	describe("Integration Tests", () => {
		test("parse and parseOrThrow produce same AST for valid input", () => {
			const query = "age > 18 AND verified = true";
			const parseResult = parse(query);
			const parseOrThrowResult = parseOrThrow(query);

			expect(parseResult.success).toBe(true);
			if (parseResult.success) {
				expect(parseResult.ast).toEqual(parseOrThrowResult);
			}
		});

		test("handles all expression types", () => {
			const queries = [
				"field", // booleanField
				"field?", // exists
				"field = value", // comparison
				'field : ["a", "b"]', // oneOf
				'field !: ["a", "b"]', // notOneOf
				"field = 1..10", // range
				"a AND b", // and
				"a OR b", // or
				"NOT a", // not
			];

			for (const query of queries) {
				const result = parse(query);
				expect(result.success).toBe(true);
			}
		});

		test("real-world query examples", () => {
			const queries = [
				'email? AND verified = true AND status : ["active", "premium"]',
				"age >= 18 AND age < 65 AND NOT restricted",
				'(role : ["admin", "superadmin"]) AND (NOT suspended) AND last_login?',
				'category = electronics AND price >= 100 AND price <= 500 AND (brand : ["Apple", "Samsung"]) AND in_stock = true',
				"notifications.email = true AND notifications.sms = false",
			];

			for (const query of queries) {
				const result = parse(query);
				expect(result.success).toBe(true);
			}
		});
	});
});
