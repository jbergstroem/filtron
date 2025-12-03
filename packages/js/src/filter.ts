/**
 * In-memory JavaScript filter for Filtron AST
 * Converts Filtron AST nodes to predicate functions for filtering arrays
 */

import type {
	ASTNode,
	Value,
	ComparisonOperator,
	OrExpression,
	AndExpression,
	NotExpression,
	ComparisonExpression,
	OneOfExpression,
	NotOneOfExpression,
	ExistsExpression,
	BooleanFieldExpression,
	RangeExpression,
} from "@filtron/core";

/**
 * Predicate function type that filters objects
 */
export type FilterPredicate<T = Record<string, unknown>> = (item: T) => boolean;

/**
 * Filter generation options
 */
export interface FilterOptions {
	/**
	 * Allowed field names for filtering
	 * If provided, only these fields can be used in queries
	 * Throws an error if a query references a field not in this list
	 * @default undefined (all fields allowed)
	 */
	allowedFields?: string[];

	/**
	 * Custom field accessor function
	 * Useful for accessing nested properties or transforming field names
	 * @default (obj, field) => obj[field]
	 *
	 * @example
	 * ```typescript
	 * // Access nested properties using dot notation
	 * toFilter(ast, {
	 *   fieldAccessor: (obj, field) => {
	 *     return field.split('.').reduce((o, k) => o?.[k], obj);
	 *   }
	 * })
	 * ```
	 */
	fieldAccessor?: (obj: Record<string, unknown>, field: string) => unknown;

	/**
	 * Case-insensitive string comparisons
	 * Applies to equals (=, :) and contains (~) operators
	 * @default false
	 */
	caseInsensitive?: boolean;
}

/**
 * Internal state for filter generation
 */
interface GeneratorState {
	allowedFields?: Set<string>;
	fieldAccessor: (obj: Record<string, unknown>, field: string) => unknown;
	caseInsensitive: boolean;
}

/**
 * Converts a Filtron AST to a predicate function for filtering arrays
 *
 * @param ast - The Filtron AST node to convert
 * @param options - Filter generation options
 * @returns A predicate function that can be used with Array.filter()
 *
 * @example
 * ```typescript
 * import { parse } from '@filtron/core';
 * import { toFilter } from '@filtron/js';
 *
 * const result = parse('age > 18 AND status = "active"');
 * if (result.success) {
 *   const filter = toFilter(result.ast);
 *
 *   const users = [
 *     { name: 'Alice', age: 25, status: 'active' },
 *     { name: 'Bob', age: 16, status: 'active' },
 *     { name: 'Charlie', age: 30, status: 'inactive' },
 *   ];
 *
 *   const filtered = users.filter(filter);
 *   // [{ name: 'Alice', age: 25, status: 'active' }]
 * }
 * ```
 */
export function toFilter<T extends Record<string, unknown> = Record<string, unknown>>(
	ast: ASTNode,
	options: FilterOptions = {},
): FilterPredicate<T> {
	const state: GeneratorState = {
		allowedFields: options.allowedFields ? new Set(options.allowedFields) : undefined,
		fieldAccessor: options.fieldAccessor ?? ((obj, field) => obj[field]),
		caseInsensitive: options.caseInsensitive ?? false,
	};

	return generateFilter(ast, state) as FilterPredicate<T>;
}

/**
 * Validates that a field is allowed (if allowedFields is set)
 */
function validateField(field: string, state: GeneratorState): void {
	if (state.allowedFields && !state.allowedFields.has(field)) {
		throw new Error(
			`Field "${field}" is not allowed. Allowed fields: ${[...state.allowedFields].join(", ")}`,
		);
	}
}

/**
 * Recursively generates filter predicates from AST nodes
 */
function generateFilter(
	node: ASTNode,
	state: GeneratorState,
): FilterPredicate<Record<string, unknown>> {
	switch (node.type) {
		case "or":
			return generateOr(node, state);
		case "and":
			return generateAnd(node, state);
		case "not":
			return generateNot(node, state);
		case "comparison":
			return generateComparison(node, state);
		case "oneOf":
			return generateOneOf(node, state);
		case "notOneOf":
			return generateNotOneOf(node, state);
		case "exists":
			return generateExists(node, state);
		case "booleanField":
			return generateBooleanField(node, state);
		case "range":
			return generateRange(node, state);
		default:
			// TypeScript exhaustiveness check
			const _exhaustive: never = node;
			throw new Error(`Unknown node type: ${(node as ASTNode).type}`);
	}
}

