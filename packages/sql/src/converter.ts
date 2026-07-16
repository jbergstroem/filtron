/**
 * SQL converter for Filtron AST
 * Converts Filtron AST nodes to parameterized SQL WHERE clauses
 */

import { validateFields } from "@filtron/core";
import type {
	ASTNode,
	Value,
	ComparisonOperator,
	TemporalPoint,
	OrExpression,
	AndExpression,
	NotExpression,
	ComparisonExpression,
	ExistsExpression,
	BooleanFieldExpression,
} from "@filtron/core";

/**
 * SQL generation result
 */
export interface SQLResult {
	/** SQL WHERE clause (without the WHERE keyword) */
	sql: string;
	/** Array of parameter values in order */
	params: unknown[];
}

/**
 * SQL generation options
 */
export interface SQLOptions {
	/**
	 * Dialect preset that sets defaults for other options
	 * - 'postgres': parameterStyle 'numbered'
	 * - 'mysql': parameterStyle 'question'
	 * - 'sqlite': parameterStyle 'question'
	 *
	 * Explicitly supplied options always override the preset.
	 * @default undefined
	 */
	dialect?: "postgres" | "mysql" | "sqlite";

	/**
	 * Parameter placeholder style
	 * - 'numbered': PostgreSQL/CockroachDB style ($1, $2, $3)
	 * - 'question': MySQL/SQLite/DuckDB style (?, ?, ?)
	 * @default 'numbered'
	 */
	parameterStyle?: "numbered" | "question";

	/**
	 * Custom field name mapper
	 * Useful for escaping field names or mapping to table columns
	 * @default (field) => field
	 */
	fieldMapper?: (field: string) => string;

	/**
	 * Value mapper for LIKE operator (~)
	 * Full custom control over the pattern; applied to the value before
	 * parameterization. When set, it replaces the `likeMode` behavior
	 * entirely: no default escaping or wildcard wrapping is applied.
	 * @default undefined
	 *
	 * @example
	 * ```typescript
	 * // Prefix ("starts with") matching instead of the contains default
	 * toSQL(ast, {
	 *   valueMapper: (value) => `${escapeLike(String(value))}%`
	 * })
	 * ```
	 */
	valueMapper?: (value: string | number | boolean) => string | number | boolean;

	/**
	 * How the `~` operator builds its LIKE parameter value
	 * - 'contains': wrap the value as `%value%`, escaping LIKE
	 *   metacharacters (%, _, \) first, matching @filtron/js substring
	 *   semantics
	 * - 'raw': pass the value through untouched; wildcards and escaping
	 *   are the caller's responsibility
	 *
	 * Precedence: if `valueMapper` is set it is applied and `likeMode` is
	 * ignored; otherwise 'raw' passes the value through and 'contains'
	 * applies the default transform.
	 * @default 'contains'
	 */
	likeMode?: "contains" | "raw";

	/**
	 * Starting parameter index (for numbered parameters)
	 * @default 1
	 */
	startIndex?: number;

	/**
	 * Allowed field names for SQL generation
	 * If provided, the whole AST is validated up front and toSQL throws
	 * if any field is not in this list. Field names are interpolated into
	 * the generated SQL; the parser's lexer restricts the field charset
	 * for parsed queries, but hand-built ASTs are unvalidated, so an
	 * allowlist guards those and adds defense in depth
	 * @default undefined (all fields allowed)
	 */
	allowedFields?: string[];
}

/**
 * Internal state for SQL generation
 */
interface GeneratorState {
	params: unknown[];
	numbered: boolean;
	fieldMapper: (field: string) => string;
	/** Resolved `~` value transform: valueMapper, identity (raw), or contains */
	likeValue: (value: string | number | boolean) => string | number | boolean;
	paramIndex: number;
}

/** Default mappers, hoisted to avoid allocating closures per toSQL call */
const identityField = (field: string): string => field;
const identityValue = (value: string | number | boolean): string | number | boolean => value;

/** Precomputed placeholders for the common parameter counts */
const NUMBERED_PLACEHOLDERS: string[] = Array.from({ length: 65 }, (_, i) => `$${i}`);

/**
 * Per-dialect option defaults, consulted only when the corresponding option
 * is not supplied explicitly. Future dialect-specific defaults (identifier
 * quoting, LIKE escape clauses) slot in here without API changes.
 */
const DIALECT_PRESETS: Record<
	NonNullable<SQLOptions["dialect"]>,
	{ parameterStyle: NonNullable<SQLOptions["parameterStyle"]> }
> = {
	postgres: { parameterStyle: "numbered" },
	mysql: { parameterStyle: "question" },
	sqlite: { parameterStyle: "question" },
};

