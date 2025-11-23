import type {
	ASTNode,
	ComparisonExpression,
	BooleanFieldExpression,
	AndExpression,
	OrExpression,
	NotExpression,
	ExistsExpression,
	OneOfExpression,
	NotOneOfExpression,
	Value,
	ComparisonOperator,
} from "./types";

/**
 * Fast path parser for common query patterns
 */

// Pattern: field = value, field.nested > 123, etc.
// Matches: fieldname operator value (with optional whitespace)
// Note: Two-character operators (!=, >=, <=) come first to prevent regex backtracking
const SIMPLE_COMPARISON_REGEX =
	/^([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)(\s*)(!=|>=|<=|=|>|<|~|:)(\s*)(.+)$/;

// Pattern: simple field name (for boolean field shorthand)
const SIMPLE_FIELD_REGEX =
	/^[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;

// Pattern: field? (exists check with question mark)
const EXISTS_QUESTION_REGEX =
	/^([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\?$/;

// Pattern: field exists (exists check with keyword)
const EXISTS_KEYWORD_REGEX =
	/^([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s+exists$/i;

// Pattern: NOT expression (simple negation)
const NOT_REGEX = /^NOT\s+(.+)$/i;

// Pattern: field : [values] (oneOf)
const ONE_OF_REGEX =
	/^([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*:\s*\[([^\]]+)\]$/;

// Pattern: field !: [values] (notOneOf)
const NOT_ONE_OF_REGEX =
	/^([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*!:\s*\[([^\]]+)\]$/;

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

		// Check for unescaped quotes in the middle
		// Since we already rejected backslashes, any quote here is unescaped
		if (str.includes('"')) {
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
	if (SIMPLE_FIELD_REGEX.test(trimmed)) {
		return { type: "identifier", value: trimmed };
	}

	// Complex value - needs full parser
	return null;
}

/**
 * Parse an array of values from a comma-separated string
 * Example: '"active", "pending", 123' -> [string, string, number]
 * Returns null if parsing fails or contains complex values
 */
function parseValueArray(valuesStr: string): Value[] | null {
	const values: Value[] = [];
	let current = "";
	let inString = false;
	let i = 0;

	while (i < valuesStr.length) {
		const char = valuesStr[i];

		if (char === '"') {
			inString = !inString;
			current += char;
		} else if (char === "," && !inString) {
			// End of value
			const value = parseSimpleValue(current);
			if (!value) return null; // Complex value, fallback
			values.push(value);
			current = "";
		} else {
			current += char;
		}

		i++;
	}

	// Parse last value
	if (current.trim()) {
		const value = parseSimpleValue(current);
		if (!value) return null;
		values.push(value);
	}

	return values.length > 0 ? values : null;
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

	// Special case: if operator is ":" and value looks like array, reject
	// (this should be handled by oneOf fast-path)
	if (operator === ":" && valueStr.trim().startsWith("[")) {
		return null;
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
 * Fast path: Parse exists expression with ? operator
 * Handles: email?, user.profile.avatar?
 *
 * Returns null if pattern doesn't match
 */
export function parseExistsQuestion(query: string): ExistsExpression | null {
	const trimmed = query.trim();
	const match = EXISTS_QUESTION_REGEX.exec(trimmed);

	if (!match) {
		return null;
	}

	const field = match[1];

	// Check if field is a keyword
	if (KEYWORDS.has(field.toLowerCase())) {
		return null;
	}

	return {
		type: "exists",
		field,
	};
}

/**
 * Fast path: Parse exists expression with exists keyword
 * Handles: email exists, user.profile.avatar EXISTS
 *
 * Returns null if pattern doesn't match
 */
export function parseExistsKeyword(query: string): ExistsExpression | null {
	const trimmed = query.trim();
	const match = EXISTS_KEYWORD_REGEX.exec(trimmed);

	if (!match) {
		return null;
	}

	const field = match[1];

	// Check if field is a keyword
	if (KEYWORDS.has(field.toLowerCase())) {
		return null;
	}

	return {
		type: "exists",
		field,
	};
}

/**
 * Fast path: Parse oneOf expression
 * Handles: status : ["active", "pending"], role : [1, 2, 3]
 *
 * Returns null if pattern doesn't match or values are complex
 */
export function parseOneOf(query: string): OneOfExpression | null {
	const trimmed = query.trim();
	const match = ONE_OF_REGEX.exec(trimmed);

	if (!match) {
		return null;
	}

	const field = match[1];
	const valuesStr = match[2];

	// Check if field is a keyword
	if (KEYWORDS.has(field.toLowerCase())) {
		return null;
	}

	// Parse the values array
	const values = parseValueArray(valuesStr);
	if (!values || values.length === 0) {
		return null; // Complex values or empty array, fallback
	}

	return {
		type: "oneOf",
		field,
		values,
	};
}

/**
 * Fast path: Parse notOneOf expression
 * Handles: status !: ["banned", "deleted"], role !: [0]
 *
 * Returns null if pattern doesn't match or values are complex
 */
export function parseNotOneOf(query: string): NotOneOfExpression | null {
	const trimmed = query.trim();
	const match = NOT_ONE_OF_REGEX.exec(trimmed);

	if (!match) {
		return null;
	}

	const field = match[1];
	const valuesStr = match[2];

	// Check if field is a keyword
	if (KEYWORDS.has(field.toLowerCase())) {
		return null;
	}

	// Parse the values array
	const values = parseValueArray(valuesStr);
	if (!values || values.length === 0) {
		return null; // Complex values or empty array, fallback
	}

	return {
		type: "notOneOf",
		field,
		values,
	};
}

/**
 * Fast path: Parse NOT expression (single negation)
 * Handles: NOT verified, NOT (field = value), NOT status : ["active"]
 *
 * Returns null if expression is too complex
 */
export function parseSimpleNot(query: string): NotExpression | null {
	const trimmed = query.trim();
	const match = NOT_REGEX.exec(trimmed);

	if (!match) {
		return null;
	}

	const innerQuery = match[1].trim();

	// Try to parse the inner expression using fast-paths
	// Note: We avoid recursion with NOT (NOT x) by only trying simple patterns
	const inner =
		parseSimpleComparison(innerQuery) ||
		parseSimpleBooleanField(innerQuery) ||
		parseExistsQuestion(innerQuery) ||
		parseExistsKeyword(innerQuery) ||
		parseOneOf(innerQuery) ||
		parseNotOneOf(innerQuery);

	if (!inner) {
		return null; // Inner expression too complex, fallback
	}

	return {
		type: "not",
		expression: inner,
	};
}

/**
 * Fast path: Parse simple AND expression
 * Handles: expr1 AND expr2 (where both are simple expressions)
 * Also handles chains: expr1 AND expr2 AND expr3 (up to 5 terms for performance)
 *
 * Returns null if pattern doesn't match or expressions are complex
 */
export function parseSimpleAnd(query: string): AndExpression | null {
	// Reject queries with string literals to avoid incorrect splitting
	// (splitting on AND would break strings like 'name = "foo AND bar"')
	if (query.includes('"')) {
		return null; // Has string literals, use full parser
	}

	// Split on AND (case-insensitive, with word boundaries)
	const parts = query.split(/\s+AND\s+/i);

	if (parts.length < 2) {
		return null; // No AND operator found
	}

	if (parts.length > 5) {
		return null; // Too many ANDs, use full parser for better performance
	}

	// Try to parse each part
	const expressions: ASTNode[] = [];
	for (const part of parts) {
		const trimmed = part.trim();

		// Try all simple fast-path patterns (but not other AND/OR to avoid complexity)
		const expr =
			parseSimpleComparison(trimmed) ||
			parseSimpleBooleanField(trimmed) ||
			parseExistsQuestion(trimmed) ||
			parseExistsKeyword(trimmed) ||
			parseOneOf(trimmed) ||
			parseNotOneOf(trimmed) ||
			parseSimpleNot(trimmed);

		if (!expr) {
			return null; // One part is too complex, fallback
		}

		expressions.push(expr);
	}

	// Build left-associative AND tree
	// Example: a AND b AND c -> (a AND b) AND c
	let result = expressions[0];
	for (let i = 1; i < expressions.length; i++) {
		result = {
			type: "and",
			left: result,
			right: expressions[i],
		};
	}

	return result as AndExpression;
}

/**
 * Fast path: Parse simple OR expression
 * Handles: expr1 OR expr2 (where both are simple expressions)
 * Also handles chains: expr1 OR expr2 OR expr3 (up to 5 terms for performance)
 *
 * Returns null if pattern doesn't match or expressions are complex
 */
export function parseSimpleOr(query: string): OrExpression | null {
	// Reject queries with string literals to avoid incorrect splitting
	// (splitting on OR would break strings like 'status = "pending OR active"')
	if (query.includes('"')) {
		return null; // Has string literals, use full parser
	}

	// Must not contain AND at the same level (would need parentheses)
	// Quick heuristic: if both AND and OR are present without parens, reject
	if (/\bAND\b/i.test(query) && /\bOR\b/i.test(query)) {
		return null; // Mixed AND/OR requires parentheses, use full parser
	}

	// Split on OR (case-insensitive, with word boundaries)
	const parts = query.split(/\s+OR\s+/i);

	if (parts.length < 2) {
		return null; // No OR operator found
	}

	if (parts.length > 5) {
		return null; // Too many ORs, use full parser
	}

	// Try to parse each part
	const expressions: ASTNode[] = [];
	for (const part of parts) {
		const trimmed = part.trim();

		// Try all simple fast-path patterns (but not other AND/OR)
		const expr =
			parseSimpleComparison(trimmed) ||
			parseSimpleBooleanField(trimmed) ||
			parseExistsQuestion(trimmed) ||
			parseExistsKeyword(trimmed) ||
			parseOneOf(trimmed) ||
			parseNotOneOf(trimmed) ||
			parseSimpleNot(trimmed);

		if (!expr) {
			return null; // One part is too complex, fallback
		}

		expressions.push(expr);
	}

	// Build left-associative OR tree
	// Example: a OR b OR c -> (a OR b) OR c
	let result = expressions[0];
	for (let i = 1; i < expressions.length; i++) {
		result = {
			type: "or",
			left: result,
			right: expressions[i],
		};
	}

	return result as OrExpression;
}

/**
 * Fast path: Try to parse query using optimized fast paths
 *
 * Returns null if no fast path matches (fallback to full Ohm.js parser)
 *
 */
export function tryFastPath(query: string): ASTNode | null {
	const trimmed = query.trim();

	// Empty query
	if (trimmed.length === 0) {
		return null;
	}

	// Reject queries with parentheses immediately - these need full parser
	// This early check saves time trying all the patterns
	if (trimmed.includes("(") || trimmed.includes(")")) {
		return null;
	}

	// Fast path 1: Simple comparison (most common)
	// Examples: age > 18, status = "active", count >= 100
	const comparison = parseSimpleComparison(trimmed);
	if (comparison) {
		return comparison;
	}

	// Fast path 2: Simple AND (second most common)
	// Examples: verified AND age > 18, status = "active" AND NOT banned
	// Note: Must check before OR to avoid ambiguity
	if (/\bAND\b/i.test(trimmed) && !/\bOR\b/i.test(trimmed)) {
		const andExpr = parseSimpleAnd(trimmed);
		if (andExpr) {
			return andExpr;
		}
	}

	// Fast path 3: Simple OR
	// Examples: role = "admin" OR role = "moderator"
	// Note: Reject if both AND and OR are present (needs parentheses)
	if (/\bOR\b/i.test(trimmed) && !/\bAND\b/i.test(trimmed)) {
		const orExpr = parseSimpleOr(trimmed);
		if (orExpr) {
			return orExpr;
		}
	}

	// Fast path 4: oneOf expression
	// Examples: status : ["active", "pending"], role : [1, 2, 3]
	// Check before notOneOf since it's more common
	if (trimmed.includes(":[") || trimmed.includes(": [")) {
		const oneOf = parseOneOf(trimmed);
		if (oneOf) {
			return oneOf;
		}
	}

	// Fast path 5: notOneOf expression
	// Examples: status !: ["banned", "deleted"]
	if (trimmed.includes("!:[") || trimmed.includes("!: [")) {
		const notOneOf = parseNotOneOf(trimmed);
		if (notOneOf) {
			return notOneOf;
		}
	}

	// Fast path 6: Exists check with ?
	// Examples: email?, user.avatar?
	if (trimmed.includes("?")) {
		const exists = parseExistsQuestion(trimmed);
		if (exists) {
			return exists;
		}
	}

	// Fast path 7: Exists check with keyword
	// Examples: email exists, name EXISTS
	if (/\bexists\b/i.test(trimmed)) {
		const exists = parseExistsKeyword(trimmed);
		if (exists) {
			return exists;
		}
	}

	// Fast path 8: NOT expression
	// Examples: NOT verified, NOT status = "active"
	if (/^NOT\b/i.test(trimmed)) {
		const notExpr = parseSimpleNot(trimmed);
		if (notExpr) {
			return notExpr;
		}
	}

	// Fast path 9: Boolean field (less common, check near end)
	// Examples: verified, premium, user.active
	const boolField = parseSimpleBooleanField(trimmed);
	if (boolField) {
		return boolField;
	}

	// No fast path matched - fallback to full Ohm.js parser
	return null;
}