/**
 * Generates predicate for OR expression
 */
function generateOr(
	node: OrExpression,
	state: GeneratorState,
): FilterPredicate<Record<string, unknown>> {
	const left = generateFilter(node.left, state);
	const right = generateFilter(node.right, state);
	return (item) => left(item) || right(item);
}

/**
 * Generates predicate for AND expression
 */
function generateAnd(
	node: AndExpression,
	state: GeneratorState,
): FilterPredicate<Record<string, unknown>> {
	const left = generateFilter(node.left, state);
	const right = generateFilter(node.right, state);
	return (item) => left(item) && right(item);
}

/**
 * Generates predicate for NOT expression
 */
function generateNot(
	node: NotExpression,
	state: GeneratorState,
): FilterPredicate<Record<string, unknown>> {
	const expr = generateFilter(node.expression, state);
	return (item) => !expr(item);
}

/**
 * Generates predicate for comparison expression
 */
function generateComparison(
	node: ComparisonExpression,
	state: GeneratorState,
): FilterPredicate<Record<string, unknown>> {
	validateField(node.field, state);
	const value = extractValue(node.value);
	const compareFn = getComparisonFunction(node.operator, value, state);

	return (item) => {
		const fieldValue = state.fieldAccessor(item, node.field);
		return compareFn(fieldValue, value);
	};
}

/**
 * Generates predicate for one-of expression
 */
function generateOneOf(
	node: OneOfExpression,
	state: GeneratorState,
): FilterPredicate<Record<string, unknown>> {
	validateField(node.field, state);
	const values = node.values.map((v: Value) => extractValue(v));

	if (values.length === 0) {
		// Empty IN clause - always false
		return () => false;
	}

	if (state.caseInsensitive) {
		const lowerValues = values.map((v: string | number | boolean) =>
			typeof v === "string" ? v.toLowerCase() : v,
		);
		return (item) => {
			const fieldValue = state.fieldAccessor(item, node.field);
			const compareValue = typeof fieldValue === "string" ? fieldValue.toLowerCase() : fieldValue;
			return lowerValues.some((v: string | number | boolean) => v === compareValue);
		};
	}

	// Use Set for O(1) lookup on larger lists
	const valueSet = new Set(values);
	return (item) => {
		const fieldValue = state.fieldAccessor(item, node.field);
		return valueSet.has(fieldValue as string | number | boolean);
	};
}

/**
 * Generates predicate for not-one-of expression
 */
function generateNotOneOf(
	node: NotOneOfExpression,
	state: GeneratorState,
): FilterPredicate<Record<string, unknown>> {
	validateField(node.field, state);
	const values = node.values.map((v: Value) => extractValue(v));

	if (values.length === 0) {
		// Empty NOT IN clause - always true
		return () => true;
	}

	if (state.caseInsensitive) {
		const lowerValues = values.map((v: string | number | boolean) =>
			typeof v === "string" ? v.toLowerCase() : v,
		);
		return (item) => {
			const fieldValue = state.fieldAccessor(item, node.field);
			const compareValue = typeof fieldValue === "string" ? fieldValue.toLowerCase() : fieldValue;
			return !lowerValues.some((v: string | number | boolean) => v === compareValue);
		};
	}

	// Use Set for O(1) lookup on larger lists
	const valueSet = new Set(values);
	return (item) => {
		const fieldValue = state.fieldAccessor(item, node.field);
		return !valueSet.has(fieldValue as string | number | boolean);
	};
}

/**
 * Generates predicate for exists expression
 */
function generateExists(
	node: ExistsExpression,
	state: GeneratorState,
): FilterPredicate<Record<string, unknown>> {
	validateField(node.field, state);
	return (item) => {
		const fieldValue = state.fieldAccessor(item, node.field);
		return fieldValue !== null && fieldValue !== undefined;
	};
}

/**
 * Generates predicate for boolean field expression
 */
function generateBooleanField(
	node: BooleanFieldExpression,
	state: GeneratorState,
): FilterPredicate<Record<string, unknown>> {
	validateField(node.field, state);
	return (item) => {
		const fieldValue = state.fieldAccessor(item, node.field);
		return fieldValue === true;
	};
}

