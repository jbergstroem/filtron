/**
 * In-memory JavaScript filter for Filtron AST
 * Converts Filtron AST nodes to predicate functions for filtering arrays
 */

import { validateFields } from "@filtron/core";
import type {
	ASTNode,
	Value,
	OrExpression,
	AndExpression,
	NotExpression,
	ComparisonExpression,
	OneOfExpression,
	ExistsExpression,
	BooleanFieldExpression,
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
	 * The whole AST is validated up front; throws an error if any field
	 * is not in this list
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

	/**
	 * Maps query field names to object property names
	 * Useful for exposing different field names in queries than in your data model
	 * @default undefined (no mapping)
	 *
	 * @example
	 * ```typescript
	 * // Allow queries to use 'email' but map to 'emailAddress' in objects
	 * toFilter(ast, {
	 *   fieldMapping: {
	 *     'email': 'emailAddress',
	 *     'name': 'fullName'
	 *   }
	 * })
	 * ```
	 */
	fieldMapping?: Record<string, string>;
}

/**
 * Internal state for filter generation
 * fieldAccessor is undefined when the default (direct property access) applies,
 * which lets generators emit specialized predicates without the indirect call
 */
interface GeneratorState {
	fieldAccessor?: (obj: Record<string, unknown>, field: string) => unknown;
	caseInsensitive: boolean;
	fieldMapping?: Record<string, string>;
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
	if (options.allowedFields) {
		validateFields(ast, options.allowedFields);
	}

	const state: GeneratorState = {
		fieldAccessor: options.fieldAccessor,
		caseInsensitive: options.caseInsensitive ?? false,
		fieldMapping: options.fieldMapping,
	};

	return generateFilter(ast, state) as FilterPredicate<T>;
}

/**
 * Resolves a field through fieldMapping if provided
 */
function resolveField(field: string, state: GeneratorState): string {
	return state.fieldMapping ? (state.fieldMapping[field] ?? field) : field;
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
		case "exists":
			return generateExists(node, state);
		case "booleanField":
			return generateBooleanField(node, state);
		default: {
			// TypeScript exhaustiveness check
			const _exhaustive: never = node;
			throw new Error(`Unknown node type: ${(node as ASTNode).type}`);
		}
	}
}

/**
 * Generates predicate for OR expression
 * The parser guarantees flat chains of two or more children; common
 * arities compile to direct short-circuit chains
 */
function generateOr(
	node: OrExpression,
	state: GeneratorState,
): FilterPredicate<Record<string, unknown>> {
	const children = node.children;
	const len = children.length;

	if (len === 2) {
		const a = generateFilter(children[0], state);
		const b = generateFilter(children[1], state);
		return (item) => a(item) || b(item);
	}
	if (len === 3) {
		const a = generateFilter(children[0], state);
		const b = generateFilter(children[1], state);
		const c = generateFilter(children[2], state);
		return (item) => a(item) || b(item) || c(item);
	}
	if (len === 4) {
		const a = generateFilter(children[0], state);
		const b = generateFilter(children[1], state);
		const c = generateFilter(children[2], state);
		const d = generateFilter(children[3], state);
		return (item) => a(item) || b(item) || c(item) || d(item);
	}

	const predicates = children.map((child) => generateFilter(child, state));
	return (item) => {
		for (let i = 0; i < len; i++) {
			if (predicates[i](item)) return true;
		}
		return false;
	};
}

/**
 * Generates predicate for AND expression
 * The parser guarantees flat chains of two or more children; common
 * arities compile to direct short-circuit chains
 */
