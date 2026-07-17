import { describe, expect, test } from "bun:test";
import type { ComparisonExpression, OneOfExpression } from "@filtron/core";
import { parseOrThrow } from "@filtron/core";
import { toFilter } from "@filtron/js";
import { toSQL } from "@filtron/sql";
import { resolveTemporal } from "./resolve.js";

const now = new Date("2026-07-17T12:00:00.000Z");

function resolvedValue(query: string): unknown {
	const ast = resolveTemporal(parseOrThrow(query), { now }) as ComparisonExpression;
	return ast.value;
}

describe("resolveTemporal", () => {
	test("bare now resolves to the reference instant", () => {
		expect(resolvedValue("created > @now")).toEqual({
			type: "date",
			value: "2026-07-17T12:00:00.000Z",
		});
	});

	test.each([
		["@now-30s", "2026-07-17T11:59:30.000Z"],
		["@now-5m", "2026-07-17T11:55:00.000Z"],
		["@now+2h", "2026-07-17T14:00:00.000Z"],
		["@now-7d", "2026-07-10T12:00:00.000Z"],
		["@now-1w", "2026-07-10T12:00:00.000Z"],
		["@now-1M", "2026-06-17T12:00:00.000Z"],
		["@now+1y", "2027-07-17T12:00:00.000Z"],
	])("%s resolves against a fixed reference", (point, expected) => {
		expect(resolvedValue(`created > ${point}`)).toEqual({ type: "date", value: expected });
	});

	test("month arithmetic clamps to the last day of the target month", () => {
		const endOfJuly = new Date("2026-07-31T08:00:00.000Z");
		const ast = resolveTemporal(parseOrThrow("created > @now-1M"), {
			now: endOfJuly,
		}) as ComparisonExpression;
		expect(ast.value).toEqual({ type: "date", value: "2026-06-30T08:00:00.000Z" });
	});

	test("year arithmetic clamps leap days", () => {
		const leapDay = new Date("2024-02-29T00:00:00.000Z");
		const ast = resolveTemporal(parseOrThrow("created > @now+1y"), {
			now: leapDay,
		}) as ComparisonExpression;
		expect(ast.value).toEqual({ type: "date", value: "2025-02-28T00:00:00.000Z" });
	});

	test("resolves both bounds of a temporal range", () => {
		expect(resolvedValue("created = @now-7d..now")).toEqual({
			type: "range",
			kind: "temporal",
			min: { type: "date", value: "2026-07-10T12:00:00.000Z" },
			max: { type: "date", value: "2026-07-17T12:00:00.000Z" },
		});
	});

	test("resolves a mixed range with one absolute bound", () => {
		expect(resolvedValue("created = @2026-01-01..now")).toEqual({
			type: "range",
			kind: "temporal",
			min: { type: "date", value: "2026-01-01" },
			max: { type: "date", value: "2026-07-17T12:00:00.000Z" },
		});
	});

	test("throws when a resolved range inverts", () => {
		expect(() => resolveTemporal(parseOrThrow("created = @now-1d..now-7d"), { now })).toThrow(
			"Resolved range min (2026-07-16T12:00:00.000Z) must not exceed max (2026-07-10T12:00:00.000Z)",
		);
	});

	test("resolves relative values nested under logic nodes", () => {
		const ast = resolveTemporal(
			parseOrThrow('status = "active" AND NOT (created < @now-1d OR deleted?)'),
			{ now },
		);
		expect(JSON.stringify(ast)).toContain("2026-07-16T12:00:00.000Z");
		expect(JSON.stringify(ast)).not.toContain('"now"');
	});

	test("returns identical nodes when nothing is relative", () => {
		const ast = parseOrThrow(
			'status = "active" AND NOT role : [admin, owner] AND age = 18..65 AND created = @2026-01-01..2026-02-01',
		);
		expect(resolveTemporal(ast, { now })).toBe(ast);
	});

	test("shares untouched siblings when rebuilding", () => {
		const ast = parseOrThrow('status = "active" AND created > @now-1d');
		const resolved = resolveTemporal(ast, { now });
		expect(resolved).not.toBe(ast);
		if (ast.type === "and" && resolved.type === "and") {
			expect(resolved.children[0]).toBe(ast.children[0]);
			expect(resolved.children[1]).not.toBe(ast.children[1]);
		} else {
			throw new Error("Expected and nodes");
		}
	});

	test("resolves hand-built now values in membership arrays", () => {
		const ast: OneOfExpression = {
			type: "oneOf",
			field: "created",
			negated: false,
			values: [{ type: "now", offset: null }],
		};
		const resolved = resolveTemporal(ast, { now }) as OneOfExpression;
		expect(resolved.values[0]).toEqual({ type: "date", value: "2026-07-17T12:00:00.000Z" });
	});

	test("defaults to the current clock", () => {
		const before = Date.now();
		const value = resolveTemporal(parseOrThrow("created <= @now")) as ComparisonExpression;
		const after = Date.now();
		if (value.value.type !== "date") {
			throw new Error("Expected a date value");
		}
		const resolved = Date.parse(value.value.value);
		expect(resolved).toBeGreaterThanOrEqual(before);
		expect(resolved).toBeLessThanOrEqual(after);
	});

	test("throws on an invalid reference time", () => {
		expect(() =>
			resolveTemporal(parseOrThrow("created > @now"), { now: new Date("nope") }),
		).toThrow("Invalid reference time");
	});

	test("throws on unknown node, value and unit inputs", () => {
		expect(() => resolveTemporal({ type: "bogus" } as never, { now })).toThrow("Unknown node type");
		expect(() =>
			resolveTemporal(
				{
					type: "comparison",
					field: "a",
					operator: "=",
					value: { type: "bogus" },
				} as never,
				{ now },
			),
		).toThrow("Unknown value type");
		expect(() =>
			resolveTemporal(
				{
					type: "comparison",
					field: "a",
					operator: ">",
					value: { type: "now", offset: { amount: 1, unit: "x" } },
				} as never,
				{ now },
			),
		).toThrow("Unknown duration unit");
	});

	test("resolved ASTs flow into both adapters", () => {
		const ast = resolveTemporal(parseOrThrow("created > @now-7d"), { now });

		const sql = toSQL(ast);
		expect(sql.sql).toBe("created > $1");
		expect(sql.params).toEqual(["2026-07-10T12:00:00.000Z"]);

		const filter = toFilter(ast);
		expect(filter({ created: "2026-07-12" })).toBe(true);
		expect(filter({ created: "2026-07-01" })).toBe(false);
	});
});
