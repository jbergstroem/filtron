import { describe, test, expect } from "bun:test";
import { parseOrThrow } from "./parser";
import { validateFields } from "./validate";

describe("validateFields()", () => {
	test("passes when all fields are allowed", () => {
		const ast = parseOrThrow('age > 18 AND status = "active"');
		expect(() => validateFields(ast, ["age", "status"])).not.toThrow();
	});

	test("throws on a disallowed field with the exact message", () => {
		const ast = parseOrThrow('password = "secret"');
		expect(() => validateFields(ast, ["name", "age"])).toThrow(
			'Field "password" is not allowed. Allowed fields: name, age',
		);
	});

	test("validates fields nested under and/or/not", () => {
		const ast = parseOrThrow("(a = 1 OR b = 2) AND NOT c?");
		expect(() => validateFields(ast, ["a", "b", "c"])).not.toThrow();
		expect(() => validateFields(ast, ["a", "b"])).toThrow(
			'Field "c" is not allowed. Allowed fields: a, b',
		);
	});

	test("throws on the first disallowed field in pre-order", () => {
		const ast = parseOrThrow("a = 1 AND b = 2 AND c = 3");
		expect(() => validateFields(ast, ["a"])).toThrow('Field "b" is not allowed. Allowed fields: a');
	});

	test("empty allowlist rejects any field", () => {
		const ast = parseOrThrow("a = 1");
		expect(() => validateFields(ast, [])).toThrow('Field "a" is not allowed. Allowed fields: ');
	});
});
