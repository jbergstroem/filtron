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
} from "./types";
import { parse, parseOrThrow } from "./parser";

describe("Core", () => {
	describe("Basic Values", () => {
		test("string values", () => {
			const result = parse('name = "John"');
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.type).toBe("comparison");
				expect(expr.field).toBe("name");
				expect(expr.operator).toBe("=");
				expect(expr.value).toEqual({ type: "string", value: "John" });
			}
		});

		test("strings with escaped quotes", () => {
			const result = parse('text = "He said \\"Hello\\""');
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.value).toEqual({
					type: "string",
					value: 'He said "Hello"',
				});
			}
		});

		test("strings with escape sequences", () => {
			const result = parse('text = "Line 1\\nLine 2\\tTabbed"');
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.value).toEqual({
					type: "string",
					value: "Line 1\nLine 2\tTabbed",
				});
			}
		});

		test("integer values", () => {
			const result = parse("age = 25");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.value).toEqual({ type: "number", value: 25 });
			}
		});

		test("negative integers", () => {
			const result = parse("temperature = -5");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.value).toEqual({ type: "number", value: -5 });
			}
		});

		test("float values", () => {
			const result = parse("score = 4.5");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.value).toEqual({ type: "number", value: 4.5 });
			}
		});

		test("negative floats", () => {
			const result = parse("temperature = -12.5");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.value).toEqual({ type: "number", value: -12.5 });
			}
		});

		test("boolean true", () => {
			const result = parse("verified = true");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.value).toEqual({ type: "boolean", value: true });
			}
		});

		test("boolean false", () => {
			const result = parse("verified = false");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.value).toEqual({ type: "boolean", value: false });
			}
		});

		test("case-insensitive booleans", () => {
			const result1 = parse("verified = TRUE");
			expect(result1.success).toBe(true);
			if (result1.success) {
				const expr = result1.ast as ComparisonExpression;
				expect(expr.value).toEqual({ type: "boolean", value: true });
			}

			const result2 = parse("verified = FALSE");
			expect(result2.success).toBe(true);
			if (result2.success) {
				const expr = result2.ast as ComparisonExpression;
				expect(expr.value).toEqual({ type: "boolean", value: false });
			}
		});

		test("identifier values", () => {
			const result = parse("status = pending");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.value).toEqual({ type: "identifier", value: "pending" });
			}
		});
	});

	describe("Comparison Operators", () => {
		test("equals operator", () => {
			const result = parse("age = 18");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.operator).toBe("=");
			}
		});

		test("not equals operator", () => {
			const result = parse("age != 18");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.operator).toBe("!=");
			}
		});

		test("greater than operator", () => {
			const result = parse("age > 18");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.operator).toBe(">");
			}
		});

		test("greater than or equal operator", () => {
			const result = parse("age >= 18");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.operator).toBe(">=");
			}
		});

		test("less than operator", () => {
			const result = parse("age < 18");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.operator).toBe("<");
			}
		});

		test("less than or equal operator", () => {
			const result = parse("age <= 18");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.operator).toBe("<=");
			}
		});

		test("like operator", () => {
			const result = parse('name ~ "John"');
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.operator).toBe("~");
			}
		});

		test("colon as equals operator", () => {
			const result = parse("age : 18");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.operator).toBe(":");
			}
		});
	});

	describe("Field Names", () => {
		test("simple field names", () => {
			const result = parse("age = 18");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.field).toBe("age");
			}
		});

		test("field names with underscores", () => {
			const result = parse("user_age = 18");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.field).toBe("user_age");
			}
		});

		test("dotted field names", () => {
			const result = parse("user.age = 18");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.field).toBe("user.age");
			}
		});

		test("deeply nested dotted field names", () => {
			const result = parse("user.profile.settings.theme = dark");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.field).toBe("user.profile.settings.theme");
			}
		});
	});

	describe("Boolean Operators", () => {
		test("AND expressions", () => {
			const result = parse("age > 18 AND status = active");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as AndExpression;
				expect(expr.type).toBe("and");
				expect((expr.left as ComparisonExpression).field).toBe("age");
				expect((expr.right as ComparisonExpression).field).toBe("status");
			}
		});

		test("case-insensitive AND", () => {
			const result = parse("age > 18 and status = active");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.ast.type).toBe("and");
			}
		});

		test("OR expressions", () => {
			const result = parse("role = admin OR role = moderator");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as OrExpression;
				expect(expr.type).toBe("or");
			}
		});

		test("case-insensitive OR", () => {
			const result = parse("role = admin or role = moderator");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.ast.type).toBe("or");
			}
		});

		test("NOT expressions", () => {
			const result = parse("NOT verified");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as NotExpression;
				expect(expr.type).toBe("not");
				expect((expr.expression as BooleanFieldExpression).type).toBe(
					"booleanField",
				);
			}
		});

		test("case-insensitive NOT", () => {
			const result = parse("not verified");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.ast.type).toBe("not");
			}
		});

		test("multiple AND operators (left-associative)", () => {
			const result = parse("a = 1 AND b = 2 AND c = 3");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as AndExpression;
				expect(expr.type).toBe("and");
				expect((expr.left as AndExpression).type).toBe("and");
				expect((expr.right as ComparisonExpression).field).toBe("c");
			}
		});

		test("multiple OR operators (left-associative)", () => {
			const result = parse("a = 1 OR b = 2 OR c = 3");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as OrExpression;
				expect(expr.type).toBe("or");
				expect((expr.left as OrExpression).type).toBe("or");
			}
		});
	});

	describe("Operator Precedence", () => {
		test("AND higher precedence than OR", () => {
			const result = parse("a = 1 OR b = 2 AND c = 3");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as OrExpression;
				expect(expr.type).toBe("or");
				expect((expr.right as AndExpression).type).toBe("and");
			}
		});

		test("parentheses for precedence", () => {
			const result = parse("(a = 1 OR b = 2) AND c = 3");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as AndExpression;
				expect(expr.type).toBe("and");
				expect((expr.left as OrExpression).type).toBe("or");
			}
		});

		test("nested parentheses", () => {
			const result = parse("((a = 1 OR b = 2) AND c = 3) OR d = 4");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.ast.type).toBe("or");
			}
		});
	});

	describe("Field Existence", () => {
		test("existence check with question mark", () => {
			const result = parse("email?");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ExistsExpression;
				expect(expr.type).toBe("exists");
				expect(expr.field).toBe("email");
			}
		});

		test("existence check with EXISTS keyword", () => {
			const result = parse("email EXISTS");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ExistsExpression;
				expect(expr.type).toBe("exists");
				expect(expr.field).toBe("email");
			}
		});

		test("case-insensitive EXISTS", () => {
			const result = parse("email exists");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.ast.type).toBe("exists");
			}
		});

		test("existence check for dotted fields", () => {
			const result = parse("user.email?");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ExistsExpression;
				expect(expr.field).toBe("user.email");
			}
		});
	});

	describe("Boolean Field Shorthand", () => {
		test("boolean field shorthand", () => {
			const result = parse("verified");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as BooleanFieldExpression;
				expect(expr.type).toBe("booleanField");
				expect(expr.field).toBe("verified");
			}
		});

		test("boolean field shorthand with AND", () => {
			const result = parse("verified AND premium");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as AndExpression;
				expect((expr.left as BooleanFieldExpression).type).toBe("booleanField");
				expect((expr.right as BooleanFieldExpression).type).toBe(
					"booleanField",
				);
			}
		});

		test("NOT with boolean field", () => {
			const result = parse("NOT admin");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as NotExpression;
				expect(expr.type).toBe("not");
				expect((expr.expression as BooleanFieldExpression).field).toBe("admin");
			}
		});
	});

	describe("One-of Expressions", () => {
		test("one-of with string values", () => {
			const result = parse('status : ["pending", "approved", "active"]');
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as OneOfExpression;
				expect(expr.type).toBe("oneOf");
				expect(expr.field).toBe("status");
				expect(expr.values).toHaveLength(3);
				expect(expr.values[0]).toEqual({ type: "string", value: "pending" });
			}
		});

		test("one-of with number values", () => {
			const result = parse("priority : [1, 2, 3]");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as OneOfExpression;
				expect(expr.values).toHaveLength(3);
				expect(expr.values[0]).toEqual({ type: "number", value: 1 });
			}
		});

		test("one-of with identifier values", () => {
			const result = parse("role : [admin, moderator, user]");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as OneOfExpression;
				expect(expr.values[0]).toEqual({ type: "identifier", value: "admin" });
			}
		});

		test("not-one-of expression", () => {
			const result = parse('status !: ["inactive", "deleted"]');
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as NotOneOfExpression;
				expect(expr.type).toBe("notOneOf");
				expect(expr.field).toBe("status");
				expect(expr.values).toHaveLength(2);
			}
		});

		test("one-of with single value", () => {
			const result = parse('status : ["active"]');
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as OneOfExpression;
				expect(expr.values).toHaveLength(1);
			}
		});
	});

	describe("Complex Queries", () => {
		test("query with multiple conditions", () => {
			const result = parse(
				'status = "active" AND age >= 18 AND verified = true',
			);
			expect(result.success).toBe(true);
		});

		test("nested conditions with parentheses", () => {
			const result = parse(
				'(role = "admin" OR role = "moderator") AND status = "active"',
			);
			expect(result.success).toBe(true);
		});

		test("field existence with other conditions", () => {
			const result = parse("email? AND verified = true AND age > 18");
			expect(result.success).toBe(true);
		});

		test("one-of with other conditions", () => {
			const result = parse('status : ["pending", "approved"] AND priority > 0');
			expect(result.success).toBe(true);
		});

		test("dotted fields with complex logic", () => {
			const result = parse(
				"user.profile.age >= 18 AND user.settings.notifications = true",
			);
			expect(result.success).toBe(true);
		});
	});

	describe("Whitespace Handling", () => {
		test("extra spaces around operators", () => {
			const result = parse("age   =   18");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.field).toBe("age");
				expect(expr.value).toEqual({ type: "number", value: 18 });
			}
		});

		test("no spaces around operators", () => {
			const result = parse("age=18");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.field).toBe("age");
			}
		});

		test("tabs", () => {
			const result = parse("age\t=\t18");
			expect(result.success).toBe(true);
		});

		test("newlines in query", () => {
			const result = parse("age = 18\nAND\nstatus = active");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.ast.type).toBe("and");
			}
		});

		test("mixed whitespace", () => {
			const result = parse("  age  =  18  AND  \t  status  =  active  ");
			expect(result.success).toBe(true);
		});

		test("spaces in parentheses", () => {
			const result = parse("( age = 18 )");
			expect(result.success).toBe(true);
		});

		test("spaces in array literals", () => {
			const result = parse('status : [ "pending" , "approved" , "active" ]');
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as OneOfExpression;
				expect(expr.values).toHaveLength(3);
			}
		});
	});

	describe("Comments", () => {
		test("single-line comments at end", () => {
			const result = parse("age = 18 // This checks the age");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.field).toBe("age");
			}
		});

		test("comments with expressions after", () => {
			const result = parse("age = 18 // age check\nAND status = active");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.ast.type).toBe("and");
			}
		});

		test("multiple comments", () => {
			const result = parse(
				"age = 18 // first\nAND // second\nstatus = active // third",
			);
			expect(result.success).toBe(true);
		});
	});

	describe("Additional Edge Cases", () => {
		test("field name starting with underscore", () => {
			const result = parse("_id = 123");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.field).toBe("_id");
			}
		});

		test("field names with numbers", () => {
			const result = parse("field123 = 456");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.field).toBe("field123");
			}
		});

		test("zero values", () => {
			const result = parse("count = 0");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.value).toEqual({ type: "number", value: 0 });
			}
		});

		test("negative zero", () => {
			const result = parse("value = -0");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.value).toEqual({ type: "number", value: -0 });
			}
		});

		test("float with leading zero", () => {
			const result = parse("value = 0.5");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.value).toEqual({ type: "number", value: 0.5 });
			}
		});

		test("very large numbers", () => {
			const result = parse("value = 999999999");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.value).toEqual({ type: "number", value: 999999999 });
			}
		});

		test("empty string", () => {
			const result = parse('name = ""');
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.value).toEqual({ type: "string", value: "" });
			}
		});

		test("string with only spaces", () => {
			const result = parse('name = "   "');
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.value).toEqual({ type: "string", value: "   " });
			}
		});

		test("single character strings", () => {
			const result = parse('char = "a"');
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.value).toEqual({ type: "string", value: "a" });
			}
		});

		test("string with special characters", () => {
			const result = parse('text = "!@#$%^&*()"');
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.value).toEqual({ type: "string", value: "!@#$%^&*()" });
			}
		});

		test("deeply nested parentheses", () => {
			const result = parse("(((age = 18)))");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.field).toBe("age");
			}
		});

		test("multiple dots in field name", () => {
			const result = parse("a.b.c.d.e.f = 1");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.field).toBe("a.b.c.d.e.f");
			}
		});

		test("existence check on deeply nested field", () => {
			const result = parse("user.profile.settings.notifications.email?");
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ExistsExpression;
				expect(expr.field).toBe("user.profile.settings.notifications.email");
			}
		});

		test("mixed case in keywords", () => {
			const result = parse("age = 18 AnD status = active oR verified");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.ast.type).toBe("or");
			}
		});

		test("NOT with parenthesized expression", () => {
			const result = parse("NOT (age = 18 AND status = active)");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.ast.type).toBe("not");
			}
		});

		test("complex nested logic", () => {
			const result = parse(
				"((a = 1 AND b = 2) OR (c = 3 AND d = 4)) AND ((e = 5 OR f = 6) AND (g = 7 OR h = 8))",
			);
			expect(result.success).toBe(true);
		});

		test("one-of with mixed value types", () => {
			const result = parse('field : [1, "two", true, identifier]');
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as OneOfExpression;
				expect(expr.values).toHaveLength(4);
				expect(expr.values[0].type).toBe("number");
				expect(expr.values[1].type).toBe("string");
				expect(expr.values[2].type).toBe("boolean");
				expect(expr.values[3].type).toBe("identifier");
			}
		});

		test("backslash escapes in strings", () => {
			const result = parse('path = "C:\\\\Users\\\\Documents"');
			expect(result.success).toBe(true);
			if (result.success) {
				const expr = result.ast as ComparisonExpression;
				expect(expr.value).toEqual({
					type: "string",
					value: "C:\\Users\\Documents",
				});
			}
		});
	});

	describe("Real-world Query Examples", () => {
		test("user authentication query", () => {
			const result = parse(
				'email? AND verified = true AND status : ["active", "premium"]',
			);
			expect(result.success).toBe(true);
		});

		test("age-gated content query", () => {
			const result = parse(
				"(user.age >= 18 OR parent_approval = true) AND content.rating <= user.max_rating",
			);
			expect(result.success).toBe(true);
		});

		test("admin dashboard access query", () => {
			const result = parse(
				'(role : ["admin", "superadmin"]) AND (NOT suspended) AND last_login?',
			);
			expect(result.success).toBe(true);
		});

		test("search filter query", () => {
			const result = parse(
				'category = electronics AND price >= 100 AND price <= 500 AND (brand : ["Apple", "Samsung"]) AND in_stock = true',
			);
			expect(result.success).toBe(true);
		});

		test("notification settings query", () => {
			const result = parse(
				"user.settings.notifications.email = true OR user.settings.notifications.sms = true OR user.settings.notifications.push = true",
			);
			expect(result.success).toBe(true);
		});

		test("multi-line formatted query", () => {
			const query = `
			status = "active"
			AND age >= 18
			AND verified = true
			AND (
				role = "admin"
				OR role = "moderator"
			)
		`;
			const result = parse(query);
			expect(result.success).toBe(true);
		});
	});

	describe("Error Handling", () => {
		test("empty query", () => {
			const result = parse("");
			expect(result.success).toBe(false);
		});

		test("invalid syntax", () => {
			const result = parse("age = = 18");
			expect(result.success).toBe(false);
		});

		test("unclosed string", () => {
			const result = parse('name = "John');
			expect(result.success).toBe(false);
		});

		test("invalid operator", () => {
			const result = parse("age === 18");
			expect(result.success).toBe(false);
		});

		test("unmatched parentheses", () => {
			const result = parse("(age = 18");
			expect(result.success).toBe(false);
		});

		test("keyword as field name without prefix", () => {
			const result = parse("and = 1");
			expect(result.success).toBe(false);
		});

		test("keyword as field name in comparison", () => {
			const result = parse("or = true");
			expect(result.success).toBe(false);
		});

		test("missing value in comparison", () => {
			const result = parse("age =");
			expect(result.success).toBe(false);
		});

		test("missing field in comparison", () => {
			const result = parse("= 18");
			expect(result.success).toBe(false);
		});

		test("empty array in one-of", () => {
			const result = parse("status : []");
			expect(result.success).toBe(false);
		});

		test("unclosed array", () => {
			const result = parse('status : ["pending", "active"');
			expect(result.success).toBe(false);
		});

		test("invalid characters in identifier", () => {
			const result = parse("field-name = 1");
			expect(result.success).toBe(false);
		});

		test("double operators", () => {
			const result = parse("age >> 18");
			expect(result.success).toBe(false);
		});

		test("AND without right operand", () => {
			const result = parse("age = 18 AND");
			expect(result.success).toBe(false);
		});

		test("OR without left operand", () => {
			const result = parse("OR age = 18");
			expect(result.success).toBe(false);
		});
	});

	describe("parseOrThrow", () => {
		test("returns AST on success", () => {
			const ast = parseOrThrow("age = 18");
			expect(ast.type).toBe("comparison");
		});

		test("throws error on parse failure", () => {
			expect(() => parseOrThrow("invalid === query")).toThrow();
		});
	});
});
