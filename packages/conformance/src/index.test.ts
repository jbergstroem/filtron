import { describe, test, expect } from "bun:test";
import { parseOrThrow } from "@filtron/core";
import { toFilter } from "@filtron/js";
import { toSQL } from "@filtron/sql";
import { cases, dataset } from "./index.js";

const named = cases.map((c) => [c.name, c] as const);

describe("conformance", () => {
	test("case names are unique", () => {
		const names = new Set(cases.map((c) => c.name));
		expect(names.size).toBe(cases.length);
	});

	describe("@filtron/js", () => {
		test.each(named)("%s", (_name, c) => {
			const filter = toFilter(parseOrThrow(c.query));
			const ids = dataset.filter(filter).map((r) => r.id);
			expect(ids).toEqual(c.matches);
		});
	});

	describe("@filtron/sql", () => {
		test.each(named)("%s", (_name, c) => {
			const result = toSQL(parseOrThrow(c.query));
			expect(result.sql).toBe(c.sql);
			expect(result.params).toEqual(c.params);
		});
	});
});
