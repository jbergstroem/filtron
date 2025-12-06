import { describe, test, expect } from "bun:test";
import type {
	ComparisonExpression,
	OrExpression,
	AndExpression,
	NotExpression,
	ExistsExpression,
	BooleanFieldExpression,
	OneOfExpression,
	NotOneOfExpression,
	RangeExpression,
} from "./types";
import { parseQuery, ParseError } from "./rd-parser";

describe("Recursive Descent Parser", () => {
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

		test("notOneOf expression", () => {
			const ast = parseQuery('status !: ["deleted", "banned"]') as NotOneOfExpression;
			expect(ast.type).toBe("notOneOf");
			expect(ast.field).toBe("status");
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

	describe("Range Expressions", () => {
		test("basic integer range", () => {
			const ast = parseQuery("age = 18..65") as RangeExpression;
			expect(ast.type).toBe("range");
			expect(ast.field).toBe("age");
			expect(ast.min).toBe(18);
			expect(ast.max).toBe(65);
		});

		test("float range", () => {
			const ast = parseQuery("score = 0.0..100.0") as RangeExpression;
			expect(ast.min).toBe(0.0);
			expect(ast.max).toBe(100.0);
		});

		test("negative number range", () => {
			const ast = parseQuery("temperature = -10..30") as RangeExpression;
			expect(ast.min).toBe(-10);
			expect(ast.max).toBe(30);
		});
	});

	describe("Boolean Operators", () => {
		test("AND expression", () => {
			const ast = parseQuery("a AND b") as AndExpression;
			expect(ast.type).toBe("and");
			expect((ast.left as BooleanFieldExpression).field).toBe("a");
			expect((ast.right as BooleanFieldExpression).field).toBe("b");
		});

		test("OR expression", () => {
			const ast = parseQuery("a OR b") as OrExpression;
			expect(ast.type).toBe("or");
			expect((ast.left as BooleanFieldExpression).field).toBe("a");
			expect((ast.right as BooleanFieldExpression).field).toBe("b");
		});

		test("NOT expression", () => {
			const ast = parseQuery("NOT suspended") as NotExpression;
			expect(ast.type).toBe("not");
			expect((ast.expression as BooleanFieldExpression).field).toBe("suspended");
		});

		test("multiple AND operators (left-associative)", () => {
			const ast = parseQuery("a AND b AND c") as AndExpression;
			expect(ast.type).toBe("and");
			expect((ast.left as AndExpression).type).toBe("and");
			expect((ast.right as BooleanFieldExpression).field).toBe("c");
		});

		test("multiple OR operators (left-associative)", () => {
			const ast = parseQuery("a OR b OR c") as OrExpression;
			expect(ast.type).toBe("or");
			expect((ast.left as OrExpression).type).toBe("or");
		});
	});

	describe("Operator Precedence", () => {
		test("AND has higher precedence than OR", () => {
			const ast = parseQuery("a OR b AND c") as OrExpression;
			expect(ast.type).toBe("or");
			expect((ast.left as BooleanFieldExpression).field).toBe("a");
			expect((ast.right as AndExpression).type).toBe("and");
		});

		test("parentheses override precedence", () => {
			const ast = parseQuery("(a OR b) AND c") as AndExpression;
			expect(ast.type).toBe("and");
			expect((ast.left as OrExpression).type).toBe("or");
			expect((ast.right as BooleanFieldExpression).field).toBe("c");
		});

		test("nested parentheses", () => {
			const ast = parseQuery("((a))");
			expect((ast as BooleanFieldExpression).field).toBe("a");
		});

		test("NOT has highest precedence", () => {
			const ast = parseQuery("NOT a AND b") as AndExpression;
			expect(ast.type).toBe("and");
			expect((ast.left as NotExpression).type).toBe("not");
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
			expect((ast.left as AndExpression).type).toBe("and");
			expect((ast.right as AndExpression).type).toBe("and");
		});

		test("field existence with other conditions", () => {
			const ast = parseQuery("email? AND verified = true") as AndExpression;
			expect((ast.left as ExistsExpression).type).toBe("exists");
			expect((ast.right as ComparisonExpression).type).toBe("comparison");
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
			expect(() => parseQuery("")).toThrow(ParseError);
			expect(() => parseQuery("")).toThrow("Empty query");
		});

		test("unexpected token throws error", () => {
			expect(() => parseQuery("age > 18 AND")).toThrow(ParseError);
		});

		test("unmatched parentheses throws error", () => {
			expect(() => parseQuery("(age > 18")).toThrow(ParseError);
			expect(() => parseQuery("(age > 18")).toThrow("Expected closing parenthesis");
		});

		test("empty array throws error", () => {
			expect(() => parseQuery("status : []")).toThrow(ParseError);
			expect(() => parseQuery("status : []")).toThrow("Array cannot be empty");
		});

		test("unclosed array throws error", () => {
			expect(() => parseQuery('status : ["active"')).toThrow(ParseError);
		});

		test("missing value in comparison throws error", () => {
			expect(() => parseQuery("age >")).toThrow(ParseError);
		});

		test("invalid token sequence throws error", () => {
			expect(() => parseQuery("= =")).toThrow(ParseError);
		});

		test("error includes position", () => {
			try {
				parseQuery("age > ");
			} catch (error) {
				expect(error).toBeInstanceOf(ParseError);
				expect((error as ParseError).position).toBeGreaterThanOrEqual(0);
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
});