/**
 * Generates predicate for range expression (BETWEEN)
 */
function generateRange(
	node: RangeExpression,
	state: GeneratorState,
): FilterPredicate<Record<string, unknown>> {
	validateField(node.field, state);
	return (item) => {
		const fieldValue = state.fieldAccessor(item, node.field);
		if (typeof fieldValue !== "number") {
			return false;
		}
		return fieldValue >= node.min && fieldValue <= node.max;
	};
}

/**
 * Returns a comparison function for the given operator
 */
function getComparisonFunction(
	operator: ComparisonOperator,
	_targetValue: string | number | boolean,
	state: GeneratorState,
): (fieldValue: unknown, targetValue: string | number | boolean) => boolean {
	switch (operator) {
		case "=":
		case ":":
			if (state.caseInsensitive) {
				return (fieldValue, targetValue) => {
					if (typeof fieldValue === "string" && typeof targetValue === "string") {
						return fieldValue.toLowerCase() === targetValue.toLowerCase();
					}
					return fieldValue === targetValue;
				};
			}
			return (fieldValue, targetValue) => fieldValue === targetValue;

		case "!=":
			if (state.caseInsensitive) {
				return (fieldValue, targetValue) => {
					if (typeof fieldValue === "string" && typeof targetValue === "string") {
						return fieldValue.toLowerCase() !== targetValue.toLowerCase();
					}
					return fieldValue !== targetValue;
				};
			}
			return (fieldValue, targetValue) => fieldValue !== targetValue;

		case "~":
			// Contains/LIKE - uses substring matching
			if (state.caseInsensitive) {
				return (fieldValue, targetValue) => {
					if (typeof fieldValue !== "string" || typeof targetValue !== "string") {
						return false;
					}
					return fieldValue.toLowerCase().includes(targetValue.toLowerCase());
				};
			}
			return (fieldValue, targetValue) => {
				if (typeof fieldValue !== "string" || typeof targetValue !== "string") {
					return false;
				}
				return fieldValue.includes(targetValue);
			};

		case ">":
			return (fieldValue, targetValue) => {
				if (typeof fieldValue !== "number" || typeof targetValue !== "number") {
					return false;
				}
				return fieldValue > targetValue;
			};

		case ">=":
			return (fieldValue, targetValue) => {
				if (typeof fieldValue !== "number" || typeof targetValue !== "number") {
					return false;
				}
				return fieldValue >= targetValue;
			};

		case "<":
			return (fieldValue, targetValue) => {
				if (typeof fieldValue !== "number" || typeof targetValue !== "number") {
					return false;
				}
				return fieldValue < targetValue;
			};

		case "<=":
			return (fieldValue, targetValue) => {
				if (typeof fieldValue !== "number" || typeof targetValue !== "number") {
					return false;
				}
				return fieldValue <= targetValue;
			};

		default:
			const _exhaustive: never = operator;
			throw new Error(`Unknown operator: ${operator as string}`);
	}
}

/**
 * Extracts the primitive value from a Filtron Value node
 */
function extractValue(value: Value): string | number | boolean {
	switch (value.type) {
		case "string":
			return value.value;
		case "number":
			return value.value;
		case "boolean":
			return value.value;
		case "identifier":
			// Identifiers are treated as strings
			return value.value;
		default:
			const _exhaustive: never = value;
			throw new Error(`Unknown value type: ${(value as Value).type}`);
	}
}

/**
 * Creates a field accessor for nested properties using dot notation
 *
 * @param separator - The separator used in field names (default: ".")
 * @returns A field accessor function
 *
 * @example
 * ```typescript
 * const filter = toFilter(ast, {
 *   fieldAccessor: nestedAccessor()
 * });
 *
 * // Now you can query nested fields like "user.address.city"
 * const items = data.filter(filter);
 * ```
 */
export function nestedAccessor(
	separator: string = ".",
): (obj: Record<string, unknown>, field: string) => unknown {
	return (obj: Record<string, unknown>, field: string): unknown => {
		const parts = field.split(separator);
		let current: unknown = obj;

		for (const part of parts) {
			if (current === null || current === undefined) {
				return undefined;
			}
			if (typeof current !== "object") {
				return undefined;
			}
			current = (current as Record<string, unknown>)[part];
		}

		return current;
	};
}
