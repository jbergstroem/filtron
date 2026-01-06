import { parse } from "@filtron/core";
import { toFilter } from "@filtron/js";
import { ParticleGrid } from "./grid";
import { toHtml, toHtmlWithError } from "./highlight";

const SHAPES = ["circle", "triangle", "square"] as const;
const COLORS = ["red", "blue", "green", "orange", "purple"] as const;
const SIZES = [1, 2, 3, 4, 5] as const;

type QueryPart = {
	field: "shape" | "color" | "size";
	op: string;
	value: string | number | string[] | { range: [number, number] };
};

function randomItem<T>(arr: readonly T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function pickMultiple<T>(arr: readonly T[], count: number): T[] {
	const shuffled = [...arr].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, count);
}

function generateQueryPart(): QueryPart {
	const field = randomItem(["shape", "color", "size"] as const);

	if (field === "shape") {
		const useArray = Math.random() < 0.3;
		if (useArray) {
			const count = randomItem([2, 2, 3]);
			return { field, op: ":", value: pickMultiple(SHAPES, count) };
		}
		const op = randomItem(["=", "!="]);
		return { field, op, value: randomItem(SHAPES) };
	}

	if (field === "color") {
		const useArray = Math.random() < 0.3;
		if (useArray) {
			const count = randomItem([2, 2, 3]);
			return { field, op: ":", value: pickMultiple(COLORS, count) };
		}
		const op = randomItem(["=", "!="]);
		return { field, op, value: randomItem(COLORS) };
	}

	// size
	const opType = randomItem(["compare", "range"] as const);
	if (opType === "range") {
		const min = randomItem([1, 2]);
		const max = randomItem([4, 5]);
		return { field, op: "=", value: { range: [min, max] } };
	}
	const op = randomItem(["=", ">", ">=", "<", "<="]);
	return { field, op, value: randomItem(SIZES) };
}

function queryPartToString(part: QueryPart): string {
	if (typeof part.value === "object" && "range" in part.value) {
		return `${part.field} ${part.op} ${part.value.range[0]}..${part.value.range[1]}`;
	}
	if (Array.isArray(part.value)) {
		const items = part.value.map((v) => `"${v}"`).join(", ");
		return `${part.field} ${part.op} [${items}]`;
	}
	if (typeof part.value === "string") {
		return `${part.field} ${part.op} "${part.value}"`;
	}
	return `${part.field} ${part.op} ${part.value}`;
}

function generateRandomQuery(): string {
	const numParts = randomItem([1, 1, 2, 2, 2, 3]);
	const parts: QueryPart[] = [];
	const usedFields = new Set<string>();

	for (let i = 0; i < numParts; i++) {
		let part: QueryPart;
		let attempts = 0;
		do {
			part = generateQueryPart();
			attempts++;
		} while (usedFields.has(part.field) && attempts < 10);

		if (!usedFields.has(part.field)) {
			usedFields.add(part.field);
			parts.push(part);
		}
	}

	if (parts.length === 1) {
		return queryPartToString(parts[0]);
	}

	const connector = randomItem(["AND", "OR"]);
	return parts.map(queryPartToString).join(` ${connector} `);
}

function init(): void {
	const canvas = document.getElementById("grid-canvas") as HTMLCanvasElement;
	const filterInput = document.getElementById("filter-input") as HTMLTextAreaElement;
	const filterHighlighted = document.getElementById("filter-highlighted") as HTMLDivElement;
	const filterStats = document.getElementById("filter-stats") as HTMLDivElement;
	const errorTooltip = document.getElementById("error-tooltip") as HTMLDivElement;
	const randomizeBtn = document.getElementById("randomize-btn") as HTMLButtonElement;
	const filterWrapper = filterInput?.parentElement;

	if (
		!canvas ||
		!filterInput ||
		!filterHighlighted ||
		!filterStats ||
		!errorTooltip ||
		!filterWrapper ||
		!randomizeBtn
	) {
		console.error("Missing required elements");
		return;
	}

	// Highlight performance query examples
	for (const el of document.querySelectorAll<HTMLElement>(".perf-query[data-query]")) {
		const query = el.dataset.query ?? "";
		el.innerHTML = toHtml(query);
	}

	const grid = new ParticleGrid(canvas);

	function updateFilter(expression: string): void {
		// Clear tooltip and highlighted content
		errorTooltip.textContent = "";
		errorTooltip.hidden = true;
		filterHighlighted.innerHTML = "";

		if (!expression.trim()) {
			grid.applyFilter(null);
			filterStats.textContent = "";
			return;
		}

		const result = parse(expression);

		if (result.success) {
			filterHighlighted.innerHTML = toHtml(expression);
			try {
				const filter = toFilter(result.ast);
				grid.applyFilter(filter);

				const stats = grid.getStats();
				filterStats.textContent = `${stats.matched}/${stats.total}`;
			} catch (error) {
				grid.applyFilter(null);
				filterStats.textContent = (error as Error).message;
			}
		} else {
			if (result.position !== undefined) {
				filterHighlighted.innerHTML = toHtmlWithError(expression, result.position);
				errorTooltip.textContent = result.error;
				errorTooltip.hidden = false;
			}
			grid.applyFilter(null);
			filterStats.textContent = "";
		}
	}

	filterInput.addEventListener("input", () => {
		updateFilter(filterInput.value);
	});

	randomizeBtn.addEventListener("click", () => {
		const minMatchRatio = 0.1;
		const maxAttempts = 20;
		let attempts = 0;
		let query: string;
		let matchRatio: number;

		do {
			query = generateRandomQuery();
			const result = parse(query);
			if (result.success) {
				try {
					const filter = toFilter(result.ast);
					grid.applyFilter(filter);
					const stats = grid.getStats();
					matchRatio = stats.total > 0 ? stats.matched / stats.total : 0;
				} catch {
					matchRatio = 0;
				}
			} else {
				matchRatio = 0;
			}
			attempts++;
		} while (matchRatio < minMatchRatio && attempts < maxAttempts);

		filterInput.value = query;
		updateFilter(query);
		filterInput.focus();
	});

	// Initial update
	updateFilter(filterInput.value);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init();
}
