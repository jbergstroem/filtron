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
export type { ParseOptions, ParseResult, ParseSuccess, ParseFailure } from "./parser";

// AST walker
export { walk } from "./walker";

// Canonical printing
export { print } from "./printer";

// AST field validation
export { validateFields } from "./validate";

// Lexer for tokenization
export { Lexer } from "./lexer";
export type {
	Token,
	TokenType,
	StringToken,
	NumberToken,
	BooleanToken,
	SymbolToken,
} from "./lexer";

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
	ExistsExpression,
	BooleanFieldExpression,
	StringValue,
	NumberValue,
	BooleanValue,
	IdentifierValue,
	RangeValue,
	NumberRangeValue,
	TemporalRangeValue,
	DateValue,
	NowValue,
	TemporalPoint,
	DurationUnit,
} from "./types";
