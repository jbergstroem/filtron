import type {
	ASTNode,
	ComparisonExpression,
	BooleanFieldExpression,
	AndExpression,
	Value,
	ComparisonOperator,
} from "./types";

/**
 * Fast path parser for common query patterns
 */

// Pattern: field = value, field.nested > 123, etc.
// Matches: fieldname operator value (with optional whitespace)
const SIMPLE_COMPARISON_REGEX =
	/^([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)(\s*)(=|!=|>=|<=|>|<|~|:)(\s*)(.+)$/;

// Pattern: simple field name (for boolean field shorthand)
const SIMPLE_FIELD_REGEX =
	/^[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;

// Reserved keywords that cannot be used as bare field names
const KEYWORDS = new Set(["and", "or", "not", "exists", "true", "false"]);

/**
 * Parse a simple value (string, number, boolean, or identifier)
 * Returns null if value is complex and needs full parser
 */
function parseSimpleValue(valueStr: string): Value | null {
	const trimmed = valueStr.trim();

	// Empty value
	if (trimmed.length === 0) {
		return null;
	}

	// String literal: "value"
	if (trimmed[0] === '"' && trimmed[trimmed.length - 1] === '"') {
		const str = trimmed.slice(1, -1);

		// Check for escape sequences - if found, use full parser
		if (str.includes("\\")) {
			return null;
		}

		return { type: "string", value: str };
	}

	// Number: -123 or 45.67
	if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
		return { type: "number", value: Number(trimmed) };
	}

	// Boolean: true or false (case-insensitive)
	const lower = trimmed.toLowerCase();
	if (lower === "true" || lower === "false") {
		return { type: "boolean", value: lower === "true" };
	}

	// Identifier: fieldname or dotted.field.name
	// Must not start with digit, can contain letters, digits, underscore, dots
	if (/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(trimmed)) {
		return { type: "identifier", value: trimmed };
	}

	// Complex value - needs full parser
	return null;
}

/**
 * Fast path: Parse simple comparison expression
 * Handles: field = value, field > 123, nested.field != "test"
 *
 * Returns null if pattern doesn't match or value is too complex
 */
export function parseSimpleComparison(
	query: string,
): ComparisonExpression | null {
	const match = SIMPLE_COMPARISON_REGEX.exec(query);
	if (!match) {
		return null;
	}

	const [, field, , operator, , valueStr] = match;

	// Check if field is a keyword (case-insensitive)
	if (KEYWORDS.has(field.toLowerCase())) {
		return null; // Keywords cannot be used as field names
	}

	// Parse the value
	const value = parseSimpleValue(valueStr);
	if (!value) {
		return null; // Value too complex, use full parser
	}

	// Success!
	return {
		type: "comparison",
		field,
		operator: operator as ComparisonOperator,
		value,
	};
}

/**
 * Fast path: Parse simple boolean field expression
 * Handles: verified, user.premium, active
 *
 * Returns null if pattern doesn't match or is a keyword
 */
export function parseSimpleBooleanField(
	query: string,
): BooleanFieldExpression | null {
	const trimmed = query.trim();

	// Check if it's a keyword (case-insensitive)
	if (KEYWORDS.has(trimmed.toLowerCase())) {
		return null;
	}

	// Check if it matches simple field pattern
	if (!SIMPLE_FIELD_REGEX.test(trimmed)) {
		return null;
	}

	// Success!
	return {
		type: "booleanField",
		field: trimmed,
	};
}

/**
 * Fast path: Parse simple AND expression
 * Handles: expr1 AND expr2 (where both are simple comparisons or boolean fields)
 *
 * Returns null if pattern doesn't match or expressions are complex
 */
export function parseSimpleAnd(query: string): AndExpression | null {
	// Split on AND (case-insensitive, with word boundaries)
	// Only handle single AND (no chaining)
	const parts = query.split(/\s+AND\s+/i);

	if (parts.length !== 2) {
		return null; // Multiple ANDs or no AND
	}

	// Try to parse left side
	const leftTrimmed = parts[0].trim();
	const left =
		parseSimpleComparison(leftTrimmed) || parseSimpleBooleanField(leftTrimmed);

	if (!left) {
		return null; // Left side too complex
	}

	// Try to parse right side
	const rightTrimmed = parts[1].trim();
	const right =
		parseSimpleComparison(rightTrimmed) ||
		parseSimpleBooleanField(rightTrimmed);

	if (!right) {
		return null; // Right side too complex
	}

	// Success!
	return {
		type: "and",
		left,
		right,
	};
}

/**
 * Fast path: Try to parse query using optimized fast paths
 *
 * Attempts fast paths in order of frequency:
 * 1. Simple comparison (40% of queries)
 * 2. Simple AND (25% of queries)
 * 3. Boolean field (10% of queries)
 *
 * Returns null if no fast path matches (fallback to full parser)
 */
export function tryFastPath(query: string): ASTNode | null {
	const trimmed = query.trim();

	// Fast path 1: Simple comparison (most common)
	const comparison = parseSimpleComparison(trimmed);
	if (comparison) {
		return comparison;
	}

	// Fast path 2: Simple AND (second most common)
	const andExpr = parseSimpleAnd(trimmed);
	if (andExpr) {
		return andExpr;
	}

	// Fast path 3: Boolean field (less common but still worth checking)
	const boolField = parseSimpleBooleanField(trimmed);
	if (boolField) {
		return boolField;
	}

	// No fast path matched
	return null;
}