function generateAnd(
	node: AndExpression,
	state: GeneratorState,
): FilterPredicate<Record<string, unknown>> {
	const children = node.children;
	const len = children.length;

	if (len === 2) {
		const a = generateFilter(children[0], state);
		const b = generateFilter(children[1], state);
		return (item) => a(item) && b(item);
	}
	if (len === 3) {
		const a = generateFilter(children[0], state);
		const b = generateFilter(children[1], state);
		const c = generateFilter(children[2], state);
		return (item) => a(item) && b(item) && c(item);
	}
	if (len === 4) {
		const a = generateFilter(children[0], state);
		const b = generateFilter(children[1], state);
		const c = generateFilter(children[2], state);
		const d = generateFilter(children[3], state);
		return (item) => a(item) && b(item) && c(item) && d(item);
	}

	const predicates = children.map((child) => generateFilter(child, state));
	return (item) => {
		for (let i = 0; i < len; i++) {
			if (!predicates[i](item)) return false;
		}
		return true;
	};
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
 * Pre-computes case-insensitive values during compilation and emits
 * direct property access predicates when no custom accessor is set
 */
function generateComparison(
	node: ComparisonExpression,
	state: GeneratorState,
): FilterPredicate<Record<string, unknown>> {
	const field = resolveField(node.field, state);

	if (node.value.type === "range") {
		const { min, max } = node.value;
		if (node.operator === "=" || node.operator === ":") {
			return generateRangeComparison(field, "=", min, max, state);
		}
		if (node.operator === "!=") {
			return generateRangeComparison(field, "!=", min, max, state);
		}
		throw new Error(`Range values require the =, : or != operator, got ${node.operator}`);
	}

	const targetValue = extractValue(node.value);
	const accessor = state.fieldAccessor;

	// Pre-compute case-insensitive values at compile time
	const isTargetString = typeof targetValue === "string";
	const lowerTarget = isTargetString && state.caseInsensitive ? targetValue.toLowerCase() : null;

	// Inline simple comparisons to avoid function call overhead
	switch (node.operator) {
		case "=":
		case ":":
			if (lowerTarget !== null) {
				if (accessor) {
					return (item) => {
						const fieldValue = accessor(item, field);
						return typeof fieldValue === "string"
							? fieldValue.toLowerCase() === lowerTarget
							: fieldValue === targetValue;
					};
				}
				return (item) => {
					const fieldValue = item[field];
					return typeof fieldValue === "string"
						? fieldValue.toLowerCase() === lowerTarget
						: fieldValue === targetValue;
				};
			}
			if (accessor) {
				return (item) => accessor(item, field) === targetValue;
			}
			return (item) => item[field] === targetValue;

		case "!=":
			if (lowerTarget !== null) {
				if (accessor) {
					return (item) => {
						const fieldValue = accessor(item, field);
						return typeof fieldValue === "string"
							? fieldValue.toLowerCase() !== lowerTarget
							: fieldValue !== targetValue;
					};
				}
				return (item) => {
					const fieldValue = item[field];
					return typeof fieldValue === "string"
						? fieldValue.toLowerCase() !== lowerTarget
						: fieldValue !== targetValue;
				};
			}
			if (accessor) {
				return (item) => accessor(item, field) !== targetValue;
			}
			return (item) => item[field] !== targetValue;

		case "~":
			if (!isTargetString) {
				return () => false;
			}
			if (lowerTarget !== null) {
				if (accessor) {
					return (item) => {
						const fieldValue = accessor(item, field);
						return typeof fieldValue === "string" && fieldValue.toLowerCase().includes(lowerTarget);
					};
				}
				return (item) => {
					const fieldValue = item[field];
					return typeof fieldValue === "string" && fieldValue.toLowerCase().includes(lowerTarget);
				};
			}
			if (accessor) {
				return (item) => {
					const fieldValue = accessor(item, field);
					return typeof fieldValue === "string" && fieldValue.includes(targetValue);
				};
			}
			return (item) => {
				const fieldValue = item[field];
				return typeof fieldValue === "string" && fieldValue.includes(targetValue);
			};

		case ">":
			if (typeof targetValue !== "number") return () => false;
			if (accessor) {
				return (item) => {
					const fieldValue = accessor(item, field);
					return typeof fieldValue === "number" && fieldValue > targetValue;
				};
			}
			return (item) => {
				const fieldValue = item[field];
				return typeof fieldValue === "number" && fieldValue > targetValue;
			};

		case ">=":
			if (typeof targetValue !== "number") return () => false;
			if (accessor) {
				return (item) => {
					const fieldValue = accessor(item, field);
					return typeof fieldValue === "number" && fieldValue >= targetValue;
				};
			}
			return (item) => {
				const fieldValue = item[field];
				return typeof fieldValue === "number" && fieldValue >= targetValue;
			};

		case "<":
			if (typeof targetValue !== "number") return () => false;
			if (accessor) {
				return (item) => {
					const fieldValue = accessor(item, field);
					return typeof fieldValue === "number" && fieldValue < targetValue;
				};
			}
			return (item) => {
				const fieldValue = item[field];
				return typeof fieldValue === "number" && fieldValue < targetValue;
			};

		case "<=":
			if (typeof targetValue !== "number") return () => false;
			if (accessor) {
				return (item) => {
					const fieldValue = accessor(item, field);
					return typeof fieldValue === "number" && fieldValue <= targetValue;
				};
			}
			return (item) => {
				const fieldValue = item[field];
				return typeof fieldValue === "number" && fieldValue <= targetValue;
			};

		default: {
			const _exhaustive: never = node.operator;
			throw new Error(`Unknown operator: ${_exhaustive as string}`);
		}
	}
}

/**
 * Builds a membership predicate over extracted values
 * Specializes small lists into direct comparisons and uses a Set above the
 * threshold where hashing wins (~10 items, based on Codspeed benchmarks)
 */
function generateMembership(
	field: string,
	rawValues: Value[],
	state: GeneratorState,
	emptyResult: boolean,
	negate: boolean,
): FilterPredicate<Record<string, unknown>> {
	const values = rawValues.map((v: Value) => extractValue(v));
	const accessor = state.fieldAccessor;

	if (values.length === 0) {
		return () => emptyResult;
	}

	// Pre-compute case-insensitive values at compile time
	if (state.caseInsensitive) {
		const lowerValues = values.map((v: string | number | boolean) =>
			typeof v === "string" ? v.toLowerCase() : v,
		);
		if (lowerValues.length > 10) {
			const valueSet = new Set(lowerValues);
			if (negate) {
				return (item) => {
					const fieldValue = accessor ? accessor(item, field) : item[field];
					const compareValue =
						typeof fieldValue === "string" ? fieldValue.toLowerCase() : fieldValue;
					return !valueSet.has(compareValue as string | number | boolean);
				};
			}
			return (item) => {
				const fieldValue = accessor ? accessor(item, field) : item[field];
				const compareValue = typeof fieldValue === "string" ? fieldValue.toLowerCase() : fieldValue;
				return valueSet.has(compareValue as string | number | boolean);
			};
		}
		if (negate) {
			return (item) => {
				const fieldValue = accessor ? accessor(item, field) : item[field];
				const compareValue = typeof fieldValue === "string" ? fieldValue.toLowerCase() : fieldValue;
				return !lowerValues.includes(compareValue as string | number | boolean);
			};
		}
		return (item) => {
			const fieldValue = accessor ? accessor(item, field) : item[field];
			const compareValue = typeof fieldValue === "string" ? fieldValue.toLowerCase() : fieldValue;
			return lowerValues.includes(compareValue as string | number | boolean);
		};
	}

	// Small lists compile to direct comparisons, avoiding Array.includes overhead
	if (values.length <= 3 && !accessor) {
		const v0 = values[0];
		if (values.length === 1) {
			if (negate) return (item) => item[field] !== v0;
			return (item) => item[field] === v0;
		}
		const v1 = values[1];
		if (values.length === 2) {
			if (negate) {
				return (item) => {
					const fieldValue = item[field];
					return fieldValue !== v0 && fieldValue !== v1;
				};
			}
			return (item) => {
				const fieldValue = item[field];
				return fieldValue === v0 || fieldValue === v1;
			};
		}
		const v2 = values[2];
		if (negate) {
			return (item) => {
				const fieldValue = item[field];
				return fieldValue !== v0 && fieldValue !== v1 && fieldValue !== v2;
			};
		}
		return (item) => {
			const fieldValue = item[field];
			return fieldValue === v0 || fieldValue === v1 || fieldValue === v2;
		};
	}

	// For small arrays (<=10 items), Array.includes is faster than Set lookup
	if (values.length <= 10) {
		if (accessor) {
			if (negate) {
				return (item) => !values.includes(accessor(item, field) as string | number | boolean);
			}
			return (item) => values.includes(accessor(item, field) as string | number | boolean);
		}
		if (negate) {
			return (item) => !values.includes(item[field] as string | number | boolean);
		}
		return (item) => values.includes(item[field] as string | number | boolean);
	}

	// Use Set for O(1) lookup on larger lists
	const valueSet = new Set(values);
	if (accessor) {
		if (negate) {
			return (item) => !valueSet.has(accessor(item, field) as string | number | boolean);
		}
		return (item) => valueSet.has(accessor(item, field) as string | number | boolean);
	}
	if (negate) {
		return (item) => !valueSet.has(item[field] as string | number | boolean);
	}
	return (item) => valueSet.has(item[field] as string | number | boolean);
}

/**
 * Generates predicate for membership expression (negated or not)
 * An empty list matches nothing, so its negation matches everything
 */
function generateOneOf(
	node: OneOfExpression,
	state: GeneratorState,
): FilterPredicate<Record<string, unknown>> {
	const field = resolveField(node.field, state);
	return generateMembership(field, node.values, state, node.negated, node.negated);
}

/**
 * Generates predicate for exists expression (negated or not)
 */
function generateExists(
	node: ExistsExpression,
	state: GeneratorState,
): FilterPredicate<Record<string, unknown>> {
	const field = resolveField(node.field, state);
	const accessor = state.fieldAccessor;
	if (node.negated) {
		if (accessor) {
			return (item) => {
				const fieldValue = accessor(item, field);
				return fieldValue === null || fieldValue === undefined;
			};
		}
		return (item) => {
			const fieldValue = item[field];
			return fieldValue === null || fieldValue === undefined;
		};
	}
	if (accessor) {
		return (item) => {
			const fieldValue = accessor(item, field);
			return fieldValue !== null && fieldValue !== undefined;
		};
	}
	return (item) => {
		const fieldValue = item[field];
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
	const field = resolveField(node.field, state);
	const accessor = state.fieldAccessor;
	if (accessor) {
		return (item) => accessor(item, field) === true;
	}
	return (item) => item[field] === true;
}

/**
 * Generates predicate for a comparison against a range value
 * = and : match numbers inside the inclusive interval; != matches
 * everything else, including non-numbers
 */
function generateRangeComparison(
	field: string,
	operator: "=" | ":" | "!=",
	min: number,
	max: number,
	state: GeneratorState,
): FilterPredicate<Record<string, unknown>> {
	const accessor = state.fieldAccessor;
	if (operator === "!=") {
		if (accessor) {
			return (item) => {
				const fieldValue = accessor(item, field);
				return typeof fieldValue !== "number" || fieldValue < min || fieldValue > max;
			};
		}
		return (item) => {
			const fieldValue = item[field];
			return typeof fieldValue !== "number" || fieldValue < min || fieldValue > max;
		};
	}
	if (accessor) {
		return (item) => {
			const fieldValue = accessor(item, field);
			return typeof fieldValue === "number" && fieldValue >= min && fieldValue <= max;
		};
	}
	return (item) => {
		const fieldValue = item[field];
		return typeof fieldValue === "number" && fieldValue >= min && fieldValue <= max;
	};
}

/**
 * Extracts the primitive value from a Filtron Value node
 */
function extractValue(value: Value): string | number | boolean {
	switch (value.type) {
		case "range":
			// The parser only produces ranges where callers handle them first
			throw new Error("Range values cannot be used here");
		case "string":
			return value.value;
		case "number":
			return value.value;
		case "boolean":
			return value.value;
		case "identifier":
			// Identifiers are treated as strings
			return value.value;
		default: {
			const _exhaustive: never = value;
			throw new Error(`Unknown value type: ${(value as Value).type}`);
		}
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
	// Memoize field splits to avoid repeated string splitting
	const fieldPartsCache = new Map<string, string[]>();

	return (obj: Record<string, unknown>, field: string): unknown => {
		let parts = fieldPartsCache.get(field);
		if (!parts) {
			parts = field.split(separator);
			fieldPartsCache.set(field, parts);
		}

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
