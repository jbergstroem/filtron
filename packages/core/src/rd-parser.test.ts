import { describe, test, expect } from "bun:test";
import { FiltronParseError } from "./errors";
import { parseQuery } from "./rd-parser";
import type {
	ComparisonExpression,
	OrExpression,
	AndExpression,
	NotExpression,
	ExistsExpression,
	BooleanFieldExpression,
	OneOfExpression,
} from "./types";

describe("RD Parser", () => {
	describe("Field Expressions", () => {
		test("simple field name", () => {
			const ast = parseQuery("user_name") as BooleanFieldExpression;
			expect(ast.type).toBe("booleanField");
			expect(ast.field).toBe("user_name");
		});

		test("dotted field names", () => {
			const ast = parseQuery("user.profile.age") as BooleanFieldExpression;
			expect(ast.type).toBe("booleanField");
			expect(ast.field).toBe("user.profile.age");
		});

		test("field existence with question mark", () => {
			const ast = parseQuery("email?") as ExistsExpression;
			expect(ast.type).toBe("exists");
			expect(ast.field).toBe("email");
		});

		test("field existence with EXISTS keyword", () => {
			const ast = parseQuery("email EXISTS") as ExistsExpression;
			expect(ast.type).toBe("exists");
			expect(ast.field).toBe("email");
		});

		test("boolean field shorthand", () => {
			const ast = parseQuery("verified") as BooleanFieldExpression;
			expect(ast.type).toBe("booleanField");
			expect(ast.field).toBe("verified");
		});
	});

	describe("Comparison Expressions", () => {
		test("equals comparison", () => {
			const ast = parseQuery("age = 25") as ComparisonExpression;
			expect(ast.type).toBe("comparison");
			expect(ast.field).toBe("age");
			expect(ast.operator).toBe("=");
			expect(ast.value).toEqual({ type: "number", value: 25 });
		});

		test("not equals comparison", () => {
			const ast = parseQuery("status != active") as ComparisonExpression;
			expect(ast.type).toBe("comparison");
			expect(ast.operator).toBe("!=");
		});

		test("greater than comparison", () => {
			const ast = parseQuery("age > 18") as ComparisonExpression;
			expect(ast.operator).toBe(">");
		});

		test("greater than or equal", () => {
			const ast = parseQuery("age >= 18") as ComparisonExpression;
			expect(ast.operator).toBe(">=");
		});

		test("less than comparison", () => {
			const ast = parseQuery("age < 65") as ComparisonExpression;
			expect(ast.operator).toBe("<");
		});

		test("less than or equal", () => {
			const ast = parseQuery("age <= 65") as ComparisonExpression;
			expect(ast.operator).toBe("<=");
		});

		test("like operator", () => {
			const ast = parseQuery('name ~ "Jo*"') as ComparisonExpression;
			expect(ast.operator).toBe("~");
		});

		test("colon as comparison operator", () => {
			const ast = parseQuery("age : 18") as ComparisonExpression;
			expect(ast.operator).toBe(":");
		});

		test("comparison with string value", () => {
			const ast = parseQuery('name = "John"') as ComparisonExpression;
			expect(ast.value).toEqual({ type: "string", value: "John" });
		});

		test("comparison with identifier value", () => {
			const ast = parseQuery("status = active") as ComparisonExpression;
			expect(ast.value).toEqual({ type: "identifier", value: "active" });
		});

		test("comparison with boolean value", () => {
			const ast = parseQuery("verified = true") as ComparisonExpression;
			expect(ast.value).toEqual({ type: "boolean", value: true });
		});
	});

	describe("OneOf Expressions", () => {
		test("oneOf with string values", () => {
			const ast = parseQuery('status : ["pending", "approved"]') as OneOfExpression;
			expect(ast.type).toBe("oneOf");
			expect(ast.field).toBe("status");
			expect(ast.values).toEqual([
				{ type: "string", value: "pending" },
				{ type: "string", value: "approved" },
			]);
		});

		test("oneOf with number values", () => {
			const ast = parseQuery("priority : [1, 2, 3]") as OneOfExpression;
			expect(ast.values).toEqual([
				{ type: "number", value: 1 },
				{ type: "number", value: 2 },
				{ type: "number", value: 3 },
			]);
		});

		test("oneOf with identifier values", () => {
			const ast = parseQuery("role : [admin, user]") as OneOfExpression;
			expect(ast.values).toEqual([
				{ type: "identifier", value: "admin" },
				{ type: "identifier", value: "user" },
			]);
		});

		test("negated membership expression", () => {
			const ast = parseQuery('status !: ["deleted", "banned"]') as OneOfExpression;
			expect(ast.type).toBe("oneOf");
			expect(ast.negated).toBe(true);
			expect(ast.field).toBe("status");
		});

		test("membership is not negated by default", () => {
			const ast = parseQuery('status : ["active"]') as OneOfExpression;
			expect(ast.negated).toBe(false);
		});

		test("negated exists with minus prefix", () => {
			const ast = parseQuery("-email") as ExistsExpression;
			expect(ast.type).toBe("exists");
			expect(ast.field).toBe("email");
			expect(ast.negated).toBe(true);
		});

		test("negated exists with dotted field", () => {
			const ast = parseQuery("-user.email") as ExistsExpression;
			expect(ast.field).toBe("user.email");
			expect(ast.negated).toBe(true);
		});

		test("negated exists composes with other conditions", () => {
			const ast = parseQuery("-email AND verified") as AndExpression;
			expect(ast.type).toBe("and");
			expect((ast.children[0] as ExistsExpression).negated).toBe(true);
		});

		test("exists via question mark is not negated", () => {
			const ast = parseQuery("email?") as ExistsExpression;
			expect(ast.negated).toBe(false);
		});

		test("minus without a following field is an error", () => {
			expect(() => parseQuery("age > -")).toThrow(FiltronParseError);
			expect(() => parseQuery("- email")).toThrow(FiltronParseError);
		});

		test("oneOf with single value", () => {
			const ast = parseQuery('status : ["active"]') as OneOfExpression;
			expect(ast.values.length).toBe(1);
		});

		test("oneOf with mixed value types", () => {
			const ast = parseQuery('field : [1, "two", true]') as OneOfExpression;
			expect(ast.values).toEqual([
				{ type: "number", value: 1 },
				{ type: "string", value: "two" },
				{ type: "boolean", value: true },
			]);
		});
	});

	describe("Range Values", () => {
		test("basic integer range", () => {
			const ast = parseQuery("age = 18..65") as ComparisonExpression;
			expect(ast.type).toBe("comparison");
			expect(ast.field).toBe("age");
			expect(ast.operator).toBe("=");
			expect(ast.value).toEqual({ type: "range", min: 18, max: 65 });
		});

		test("float range", () => {
			const ast = parseQuery("score = 0.0..100.0") as ComparisonExpression;
			expect(ast.value).toEqual({ type: "range", min: 0, max: 100 });
		});

		test("negative number range", () => {
			const ast = parseQuery("temperature = -10..30") as ComparisonExpression;
			expect(ast.value).toEqual({ type: "range", min: -10, max: 30 });
		});

		test("range with colon operator", () => {
			const ast = parseQuery("age : 18..65") as ComparisonExpression;
			expect(ast.operator).toBe(":");
			expect(ast.value).toEqual({ type: "range", min: 18, max: 65 });
		});

		test("range with not-equals operator", () => {
			const ast = parseQuery("age != 18..65") as ComparisonExpression;
			expect(ast.operator).toBe("!=");
			expect(ast.value).toEqual({ type: "range", min: 18, max: 65 });
		});

		test("range with an ordering operator is an error", () => {
			expect(() => parseQuery("age > 18..65")).toThrow(
				"Range values require the =, : or != operator",
			);
			expect(() => parseQuery("age <= 18..65")).toThrow(FiltronParseError);
		});

		test("range inside an array is an error", () => {
			expect(() => parseQuery("age : [18..65]")).toThrow("Range values are not allowed in arrays");
			expect(() => parseQuery("age : [1, 18..65]")).toThrow(FiltronParseError);
		});

		test("inverted range is an error", () => {
			expect(() => parseQuery("age = 65..18")).toThrow("Range min (65) must not exceed max (18)");
			expect(() => parseQuery("age = 18..18")).not.toThrow();
		});

		test("incomplete range is an error", () => {
			expect(() => parseQuery("age = 18..")).toThrow("Expected number after '..'");
		});
	});

	describe("Boolean Operators", () => {
		test("AND expression", () => {
			const ast = parseQuery("a AND b") as AndExpression;
			expect(ast.type).toBe("and");
			expect((ast.children[0] as BooleanFieldExpression).field).toBe("a");
			expect((ast.children[1] as BooleanFieldExpression).field).toBe("b");
		});

		test("OR expression", () => {
			const ast = parseQuery("a OR b") as OrExpression;
			expect(ast.type).toBe("or");
			expect((ast.children[0] as BooleanFieldExpression).field).toBe("a");
			expect((ast.children[1] as BooleanFieldExpression).field).toBe("b");
		});

		test("NOT expression", () => {
			const ast = parseQuery("NOT suspended") as NotExpression;
			expect(ast.type).toBe("not");
			expect((ast.expression as BooleanFieldExpression).field).toBe("suspended");
		});

		test("multiple AND operators (flat chain)", () => {
			const ast = parseQuery("a AND b AND c") as AndExpression;
			expect(ast.type).toBe("and");
			expect(ast.children).toHaveLength(3);
			expect(ast.children.map((c) => (c as BooleanFieldExpression).field)).toEqual(["a", "b", "c"]);
		});

		test("multiple OR operators (flat chain)", () => {
			const ast = parseQuery("a OR b OR c") as OrExpression;
			expect(ast.type).toBe("or");
			expect(ast.children).toHaveLength(3);
		});

		test("parenthesized same-type chains are spliced flat", () => {
			const left = parseQuery("(a AND b) AND c AND (d AND e)") as AndExpression;
			expect(left.children).toHaveLength(5);
			expect(left.children.every((c) => c.type === "booleanField")).toBe(true);

			const right = parseQuery("a OR (b OR c)") as OrExpression;
			expect(right.children).toHaveLength(3);
			expect(right.children.every((c) => c.type === "booleanField")).toBe(true);
		});
	});

	describe("Operator Precedence", () => {
		test("AND has higher precedence than OR", () => {
			const ast = parseQuery("a OR b AND c") as OrExpression;
			expect(ast.type).toBe("or");
			expect((ast.children[0] as BooleanFieldExpression).field).toBe("a");
			expect((ast.children[1] as AndExpression).type).toBe("and");
		});

		test("parentheses override precedence", () => {
			const ast = parseQuery("(a OR b) AND c") as AndExpression;
			expect(ast.type).toBe("and");
			expect((ast.children[0] as OrExpression).type).toBe("or");
			expect((ast.children[1] as BooleanFieldExpression).field).toBe("c");
		});

		test("nested parentheses", () => {
			const ast = parseQuery("((a))");
			expect((ast as BooleanFieldExpression).field).toBe("a");
		});

		test("NOT has highest precedence", () => {
			const ast = parseQuery("NOT a AND b") as AndExpression;
			expect(ast.type).toBe("and");
			expect((ast.children[0] as NotExpression).type).toBe("not");
		});
	});

	describe("Complex Queries", () => {
		test("multiple conditions with different operators", () => {
			const ast = parseQuery("age > 18 AND status = active OR premium");
			expect(ast.type).toBe("or");
		});

		test("nested conditions with parentheses", () => {
			const ast = parseQuery("(a AND b) OR (c AND d)") as OrExpression;
			expect(ast.type).toBe("or");
			expect((ast.children[0] as AndExpression).type).toBe("and");
			expect((ast.children[1] as AndExpression).type).toBe("and");
		});

		test("field existence with other conditions", () => {
			const ast = parseQuery("email? AND verified = true") as AndExpression;
			expect((ast.children[0] as ExistsExpression).type).toBe("exists");
			expect((ast.children[1] as ComparisonExpression).type).toBe("comparison");
		});

		test("range with other conditions", () => {
			const ast = parseQuery("(age = 18..65) AND verified");
			expect(ast.type).toBe("and");
		});

		test("deeply nested logic", () => {
			const ast = parseQuery("(a = 1 AND (b = 2 OR c = 3)) AND (d = 4 OR (e = 5 AND f = 6))");
			expect(ast.type).toBe("and");
		});
	});

	describe("Error Handling", () => {
		test("empty query throws error", () => {
			expect(() => parseQuery("")).toThrow(FiltronParseError);
			expect(() => parseQuery("")).toThrow("Empty query");
		});

		test("unexpected token throws error", () => {
			expect(() => parseQuery("age > 18 AND")).toThrow(FiltronParseError);
		});

		test("unmatched parentheses throws error", () => {
			expect(() => parseQuery("(age > 18")).toThrow(FiltronParseError);
			expect(() => parseQuery("(age > 18")).toThrow("Expected closing parenthesis");
		});

		test("empty array throws error", () => {
			expect(() => parseQuery("status : []")).toThrow(FiltronParseError);
			expect(() => parseQuery("status : []")).toThrow("Array cannot be empty");
		});

		test("unclosed array throws error", () => {
			expect(() => parseQuery('status : ["active"')).toThrow(FiltronParseError);
		});

		test("missing value in comparison throws error", () => {
			expect(() => parseQuery("age >")).toThrow(FiltronParseError);
		});

		test("invalid token sequence throws error", () => {
			expect(() => parseQuery("= =")).toThrow(FiltronParseError);
		});

		test("error includes position", () => {
			try {
				parseQuery("age > ");
			} catch (error) {
				expect(error).toBeInstanceOf(FiltronParseError);
				expect((error as FiltronParseError).position).toBeGreaterThanOrEqual(0);
			}
		});
	});

	describe("Real-world Examples", () => {
		test("user authentication query", () => {
			const ast = parseQuery('email? AND verified = true AND status : ["active", "premium"]');
			expect(ast.type).toBe("and");
		});

		test("age-gated content query", () => {
			const ast = parseQuery("age >= 18 AND age < 65 AND NOT restricted");
			expect(ast.type).toBe("and");
		});

		test("admin dashboard access", () => {
			const ast = parseQuery(
				'(role : ["admin", "superadmin"]) AND (NOT suspended) AND last_login?',
			);
			expect(ast.type).toBe("and");
		});

		test("multi-line formatted query", () => {
			const query = `
				age >= 18
				AND status = active
				AND email?
			`;
			const ast = parseQuery(query);
			expect(ast.type).toBe("and");
		});
	});

	describe("Parse Limits", () => {
		test("default maximum length is a boundary", () => {
			expect(parseQuery("a".repeat(10000)).type).toBe("booleanField");

			let error: unknown;
			try {
				parseQuery("a".repeat(10001));
			} catch (caught) {
				error = caught;
			}
			expect(error).toBeInstanceOf(FiltronParseError);
			expect((error as FiltronParseError).message).toBe(
				"Query exceeds maximum length of 10000 characters",
			);
			expect((error as FiltronParseError).position).toBe(0);
		});

		test("default maximum parenthesis depth is a boundary", () => {
			expect(parseQuery("(".repeat(64) + "a" + ")".repeat(64)).type).toBe("booleanField");

			let error: unknown;
			try {
				parseQuery("(".repeat(65) + "a" + ")".repeat(65));
			} catch (caught) {
				error = caught;
			}
			expect(error).toBeInstanceOf(FiltronParseError);
			expect((error as FiltronParseError).message).toBe(
				"Query exceeds maximum nesting depth of 64",
			);
			expect((error as FiltronParseError).position).toBe(64);
		});

		test("NOT chains count toward the depth limit", () => {
			expect(parseQuery("NOT ".repeat(64) + "a").type).toBe("not");

			let error: unknown;
			try {
				parseQuery("NOT ".repeat(65) + "a");
			} catch (caught) {
				error = caught;
			}
			expect(error).toBeInstanceOf(FiltronParseError);
			expect((error as FiltronParseError).position).toBe(256);
		});

		test("custom limits lower and raise the defaults", () => {
			expect(() => parseQuery("age > 18", { maxLength: 5 })).toThrow(
				"Query exceeds maximum length of 5 characters",
			);
			expect(parseQuery(`name = "${"a".repeat(15000)}"`, { maxLength: 20000 }).type).toBe(
				"comparison",
			);
			expect(parseQuery("(".repeat(100) + "a" + ")".repeat(100), { maxDepth: 128 }).type).toBe(
				"booleanField",
			);
		});

		test("NOT and parentheses share the depth counter", () => {
			expect(parseQuery("NOT (a)", { maxDepth: 2 }).type).toBe("not");
			expect(() => parseQuery("NOT (a)", { maxDepth: 1 })).toThrow(
				"Query exceeds maximum nesting depth of 1",
			);
		});

		test("depth counter resets between sibling groups", () => {
			const ast = parseQuery("NOT a AND (b) AND (c OR (d))", { maxDepth: 2 });
			expect(ast.type).toBe("and");
		});
	});
});
