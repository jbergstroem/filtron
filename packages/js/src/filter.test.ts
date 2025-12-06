import type {
	ComparisonExpression,
	AndExpression,
	OrExpression,
	NotExpression,
	OneOfExpression,
	NotOneOfExpression,
	ExistsExpression,
	BooleanFieldExpression,
	RangeExpression,
} from "@filtron/core";
import { describe, test, expect } from "bun:test";
import { toFilter, nestedAccessor } from "./filter.js";

describe("toFilter", () => {
	describe("Comparison Operators", () => {
		test("equals (=) with string", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "status",
				operator: "=",
				value: { type: "string", value: "active" },
			};
			const filter = toFilter(ast);
			expect(filter({ status: "active" })).toBe(true);
			expect(filter({ status: "inactive" })).toBe(false);
		});

		test("colon (:) operator", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "role",
				operator: ":",
				value: { type: "identifier", value: "admin" },
			};
			const filter = toFilter(ast);
			expect(filter({ role: "admin" })).toBe(true);
			expect(filter({ role: "user" })).toBe(false);
		});

		test("not equals (!=)", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "status",
				operator: "!=",
				value: { type: "string", value: "deleted" },
			};
			const filter = toFilter(ast);
			expect(filter({ status: "active" })).toBe(true);
			expect(filter({ status: "deleted" })).toBe(false);
		});

		test("greater than (>)", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "age",
				operator: ">",
				value: { type: "number", value: 18 },
			};
			const filter = toFilter(ast);
			expect(filter({ age: 19 })).toBe(true);
			expect(filter({ age: 18 })).toBe(false);
			expect(filter({ age: "25" })).toBe(false); // non-number returns false
		});

		test("greater than or equal (>=)", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "age",
				operator: ">=",
				value: { type: "number", value: 18 },
			};
			const filter = toFilter(ast);
			expect(filter({ age: 18 })).toBe(true);
			expect(filter({ age: 17 })).toBe(false);
		});

		test("less than (<)", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "price",
				operator: "<",
				value: { type: "number", value: 100 },
			};
			const filter = toFilter(ast);
			expect(filter({ price: 99 })).toBe(true);
			expect(filter({ price: 100 })).toBe(false);
		});

		test("less than or equal (<=)", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "price",
				operator: "<=",
				value: { type: "number", value: 100 },
			};
			const filter = toFilter(ast);
			expect(filter({ price: 100 })).toBe(true);
			expect(filter({ price: 101 })).toBe(false);
		});

		test("contains (~)", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "name",
				operator: "~",
				value: { type: "string", value: "john" },
			};
			const filter = toFilter(ast);
			expect(filter({ name: "john doe" })).toBe(true);
			expect(filter({ name: "jane" })).toBe(false);
			expect(filter({ name: 123 })).toBe(false); // non-string returns false
		});

		test("boolean value type", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "active",
				operator: "=",
				value: { type: "boolean", value: true },
			};
			const filter = toFilter(ast);
			expect(filter({ active: true })).toBe(true);
			expect(filter({ active: false })).toBe(false);
		});
	});

	describe("Boolean Expressions", () => {
		test("AND expression", () => {
			const ast: AndExpression = {
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
			const filter = toFilter(ast);
			expect(filter({ age: 25, status: "active" })).toBe(true);
			expect(filter({ age: 25, status: "inactive" })).toBe(false);
			expect(filter({ age: 16, status: "active" })).toBe(false);
		});

		test("OR expression", () => {
			const ast: OrExpression = {
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
			const filter = toFilter(ast);
			expect(filter({ role: "admin" })).toBe(true);
			expect(filter({ role: "moderator" })).toBe(true);
			expect(filter({ role: "user" })).toBe(false);
		});

		test("NOT expression", () => {
			const ast: NotExpression = {
				type: "not",
				expression: {
					type: "comparison",
					field: "status",
					operator: "=",
					value: { type: "string", value: "deleted" },
				},
			};
			const filter = toFilter(ast);
			expect(filter({ status: "active" })).toBe(true);
			expect(filter({ status: "deleted" })).toBe(false);
		});
	});

	describe("Range Expression", () => {
		test("basic range", () => {
			const ast: RangeExpression = {
				type: "range",
				field: "age",
				min: 18,
				max: 65,
			};
			const filter = toFilter(ast);
			expect(filter({ age: 18 })).toBe(true);
			expect(filter({ age: 65 })).toBe(true);
			expect(filter({ age: 30 })).toBe(true);
			expect(filter({ age: 17 })).toBe(false);
			expect(filter({ age: "30" })).toBe(false); // non-number returns false
		});
	});

	describe("One-of Expressions", () => {
		test("oneOf with values", () => {
			const ast: OneOfExpression = {
				type: "oneOf",
				field: "status",
				values: [
					{ type: "string", value: "pending" },
					{ type: "string", value: "approved" },
				],
			};
			const filter = toFilter(ast);
			expect(filter({ status: "pending" })).toBe(true);
			expect(filter({ status: "rejected" })).toBe(false);
		});

		test("oneOf with empty array", () => {
			const ast: OneOfExpression = {
				type: "oneOf",
				field: "status",
				values: [],
			};
			const filter = toFilter(ast);
			expect(filter({ status: "anything" })).toBe(false);
		});

		test("notOneOf with values", () => {
			const ast: NotOneOfExpression = {
				type: "notOneOf",
				field: "status",
				values: [
					{ type: "string", value: "deleted" },
					{ type: "string", value: "archived" },
				],
			};
			const filter = toFilter(ast);
			expect(filter({ status: "active" })).toBe(true);
			expect(filter({ status: "deleted" })).toBe(false);
		});

		test("notOneOf with empty array", () => {
			const ast: NotOneOfExpression = {
				type: "notOneOf",
				field: "status",
				values: [],
			};
			const filter = toFilter(ast);
			expect(filter({ status: "anything" })).toBe(true);
		});
	});

	describe("Exists Expression", () => {
		test("exists with present/absent field", () => {
			const ast: ExistsExpression = {
				type: "exists",
				field: "email",
			};
			const filter = toFilter(ast);
			expect(filter({ email: "test@example.com" })).toBe(true);
			expect(filter({ email: "" })).toBe(true);
			expect(filter({ email: null })).toBe(false);
			expect(filter({ email: undefined })).toBe(false);
			expect(filter({ name: "test" })).toBe(false);
		});
	});

	describe("Boolean Field Expression", () => {
		test("strict boolean equality", () => {
			const ast: BooleanFieldExpression = {
				type: "booleanField",
				field: "verified",
			};
			const filter = toFilter(ast);
			expect(filter({ verified: true })).toBe(true);
			expect(filter({ verified: false })).toBe(false);
			expect(filter({ verified: 1 })).toBe(false); // strict equality
		});
	});

	describe("Case Insensitive Option", () => {
		test("case insensitive equals", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "name",
				operator: "=",
				value: { type: "string", value: "John" },
			};
			const filter = toFilter(ast, { caseInsensitive: true });
			expect(filter({ name: "john" })).toBe(true);
			expect(filter({ name: "JOHN" })).toBe(true);
		});

		test("case insensitive not equals", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "status",
				operator: "!=",
				value: { type: "string", value: "Active" },
			};
			const filter = toFilter(ast, { caseInsensitive: true });
			expect(filter({ status: "inactive" })).toBe(true);
			expect(filter({ status: "ACTIVE" })).toBe(false);
		});

		test("case insensitive contains", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "description",
				operator: "~",
				value: { type: "string", value: "Hello" },
			};
			const filter = toFilter(ast, { caseInsensitive: true });
			expect(filter({ description: "hello world" })).toBe(true);
			expect(filter({ description: "goodbye" })).toBe(false);
		});

		test("case insensitive oneOf", () => {
			const ast: OneOfExpression = {
				type: "oneOf",
				field: "color",
				values: [{ type: "string", value: "Red" }],
			};
			const filter = toFilter(ast, { caseInsensitive: true });
			expect(filter({ color: "RED" })).toBe(true);
			expect(filter({ color: "blue" })).toBe(false);
		});

		test("case insensitive notOneOf", () => {
			const ast: NotOneOfExpression = {
				type: "notOneOf",
				field: "status",
				values: [{ type: "string", value: "Deleted" }],
			};
			const filter = toFilter(ast, { caseInsensitive: true });
			expect(filter({ status: "active" })).toBe(true);
			expect(filter({ status: "DELETED" })).toBe(false);
		});
	});

	describe("Allowed Fields Option", () => {
		test("allows listed fields", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "name",
				operator: "=",
				value: { type: "string", value: "test" },
			};
			const filter = toFilter(ast, { allowedFields: ["name"] });
			expect(filter({ name: "test" })).toBe(true);
		});

		test("throws error for unlisted field", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "password",
				operator: "=",
				value: { type: "string", value: "secret" },
			};
			expect(() => toFilter(ast, { allowedFields: ["name"] })).toThrow(
				'Field "password" is not allowed',
			);
		});

		test("validates all expression types", () => {
			expect(() => toFilter({ type: "exists", field: "x" }, { allowedFields: [] })).toThrow(
				'Field "x" is not allowed',
			);

			expect(() => toFilter({ type: "booleanField", field: "x" }, { allowedFields: [] })).toThrow(
				'Field "x" is not allowed',
			);

			expect(() =>
				toFilter({ type: "oneOf", field: "x", values: [] }, { allowedFields: [] }),
			).toThrow('Field "x" is not allowed');

			expect(() =>
				toFilter({ type: "range", field: "x", min: 0, max: 1 }, { allowedFields: [] }),
			).toThrow('Field "x" is not allowed');
		});
	});

	describe("Custom Field Accessor", () => {
		test("nestedAccessor basic", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "user.name",
				operator: "=",
				value: { type: "string", value: "Alice" },
			};
			const filter = toFilter(ast, { fieldAccessor: nestedAccessor() });
			expect(filter({ user: { name: "Alice" } })).toBe(true);
			expect(filter({ user: { name: "Bob" } })).toBe(false);
		});

		test("nestedAccessor handles missing paths", () => {
			const ast: ExistsExpression = {
				type: "exists",
				field: "user.email",
			};
			const filter = toFilter(ast, { fieldAccessor: nestedAccessor() });
			expect(filter({ user: { email: "a@b.com" } })).toBe(true);
			expect(filter({ user: {} })).toBe(false);
			expect(filter({ user: null })).toBe(false);
		});

		test("nestedAccessor custom separator", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "user/name",
				operator: "=",
				value: { type: "string", value: "Alice" },
			};
			const filter = toFilter(ast, { fieldAccessor: nestedAccessor("/") });
			expect(filter({ user: { name: "Alice" } })).toBe(true);
		});

		test("custom field accessor function", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "NAME",
				operator: "=",
				value: { type: "string", value: "alice" },
			};
			const filter = toFilter(ast, {
				fieldAccessor: (obj, field) => obj[field.toLowerCase()],
			});
			expect(filter({ name: "alice" })).toBe(true);
		});
	});

	describe("Array.filter Integration", () => {
		test("filters array of objects", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "active",
				operator: "=",
				value: { type: "boolean", value: true },
			};
			const items = [
				{ id: 1, active: true },
				{ id: 2, active: false },
			];
			const result = items.filter(toFilter(ast));
			expect(result).toEqual([{ id: 1, active: true }]);
		});
	});

	describe("TypeScript Generics", () => {
		interface User {
			name: string;
			age: number;
			[key: string]: unknown;
		}

		test("typed filter predicate", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "age",
				operator: ">",
				value: { type: "number", value: 18 },
			};
			const filter = toFilter<User>(ast);
			const users: User[] = [
				{ name: "Alice", age: 25 },
				{ name: "Bob", age: 16 },
			];
			const adults = users.filter(filter);
			expect(adults).toHaveLength(1);
			expect(adults[0].name).toBe("Alice");
		});
	});

	describe("Field Mapping Option", () => {
		test("maps single field name", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "email",
				operator: "=",
				value: { type: "string", value: "test@example.com" },
			};
			const filter = toFilter(ast, {
				fieldMapping: {
					email: "emailAddress",
				},
			});
			expect(filter({ emailAddress: "test@example.com" })).toBe(true);
			expect(filter({ emailAddress: "other@example.com" })).toBe(false);
		});

		test("maps multiple fields", () => {
			const ast: AndExpression = {
				type: "and",
				left: {
					type: "comparison",
					field: "first_name",
					operator: "=",
					value: { type: "string", value: "John" },
				},
				right: {
					type: "comparison",
					field: "last_name",
					operator: "=",
					value: { type: "string", value: "Doe" },
				},
			};
			const filter = toFilter(ast, {
				fieldMapping: {
					first_name: "firstName",
					last_name: "lastName",
				},
			});
			expect(filter({ firstName: "John", lastName: "Doe" })).toBe(true);
			expect(filter({ firstName: "Jane", lastName: "Doe" })).toBe(false);
		});

		test("works with oneOf expression", () => {
			const ast: OneOfExpression = {
				type: "oneOf",
				field: "user_status",
				values: [
					{ type: "string", value: "active" },
					{ type: "string", value: "pending" },
				],
			};
			const filter = toFilter(ast, {
				fieldMapping: {
					user_status: "status",
				},
			});
			expect(filter({ status: "active" })).toBe(true);
			expect(filter({ status: "inactive" })).toBe(false);
		});

		test("works with exists expression", () => {
			const ast: ExistsExpression = {
				type: "exists",
				field: "user_email",
			};
			const filter = toFilter(ast, {
				fieldMapping: {
					user_email: "email",
				},
			});
			expect(filter({ email: "test@example.com" })).toBe(true);
			expect(filter({ email: null })).toBe(false);
		});

		test("works with range expression", () => {
			const ast: RangeExpression = {
				type: "range",
				field: "user_age",
				min: 18,
				max: 65,
			};
			const filter = toFilter(ast, {
				fieldMapping: {
					user_age: "age",
				},
			});
			expect(filter({ age: 30 })).toBe(true);
			expect(filter({ age: 17 })).toBe(false);
		});

		test("unmapped fields use original name", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "status",
				operator: "=",
				value: { type: "string", value: "active" },
			};
			const filter = toFilter(ast, {
				fieldMapping: {
					email: "emailAddress",
				},
			});
			expect(filter({ status: "active" })).toBe(true);
		});

		test("works with allowedFields", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "email",
				operator: "=",
				value: { type: "string", value: "test@example.com" },
			};
			const filter = toFilter(ast, {
				fieldMapping: {
					email: "emailAddress",
				},
				allowedFields: ["email"],
			});
			expect(filter({ emailAddress: "test@example.com" })).toBe(true);
		});

		test("works with nested accessor", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "user_name",
				operator: "=",
				value: { type: "string", value: "Alice" },
			};
			const filter = toFilter(ast, {
				fieldMapping: {
					user_name: "user.profile.name",
				},
				fieldAccessor: nestedAccessor(),
			});
			expect(filter({ user: { profile: { name: "Alice" } } })).toBe(true);
			expect(filter({ user: { profile: { name: "Bob" } } })).toBe(false);
		});
	});
});