/**
 * Converts a Filtron AST to a parameterized SQL WHERE clause
 *
 * @param ast - The Filtron AST node to convert
 * @param options - SQL generation options
 * @returns SQL result with WHERE clause and parameters
 *
 * @example
 * ```typescript
 * import { parse } from '@filtron/core';
 * import { toSQL } from '@filtron/sql';
 *
 * const ast = parse('age > 18 AND status = "active"');
 * if (ast.success) {
 *   const { sql, params } = toSQL(ast.ast);
 *   console.log(sql);    // "age > $1 AND status = $2"
 *   console.log(params); // [18, "active"]
 * }
 * ```
 */
export function toSQL(ast: ASTNode, options: SQLOptions = {}): SQLResult {
	if (options.allowedFields) {
		validateFields(ast, options.allowedFields);
	}

	// Explicit parameterStyle wins, then the dialect preset, then 'numbered'
	const parameterStyle =
		options.parameterStyle ??
		(options.dialect === undefined ? undefined : DIALECT_PRESETS[options.dialect].parameterStyle);

	const state: GeneratorState = {
		params: [],
		numbered: parameterStyle !== "question",
		fieldMapper: options.fieldMapper ?? identityField,
		likeValue: options.valueMapper ?? (options.likeMode === "raw" ? identityValue : contains),
		paramIndex: options.startIndex ?? 1,
	};

	const sql = generateSQL(ast, state);

	return {
		sql,
		params: state.params,
	};
}

/**
 * SQL operator precedence (lowest to highest): OR < AND < NOT < leaf.
 * A child wraps in parentheses only when it binds looser than its parent.
 */
const PREC_OR = 1;
const PREC_AND = 2;
const PREC_NOT = 3;

/**
 * Recursively generates SQL from AST nodes
 */
