/**
 * SQL converter for Filtron AST
 * Converts Filtron AST nodes to parameterized SQL WHERE clauses
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
	 * Parameter placeholder style
	 * - 'numbered': PostgreSQL/DuckDB style ($1, $2, $3)
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
	 * Starting parameter index (for numbered parameters)
	 * @default 1
	 */
	startIndex?: number;
}

/**
 * Internal state for SQL generation
 */
interface GeneratorState {
	params: unknown[];
	parameterStyle: "numbered" | "question";
	fieldMapper: (field: string) => string;
	paramIndex: number;
}

/**
 * Converts a Filtron AST to a parameterized SQL WHERE clause
 *
 * @param ast - The Filtron AST node to convert
 * @param options - SQL generation options
 * @returns SQL result with WHERE clause and parameters
 *
 * @example
 * ```typescript
 * import { parse } from 'filtron';
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
	const state: GeneratorState = {
		params: [],
		parameterStyle: options.parameterStyle ?? "numbered",
		fieldMapper: options.fieldMapper ?? ((field) => field),
		paramIndex: options.startIndex ?? 1,
	};

	const sql = generateSQL(ast, state);

	return {
		sql,
		params: state.params,
	};
}

/**
 * Recursively generates SQL from AST nodes
 */
function generateSQL(node: ASTNode, state: GeneratorState): string {
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
		default:
			// TypeScript exhaustiveness check
			const _exhaustive: never = node;
			throw new Error(`Unknown node type: ${(node as ASTNode).type}`);
	}
}

/**
 * Generates SQL for OR expression
 */
function generateOr(node: OrExpression, state: GeneratorState): string {
	const left = generateSQL(node.left, state);
	const right = generateSQL(node.right, state);
	return `(${left} OR ${right})`;
}

/**
 * Generates SQL for AND expression
 */
function generateAnd(node: AndExpression, state: GeneratorState): string {
	const left = generateSQL(node.left, state);
	const right = generateSQL(node.right, state);
	return `(${left} AND ${right})`;
}

/**
 * Generates SQL for NOT expression
 */
function generateNot(node: NotExpression, state: GeneratorState): string {
	const expr = generateSQL(node.expression, state);
	return `NOT (${expr})`;
}

/**
 * Generates SQL for comparison expression
 */
function generateComparison(
	node: ComparisonExpression,
	state: GeneratorState,
): string {
	const field = state.fieldMapper(node.field);
	const operator = mapComparisonOperator(node.operator);
	const param = addParameter(extractValue(node.value), state);

	return `${field} ${operator} ${param}`;
}

/**
 * Generates SQL for one-of expression (IN clause)
 */
function generateOneOf(node: OneOfExpression, state: GeneratorState): string {
	const field = state.fieldMapper(node.field);
	const values = node.values.map((v) => extractValue(v));

	if (values.length === 0) {
		// Empty IN clause - always false
		return "1 = 0";
	}

	const placeholders = values.map((value) => addParameter(value, state));
	return `${field} IN (${placeholders.join(", ")})`;
}

/**
 * Generates SQL for not-one-of expression (NOT IN clause)
 */
function generateNotOneOf(
	node: NotOneOfExpression,
	state: GeneratorState,
): string {
	const field = state.fieldMapper(node.field);
	const values = node.values.map((v) => extractValue(v));

	if (values.length === 0) {
		// Empty NOT IN clause - always true
		return "1 = 1";
	}

	const placeholders = values.map((value) => addParameter(value, state));
	return `${field} NOT IN (${placeholders.join(", ")})`;
}

/**
 * Generates SQL for exists expression
 */
function generateExists(node: ExistsExpression, state: GeneratorState): string {
	const field = state.fieldMapper(node.field);
	return `${field} IS NOT NULL`;
}

/**
 * Generates SQL for boolean field expression
 */
function generateBooleanField(
	node: BooleanFieldExpression,
	state: GeneratorState,
): string {
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
			// Identifiers are treated as strings in SQL context
			return value.value;
		default:
			const _exhaustive: never = value;
			throw new Error(`Unknown value type: ${(value as Value).type}`);
	}
}

/**
 * Adds a parameter to the state and returns the placeholder
 */
function addParameter(value: unknown, state: GeneratorState): string {
	state.params.push(value);

	if (state.parameterStyle === "numbered") {
		const placeholder = `$${state.paramIndex}`;
		state.paramIndex++;
		return placeholder;
	}

	return "?";
}
