/**
 * AST transform that resolves now-relative temporal values
 */

import type { ASTNode, DateValue, NowValue, TemporalPoint, Value } from "@filtron/core";

/**
 * Options for resolveTemporal
 */
export interface ResolveTemporalOptions {
	/**
	 * The instant that `now` resolves against
	 * Pass a fixed date for deterministic output (tests, cache keys)
	 * @default new Date()
	 */
	now?: Date;
}

/**
 * Resolves every now-relative temporal value in an AST to an absolute
 * date, returning a new AST
 *
 * Nodes without relative values are returned by reference, so an AST
 * without any `@now` usage comes back unchanged and identity-equal.
 * Fixed-length units (s, m, h, d, w) offset by exact milliseconds;
 * months and years move the calendar in UTC and clamp to the last day
 * of the target month (Jan 31 minus one month is Feb 28 or 29).
 * Resolved dates are full ISO 8601 UTC instants.
 *
 * @param node - The AST to resolve
 * @param options - Resolution options
 * @returns An AST in which every temporal value is absolute
 * @throws Error if the reference time is invalid or a resolved range
 * ends up inverted
 *
 * @example
 * ```typescript
 * import { parseOrThrow } from "@filtron/core";
 * import { resolveTemporal } from "@filtron/time-resolver";
 *
 * const ast = resolveTemporal(parseOrThrow("created > @now-7d"), {
 *   now: new Date("2026-07-17T12:00:00Z"),
 * });
 * // comparison value: { type: "date", value: "2026-07-10T12:00:00.000Z" }
 * ```
 */
export function resolveTemporal(node: ASTNode, options: ResolveTemporalOptions = {}): ASTNode {
	const reference = options.now ?? new Date();
	if (Number.isNaN(reference.getTime())) {
		throw new Error("Invalid reference time");
	}
	return resolveNode(node, reference);
}

/**
 * Recursively resolves a node, sharing untouched subtrees
 */
function resolveNode(node: ASTNode, reference: Date): ASTNode {
	switch (node.type) {
		case "or":
		case "and": {
			const children = node.children.map((child) => resolveNode(child, reference));
			if (children.every((child, i) => child === node.children[i])) {
				return node;
			}
			return { type: node.type, children };
		}
		case "not": {
			const expression = resolveNode(node.expression, reference);
			if (expression === node.expression) {
				return node;
			}
			return { type: "not", expression };
		}
		case "comparison": {
			const value = resolveValue(node.value, reference);
			if (value === node.value) {
				return node;
			}
			return { type: "comparison", field: node.field, operator: node.operator, value };
		}
		case "oneOf": {
			const values = node.values.map((value) => resolveValue(value, reference));
			if (values.every((value, i) => value === node.values[i])) {
				return node;
			}
			return { type: "oneOf", field: node.field, values, negated: node.negated };
		}
		case "exists":
		case "booleanField":
			return node;
		default: {
			// TypeScript exhaustiveness check
			const _exhaustive: never = node;
			throw new Error(`Unknown node type: ${(node as ASTNode).type}`);
		}
	}
}

/**
 * Resolves a value, sharing values that carry nothing relative
 */
function resolveValue(value: Value, reference: Date): Value {
	switch (value.type) {
		case "now":
			return resolvePoint(value, reference);
		case "range": {
			if (value.kind !== "temporal") {
				return value;
			}
			if (value.min.type === "date" && value.max.type === "date") {
				return value;
			}
			const min = resolvePoint(value.min, reference);
			const max = resolvePoint(value.max, reference);
			if (Date.parse(min.value) > Date.parse(max.value)) {
				throw new Error(`Resolved range min (${min.value}) must not exceed max (${max.value})`);
			}
			return { type: "range", kind: "temporal", min, max };
		}
		case "string":
		case "number":
		case "boolean":
		case "identifier":
		case "date":
			return value;
		default: {
			// TypeScript exhaustiveness check
			const _exhaustive: never = value;
			throw new Error(`Unknown value type: ${(value as Value).type}`);
		}
	}
}

/**
 * Resolves a temporal point to an absolute date value
 */
function resolvePoint(point: TemporalPoint, reference: Date): DateValue {
	if (point.type === "date") {
		return point;
	}
	return { type: "date", value: offsetFrom(reference, point.offset).toISOString() };
}

/**
 * Applies a now offset to the reference instant
 */
function offsetFrom(reference: Date, offset: NowValue["offset"]): Date {
	if (offset === null) {
		return reference;
	}

	const { amount, unit } = offset;
	switch (unit) {
		case "s":
			return new Date(reference.getTime() + amount * 1000);
		case "m":
			return new Date(reference.getTime() + amount * 60_000);
		case "h":
			return new Date(reference.getTime() + amount * 3_600_000);
		case "d":
			return new Date(reference.getTime() + amount * 86_400_000);
		case "w":
			return new Date(reference.getTime() + amount * 604_800_000);
		case "M":
			return addUTCMonths(reference, amount);
		case "y":
			return addUTCMonths(reference, amount * 12);
		default: {
			// TypeScript exhaustiveness check
			const _exhaustive: never = unit;
			throw new Error(`Unknown duration unit: ${unit as string}`);
		}
	}
}

/**
 * Moves the calendar by whole months in UTC, clamping to the last day
 * of the target month
 */
function addUTCMonths(reference: Date, months: number): Date {
	const result = new Date(reference.getTime());
	const day = result.getUTCDate();
	result.setUTCDate(1);
	result.setUTCMonth(result.getUTCMonth() + months);
	const lastDay = new Date(
		Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
	).getUTCDate();
	result.setUTCDate(Math.min(day, lastDay));
	return result;
}
