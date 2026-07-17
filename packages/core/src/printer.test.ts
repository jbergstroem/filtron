import { describe, expect, test } from "bun:test";
import { parseOrThrow } from "./parser";
import { print } from "./printer";

/**
 * Queries covering every node type, value kind and precedence shape.
 * Each must survive parse -> print -> parse with a deeply equal AST.
 */
const roundtripQueries = [
	"verified",
	"email?",
	"-email",
	"-user.email",
	"NOT suspended",
	"age > 18",
	"age >= 18",
	"age < 65",
	"age <= 65",
	"age = 25",
	"age != 25",
	"age : 18",
	'status = "active"',
	'name ~ "john"',
	'name = "line\\nbreak\\ttab\\r\\\\slash\\"quote"',
	"status = active",
	"user.profile.age >= 18",
	"verified = true",
	"premium = false",
	"score = -1.5",
	"age = 18..65",
	"age != 18..65",
	"score : 0.5..9.75",
	"temperature = -10..30",
	'status : ["pending", "approved"]',
	"role !: [admin, moderator]",
	"priority : [1, 2, 3]",
	'field : [1, "two", true]',
	"created > @2024-06-01",
	"created <= @2024-06-30T14:30:00Z",
	"created = @2024-06-01T08:00:00.500+02:00",
	"updated > @now",
	"updated > @now-7d",
	"scheduled < @now+2h",
	"deployed = @2024-06-01..2024-06-30",
	"created = @now-7d..now",
	"released != @2024-06-01T00:00:00Z..now-1d",
	"a AND b",
	"a OR b",
	"a AND b AND c",
	"a OR b OR c AND d",
	"(a OR b) AND c",
	"NOT (a OR b)",
	"NOT (a AND b) OR c",
	"a AND NOT b",
	"NOT a AND NOT b",
	'(role = "admin" OR role = "moderator") AND status = "active" AND age >= 18',
	"email? AND -deleted AND status : [active] AND age = 18..65 AND created > @now-1w",
];

describe("print()", () => {
	test.each(roundtripQueries)("roundtrips %s", (query) => {
		const ast = parseOrThrow(query);
		const printed = print(ast);
		expect(parseOrThrow(printed)).toEqual(ast);
	});

	test("prints canonically", () => {
		expect(print(parseOrThrow("(a AND (b OR c))"))).toBe("a AND (b OR c)");
		expect(print(parseOrThrow("((a)) AND (b AND c)"))).toBe("a AND b AND c");
		expect(print(parseOrThrow("a OR (b AND c)"))).toBe("a OR b AND c");
		expect(print(parseOrThrow('status="active"AND age>18'))).toBe('status = "active" AND age > 18');
		expect(print(parseOrThrow("NOT NOT a"))).toBe("NOT NOT a");
	});

	test("canonical output is a fixed point", () => {
		for (const query of roundtripQueries) {
			const printed = print(parseOrThrow(query));
			expect(print(parseOrThrow(printed))).toBe(printed);
		}
	});

	test("throws on unknown node and value types", () => {
		expect(() => print({ type: "bogus" } as never)).toThrow("Unknown node type");
		expect(() =>
			print({
				type: "comparison",
				field: "a",
				operator: "=",
				value: { type: "bogus" },
			} as never),
		).toThrow("Unknown value type");
		expect(() =>
			print({
				type: "comparison",
				field: "a",
				operator: "=",
				value: { type: "range", kind: "temporal", min: { type: "bogus" }, max: { type: "now" } },
			} as never),
		).toThrow("Unknown temporal point type");
	});
});
