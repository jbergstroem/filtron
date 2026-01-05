/**
 * Filtron - A simple query language for filtering data
 *
 * @example
 * ```typescript
 * import { parse } from 'filtron';
 *
 * const result = parse('age > 18 AND status = "active"');
 * if (result.success) {
 *   console.log(result.ast);
 * }
 * ```
 */

// Parser functions
export { parse, parseOrThrow, FiltronParseError } from "./parser";
export type { ParseResult, ParseSuccess, ParseError } from "./parser";

// AST type definitions
export type {
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
	StringValue,
	NumberValue,
	BooleanValue,
	IdentifierValue,
} from "./types";
