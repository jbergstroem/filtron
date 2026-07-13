import { describe, test, expect } from "bun:test";
import { parseOrThrow } from "./parser";
import type { ASTNode } from "./types";
import { walk } from "./walker";

describe("walk()", () => {
	test("visits every node type in pre-order with children in order", () => {
		const ast = parseOrThrow(
			'(a = 1 OR b : [1, 2]) AND NOT c !: ["x", "y"] AND d? AND e AND f = 1..5',
		);
		const visited: string[] = [];
		walk(ast, (node) => {
			visited.push("field" in node ? `${node.type}:${node.field}` : node.type);
		});
		expect(visited).toEqual([
			"and",
			"or",
			"comparison:a",
			"oneOf:b",
			"not",
			"oneOf:c",
			"exists:d",
			"booleanField:e",
			"comparison:f",
		]);
	});

	test("returning false skips a node's children but not its siblings", () => {
		const ast = parseOrThrow("(a = 1 OR b = 2) AND NOT c AND d");
		const visited: string[] = [];
		walk(ast, (node) => {
			visited.push("field" in node ? node.field : node.type);
			if (node.type === "or" || node.type === "not") {
				return false;
			}
			return true;
		});
		expect(visited).toEqual(["and", "or", "not", "d"]);
	});

	test("throws on unknown node type", () => {
		const invalid = { type: "bogus" } as unknown as ASTNode;
		expect(() => walk(invalid, () => undefined)).toThrow("Unknown node type: bogus");
	});
});
