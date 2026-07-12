import { describe, test, expect } from "bun:test";
import type {
	ComparisonExpression,
	AndExpression,
	OrExpression,
	NotExpression,
	OneOfExpression,
	ExistsExpression,
	BooleanFieldExpression,
	RangeExpression,
} from "@filtron/core";
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
			const filter = toFilter(ast);
			expect(filter({ age: 25, status: "active" })).toBe(true);
			expect(filter({ age: 25, status: "inactive" })).toBe(false);
			expect(filter({ age: 16, status: "active" })).toBe(false);
		});

		test("OR expression", () => {
			const ast: OrExpression = {
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
				negated: false,
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
				negated: false,
				field: "status",
				values: [],
			};
			const filter = toFilter(ast);
			expect(filter({ status: "anything" })).toBe(false);
		});

		test("notOneOf with values", () => {
			const ast: OneOfExpression = {
				type: "oneOf",
				negated: true,
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
			const ast: OneOfExpression = {
				type: "oneOf",
				negated: true,
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
				negated: false,
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
				negated: false,
				field: "color",
				values: [{ type: "string", value: "Red" }],
			};
			const filter = toFilter(ast, { caseInsensitive: true });
			expect(filter({ color: "RED" })).toBe(true);
			expect(filter({ color: "blue" })).toBe(false);
		});

		test("case insensitive notOneOf", () => {
			const ast: OneOfExpression = {
				type: "oneOf",
				negated: true,
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
			expect(() =>
				toFilter({ type: "exists", negated: false, field: "x" }, { allowedFields: [] }),
			).toThrow('Field "x" is not allowed');

			expect(() => toFilter({ type: "booleanField", field: "x" }, { allowedFields: [] })).toThrow(
				'Field "x" is not allowed',
			);

			expect(() =>
				toFilter({ type: "oneOf", negated: false, field: "x", values: [] }, { allowedFields: [] }),
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
				negated: false,
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
				children: [
					{
						type: "comparison",
						field: "first_name",
						operator: "=",
						value: { type: "string", value: "John" },
					},
					{
						type: "comparison",
						field: "last_name",
						operator: "=",
						value: { type: "string", value: "Doe" },
					},
				],
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
				negated: false,
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
				negated: false,
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

	describe("Custom Accessor Operator Coverage", () => {
		const accessor = (obj: Record<string, unknown>, field: string) => obj[field];

		test.each([
			[">", 18, { age: 25 }, true],
			[">", 18, { age: 10 }, false],
			[">=", 18, { age: 18 }, true],
			[">=", 18, { age: 17 }, false],
			["<", 18, { age: 10 }, true],
			["<", 18, { age: 25 }, false],
			["<=", 18, { age: 18 }, true],
			["<=", 18, { age: 25 }, false],
		] as const)("numeric %s with custom accessor", (operator, value, item, expected) => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "age",
				operator,
				value: { type: "number", value },
			};
			const filter = toFilter(ast, { fieldAccessor: accessor });
			expect(filter(item as Record<string, unknown>)).toBe(expected);
		});

		const comparisonWith = (operator: "=" | "!=", value: string): ComparisonExpression => ({
			type: "comparison",
			field: "status",
			operator,
			value: { type: "string", value },
		});

		test("equals and not-equals with custom accessor", () => {
			const eq = comparisonWith("=", "active");
			const neq = comparisonWith("!=", "active");
			expect(toFilter(eq, { fieldAccessor: accessor })({ status: "active" })).toBe(true);
			expect(toFilter(neq, { fieldAccessor: accessor })({ status: "active" })).toBe(false);
		});

		test("case-insensitive equals and not-equals with custom accessor", () => {
			const eq = comparisonWith("=", "Active");
			const neq = comparisonWith("!=", "Active");
			const opts = { fieldAccessor: accessor, caseInsensitive: true };
			expect(toFilter(eq, opts)({ status: "ACTIVE" })).toBe(true);
			expect(toFilter(eq, opts)({ status: 1 })).toBe(false);
			expect(toFilter(neq, opts)({ status: "ACTIVE" })).toBe(false);
			expect(toFilter(neq, opts)({ status: 1 })).toBe(true);
		});

		test("contains (~) with custom accessor", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "name",
				operator: "~",
				value: { type: "string", value: "Ali" },
			};
			expect(toFilter(ast, { fieldAccessor: accessor })({ name: "Alice" })).toBe(true);
			expect(toFilter(ast, { fieldAccessor: accessor })({ name: "Bob" })).toBe(false);
			const ci = { fieldAccessor: accessor, caseInsensitive: true };
			expect(toFilter(ast, ci)({ name: "MALICE" })).toBe(true);
			expect(toFilter(ast, ci)({ name: 5 })).toBe(false);
		});

		test("case-insensitive contains without accessor handles non-strings", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "name",
				operator: "~",
				value: { type: "string", value: "Ali" },
			};
			const filter = toFilter(ast, { caseInsensitive: true });
			expect(filter({ name: "MALICE" })).toBe(true);
			expect(filter({ name: 5 })).toBe(false);
		});

		test("exists, booleanField and range with custom accessor", () => {
			const exists: ExistsExpression = { type: "exists", negated: false, field: "email" };
			const boolField: BooleanFieldExpression = { type: "booleanField", field: "verified" };
			const range: RangeExpression = { type: "range", field: "age", min: 18, max: 65 };
			const opts = { fieldAccessor: accessor };
			expect(toFilter(exists, opts)({ email: "a@b.c" })).toBe(true);
			expect(toFilter(exists, opts)({ email: null })).toBe(false);
			expect(toFilter(boolField, opts)({ verified: true })).toBe(true);
			expect(toFilter(boolField, opts)({ verified: 1 })).toBe(false);
			expect(toFilter(range, opts)({ age: 30 })).toBe(true);
			expect(toFilter(range, opts)({ age: 66 })).toBe(false);
		});

		test("oneOf and notOneOf with custom accessor", () => {
			const smallValues = [
				{ type: "string" as const, value: "a" },
				{ type: "string" as const, value: "b" },
			];
			const small: OneOfExpression = {
				type: "oneOf",
				negated: false,
				field: "status",
				values: smallValues,
			};
			const opts = { fieldAccessor: accessor };
			expect(toFilter(small, opts)({ status: "a" })).toBe(true);
			expect(toFilter(small, opts)({ status: "c" })).toBe(false);

			const smallNot: OneOfExpression = {
				type: "oneOf",
				negated: true,
				field: "status",
				values: smallValues,
			};
			expect(toFilter(smallNot, opts)({ status: "a" })).toBe(false);
			expect(toFilter(smallNot, opts)({ status: "c" })).toBe(true);

			const largeValues = Array.from({ length: 15 }, (_, i) => ({
				type: "string" as const,
				value: `item${i}`,
			}));
			const large: OneOfExpression = {
				type: "oneOf",
				negated: false,
				field: "status",
				values: largeValues,
			};
			expect(toFilter(large, opts)({ status: "item3" })).toBe(true);
			expect(toFilter(large, opts)({ status: "nope" })).toBe(false);

			const largeNot: OneOfExpression = {
				type: "oneOf",
				negated: true,
				field: "status",
				values: largeValues,
			};
			expect(toFilter(largeNot, opts)({ status: "item3" })).toBe(false);
			expect(toFilter(largeNot, opts)({ status: "nope" })).toBe(true);
		});

		test("case-insensitive membership with custom accessor", () => {
			const values = [
				{ type: "string" as const, value: "Alpha" },
				{ type: "string" as const, value: "Beta" },
			];
			const oneOf: OneOfExpression = { type: "oneOf", negated: false, field: "status", values };
			const notOneOf: OneOfExpression = { type: "oneOf", negated: true, field: "status", values };
			const opts = { fieldAccessor: accessor, caseInsensitive: true };
			expect(toFilter(oneOf, opts)({ status: "ALPHA" })).toBe(true);
			expect(toFilter(oneOf, opts)({ status: "gamma" })).toBe(false);
			expect(toFilter(notOneOf, opts)({ status: "ALPHA" })).toBe(false);
			expect(toFilter(notOneOf, opts)({ status: "gamma" })).toBe(true);

			const largeValues = Array.from({ length: 15 }, (_, i) => ({
				type: "string" as const,
				value: `Item${i}`,
			}));
			const largeOneOf: OneOfExpression = {
				type: "oneOf",
				negated: false,
				field: "status",
				values: largeValues,
			};
			const largeNotOneOf: OneOfExpression = {
				type: "oneOf",
				negated: true,
				field: "status",
				values: largeValues,
			};
			expect(toFilter(largeOneOf, opts)({ status: "ITEM3" })).toBe(true);
			expect(toFilter(largeNotOneOf, opts)({ status: "ITEM3" })).toBe(false);
		});
	});

	describe("Chain Flattening", () => {
		const comparison = (field: string, value: number): ComparisonExpression => ({
			type: "comparison",
			field,
			operator: "=",
			value: { type: "number", value },
		});

		const chain = (
			type: "and" | "or",
			leaves: ComparisonExpression[],
		): AndExpression | OrExpression => {
			return { type, children: leaves } as AndExpression;
		};

		const leaves = (n: number) => Array.from({ length: n }, (_, i) => comparison(`f${i}`, i));
		const match = (n: number) =>
			Object.fromEntries(Array.from({ length: n }, (_, i) => [`f${i}`, i]));

		test.each([3, 4, 5])("AND chain with %i terms", (n) => {
			const filter = toFilter(chain("and", leaves(n)));
			expect(filter(match(n))).toBe(true);
			expect(filter(Object.assign(match(n), { f0: -1 }))).toBe(false);
			expect(filter(Object.assign(match(n), { [`f${n - 1}`]: -1 }))).toBe(false);
		});

		test.each([3, 4, 5])("OR chain with %i terms", (n) => {
			const filter = toFilter(chain("or", leaves(n)));
			const none = () => Object.fromEntries(Array.from({ length: n }, (_, i) => [`f${i}`, -1]));
			expect(filter(none())).toBe(false);
			expect(filter(Object.assign(none(), { f0: 0 }))).toBe(true);
			expect(filter(Object.assign(none(), { [`f${n - 1}`]: n - 1 }))).toBe(true);
		});

		test("hand-built nested same-type nodes still evaluate correctly", () => {
			// The parser never produces this shape, but adapters accept it
			const [a, b, c] = leaves(3);
			const nested: AndExpression = {
				type: "and",
				children: [a, { type: "and", children: [b, c] }],
			};
			const filter = toFilter(nested);
			expect(filter(match(3))).toBe(true);
			expect(filter(Object.assign(match(3), { f1: -1 }))).toBe(false);
		});
	});

	describe("Small Membership Specialization", () => {
		const oneOfWith = (count: number): OneOfExpression => ({
			type: "oneOf",
			negated: false,
			field: "status",
			values: Array.from({ length: count }, (_, i) => ({
				type: "string" as const,
				value: `v${i}`,
			})),
		});

		test.each([1, 2, 3, 4])("oneOf with %i values", (n) => {
			const filter = toFilter(oneOfWith(n));
			for (let i = 0; i < n; i++) {
				expect(filter({ status: `v${i}` })).toBe(true);
			}
			expect(filter({ status: "missing" })).toBe(false);
		});

		test.each([1, 2, 3, 4])("notOneOf with %i values", (n) => {
			const ast: OneOfExpression = {
				type: "oneOf",
				negated: true,
				field: "status",
				values: oneOfWith(n).values,
			};
			const filter = toFilter(ast);
			for (let i = 0; i < n; i++) {
				expect(filter({ status: `v${i}` })).toBe(false);
			}
			expect(filter({ status: "missing" })).toBe(true);
		});
	});

	describe("Invalid AST Input", () => {
		test("throws on unknown node type", () => {
			const ast = { type: "bogus" } as unknown as ComparisonExpression;
			expect(() => toFilter(ast)).toThrow("Unknown node type");
		});

		test("throws on unknown operator", () => {
			const ast = {
				type: "comparison",
				field: "a",
				operator: "**",
				value: { type: "number", value: 1 },
			} as unknown as ComparisonExpression;
			expect(() => toFilter(ast)).toThrow("Unknown operator");
		});
	});

	describe("Optimization Behaviors", () => {
		test("oneOf with >10 items uses Set path", () => {
			const values = Array.from({ length: 15 }, (_, i) => ({
				type: "string" as const,
				value: `item${i}`,
			}));
			const ast: OneOfExpression = { type: "oneOf", negated: false, field: "status", values };
			const filter = toFilter(ast);
			expect(filter({ status: "item0" })).toBe(true);
			expect(filter({ status: "item14" })).toBe(true);
			expect(filter({ status: "notfound" })).toBe(false);
		});

		test("case-insensitive oneOf with >10 items uses Set path", () => {
			const values = Array.from({ length: 15 }, (_, i) => ({
				type: "string" as const,
				value: `Item${i}`,
			}));
			const ast: OneOfExpression = { type: "oneOf", negated: false, field: "status", values };
			const filter = toFilter(ast, { caseInsensitive: true });
			expect(filter({ status: "item0" })).toBe(true);
			expect(filter({ status: "ITEM0" })).toBe(true);
			expect(filter({ status: "item15" })).toBe(false);
		});

		test("notOneOf with >10 items uses Set path", () => {
			const values = Array.from({ length: 15 }, (_, i) => ({
				type: "string" as const,
				value: `item${i}`,
			}));
			const ast: OneOfExpression = { type: "oneOf", negated: true, field: "status", values };
			const filter = toFilter(ast);
			expect(filter({ status: "allowed" })).toBe(true);
			expect(filter({ status: "item0" })).toBe(false);
		});

		test("case-insensitive notOneOf with >10 items uses Set path", () => {
			const values = Array.from({ length: 15 }, (_, i) => ({
				type: "string" as const,
				value: `Item${i}`,
			}));
			const ast: OneOfExpression = { type: "oneOf", negated: true, field: "status", values };
			const filter = toFilter(ast, { caseInsensitive: true });
			expect(filter({ status: "allowed" })).toBe(true);
			expect(filter({ status: "ITEM0" })).toBe(false);
		});

		test("numeric operators return false for non-numeric values", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "age",
				operator: ">",
				value: { type: "number", value: 18 },
			};
			const filter = toFilter(ast);
			expect(filter({ age: "25" })).toBe(false);
			expect(filter({ age: 25 })).toBe(true);
		});

		test("contains (~) returns false for non-string target", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "name",
				operator: "~",
				value: { type: "number", value: 123 },
			};
			const filter = toFilter(ast);
			expect(filter({ name: "test123" })).toBe(false);
		});

		test("case-insensitive equals handles non-string field values", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "value",
				operator: "=",
				value: { type: "string", value: "test" },
			};
			const filter = toFilter(ast, { caseInsensitive: true });
			expect(filter({ value: 123 })).toBe(false);
			expect(filter({ value: "TEST" })).toBe(true);
		});

		test("case-insensitive not-equals handles non-string field values", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "value",
				operator: "!=",
				value: { type: "string", value: "test" },
			};
			const filter = toFilter(ast, { caseInsensitive: true });
			expect(filter({ value: 123 })).toBe(true);
			expect(filter({ value: "TEST" })).toBe(false);
		});

		test("nestedAccessor handles non-object intermediate values", () => {
			const ast: ComparisonExpression = {
				type: "comparison",
				field: "user.name",
				operator: "=",
				value: { type: "string", value: "Alice" },
			};
			const filter = toFilter(ast, { fieldAccessor: nestedAccessor() });
			expect(filter({ user: "not-an-object" })).toBe(false);
			expect(filter({ user: 123 })).toBe(false);
		});
	});
});