function generateSQL(node: ASTNode, state: GeneratorState, parentPrec = 0): string {
	switch (node.type) {
		case "or":
			return generateOr(node, state, parentPrec);
		case "and":
			return generateAnd(node, state, parentPrec);
		case "not":
			return generateNot(node, state);
		case "comparison":
			return generateComparison(node, state);
		case "oneOf":
			return generateInClause(state.fieldMapper(node.field), node.values, state, node.negated);
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
 * Generates SQL for OR expression
 * The parser guarantees flat chains of two or more children
 */
function generateOr(node: OrExpression, state: GeneratorState, parentPrec: number): string {
	let sql = generateSQL(node.children[0], state, PREC_OR);
	for (let i = 1; i < node.children.length; i++) {
		sql += " OR " + generateSQL(node.children[i], state, PREC_OR);
	}
	return parentPrec > PREC_OR ? `(${sql})` : sql;
}

/**
 * Generates SQL for AND expression
 * The parser guarantees flat chains of two or more children
 */
function generateAnd(node: AndExpression, state: GeneratorState, parentPrec: number): string {
	let sql = generateSQL(node.children[0], state, PREC_AND);
	for (let i = 1; i < node.children.length; i++) {
		sql += " AND " + generateSQL(node.children[i], state, PREC_AND);
	}
	return parentPrec > PREC_AND ? `(${sql})` : sql;
}

/**
 * Generates SQL for NOT expression
 */
function generateNot(node: NotExpression, state: GeneratorState): string {
	return `NOT ${generateSQL(node.expression, state, PREC_NOT)}`;
}

/**
 * Generates SQL for comparison expression
 */
function generateComparison(node: ComparisonExpression, state: GeneratorState): string {
	const field = state.fieldMapper(node.field);

	if (node.value.type === "range") {
		const minParam = addParameter(
			node.value.kind === "temporal" ? temporalBoundParam(node.value.min) : node.value.min,
			state,
		);
		const maxParam = addParameter(
			node.value.kind === "temporal" ? temporalBoundParam(node.value.max) : node.value.max,
			state,
		);
		if (node.operator === "=" || node.operator === ":") {
			return `${field} BETWEEN ${minParam} AND ${maxParam}`;
		}
		if (node.operator === "!=") {
			return `${field} NOT BETWEEN ${minParam} AND ${maxParam}`;
		}
		throw new Error(`Range values require the =, : or != operator, got ${node.operator}`);
	}

	if (node.value.type === "date") {
		if (node.operator === "~") {
			// The parser rejects this; guards hand-built ASTs like @filtron/js
			throw new Error("Temporal values cannot be used with the ~ operator");
		}
		const param = addParameter(node.value.value, state);
		return `${field} ${mapComparisonOperator(node.operator)} ${param}`;
	}

	if (node.value.type === "now") {
		throw new Error(UNRESOLVED_NOW);
	}

	const operator = mapComparisonOperator(node.operator);

	// Apply the resolved LIKE value transform for the ~ operator
	let value = extractValue(node.value);
	if (node.operator === "~") {
		value = state.likeValue(value);
	}

	const param = addParameter(value, state);

	return `${field} ${operator} ${param}`;
}

/**
 * Helper function to generate SQL for IN and NOT IN clauses
 */
function generateInClause(
	field: string,
	values: Value[],
	state: GeneratorState,
	negate: boolean,
): string {
	const len = values.length;

	if (len === 0) {
		// Empty IN clause - always false, empty NOT IN clause - always true
		return negate ? "1 = 1" : "1 = 0";
	}

	let placeholders = addParameter(extractValue(values[0]), state);
	for (let i = 1; i < len; i++) {
		placeholders += ", " + addParameter(extractValue(values[i]), state);
	}

	const operator = negate ? "NOT IN" : "IN";
	return `${field} ${operator} (${placeholders})`;
}

/**
 * Generates SQL for exists expression (negated or not)
 */
function generateExists(node: ExistsExpression, state: GeneratorState): string {
	const field = state.fieldMapper(node.field);
	return node.negated ? `${field} IS NULL` : `${field} IS NOT NULL`;
}

/**
 * Generates SQL for boolean field expression
 */
function generateBooleanField(node: BooleanFieldExpression, state: GeneratorState): string {
	const field = state.fieldMapper(node.field);
	const param = addParameter(true, state);
	return `${field} = ${param}`;
}

/**
 * Maps Filtron comparison operators to SQL operators
 */
function mapComparisonOperator(operator: ComparisonOperator): string {
	switch (operator) {
		case "=":
		case ":":
			return "=";
		case "!=":
			return "!=";
		case "~":
			return "LIKE";
		case ">":
			return ">";
		case ">=":
			return ">=";
		case "<":
			return "<";
		case "<=":
			return "<=";
		default: {
			const _exhaustive: never = operator;
			throw new Error(`Unknown operator: ${operator as string}`);
		}
	}
}

const UNRESOLVED_NOW =
	"Unresolved relative time value: resolve now-relative values before generating SQL";

/**
 * Converts a temporal range bound to its parameter value; now-relative
 * bounds must be resolved before generating SQL
 */
function temporalBoundParam(point: TemporalPoint): string {
	if (point.type === "now") {
		throw new Error(UNRESOLVED_NOW);
	}
	return point.value;
}

/**
 * Extracts the primitive value from a Filtron Value node
 */
function extractValue(value: Value): string | number | boolean {
	switch (value.type) {
		case "range":
			// The parser only produces ranges where callers handle them first
			throw new Error("Range values cannot be used here");
		case "date":
		case "now":
			// The parser rejects temporal values in arrays
			throw new Error("Temporal values cannot be used here");
		case "string":
			return value.value;
		case "number":
			return value.value;
		case "boolean":
			return value.value;
		case "identifier":
			// Identifiers are treated as strings in SQL context
			return value.value;
		default: {
			const _exhaustive: never = value;
			throw new Error(`Unknown value type: ${(value as Value).type}`);
		}
	}
}

/**
 * Adds a parameter to the state and returns the placeholder
 */
function addParameter(value: unknown, state: GeneratorState): string {
	state.params.push(value);

	if (state.numbered) {
		const index = state.paramIndex++;
		return index < NUMBERED_PLACEHOLDERS.length ? NUMBERED_PLACEHOLDERS[index] : `$${index}`;
	}

	return "?";
}

/**
 * Escapes special LIKE characters (%, _, \) in a string value
 * Use this to prevent LIKE injection when user input is used in LIKE patterns
 *
 * @param value - The value to escape
 * @returns Escaped string safe for use in LIKE patterns
 *
 * @example
 * ```typescript
 * escapeLike("admin%") // "admin\\%"
 * escapeLike("test_user") // "test\\_user"
 * ```
 */
export function escapeLike(value: string): string {
	// Fast path: if no special chars, return as-is
	if (!/[\\%_]/.test(value)) {
		return value;
	}

	// Single pass replace with callback
	return value.replace(/[\\%_]/g, (char) => "\\" + char);
}

/**
 * Wraps a value with wildcards for "contains" matching
 * Automatically escapes special LIKE characters
 * This is the default `~` value transform (likeMode 'contains')
 *
 * @param value - The value to wrap
 * @returns Value wrapped with % wildcards
 *
 * @example
 * ```typescript
 * contains("foo") // "%foo%"
 * ```
 */
export function contains(value: string | number | boolean): string {
	return `%${escapeLike(String(value))}%`;
}

/**
 * Adds trailing wildcard for "starts with" matching
 * Automatically escapes special LIKE characters
 *
 * @param value - The value to wrap
 * @returns Value with % wildcard at the end
 *
 * @example
 * ```typescript
 * toSQL(ast, { valueMapper: prefix })
 * // "admin" becomes "admin%"
 * ```
 */
export function prefix(value: string | number | boolean): string {
	return `${escapeLike(String(value))}%`;
}

/**
 * Adds leading wildcard for "ends with" matching
 * Automatically escapes special LIKE characters
 *
 * @param value - The value to wrap
 * @returns Value with % wildcard at the beginning
 *
 * @example
 * ```typescript
 * toSQL(ast, { valueMapper: suffix })
 * // ".pdf" becomes "%.pdf"
 * ```
 */
export function suffix(value: string | number | boolean): string {
	return `%${escapeLike(String(value))}`;
}
