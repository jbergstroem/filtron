/**
 * Filtron Abstract Syntax Tree (AST) type definitions
 */

/**
 * Root AST node type - represents any valid Filtron expression
 */
export type ASTNode =
	| OrExpression
	| AndExpression
	| NotExpression
	| ComparisonExpression
	| OneOfExpression
	| ExistsExpression
	| BooleanFieldExpression;

/**
 * Value type - represents literal values in expressions
 */
export type Value =
	| StringValue
	| NumberValue
	| BooleanValue
	| IdentifierValue
	| RangeValue
	| DateValue
	| NowValue;

/**
 * Comparison operators supported
 */
export type ComparisonOperator = "=" | "!=" | "~" | ">" | ">=" | "<" | "<=" | ":";

/**
 * Logical OR expression - combines two or more expressions with OR
 *
 * Chains are flat: children always has at least two entries and never
 * contains another OrExpression. The parser splices nested OR chains
 * (including parenthesized ones) into a single node.
 */
export interface OrExpression {
	type: "or";
	children: ASTNode[];
}

/**
 * Logical AND expression - combines two or more expressions with AND
 *
 * Chains are flat: children always has at least two entries and never
 * contains another AndExpression. The parser splices nested AND chains
 * (including parenthesized ones) into a single node.
 */
export interface AndExpression {
	type: "and";
	children: ASTNode[];
}

/**
 * Logical NOT expression - negates an expression
 */
export interface NotExpression {
	type: "not";
	expression: ASTNode;
}

/**
 * Comparison expression - compares a field to a value using an operator
 * Example: age > 18, status = "active"
 */
export interface ComparisonExpression {
	type: "comparison";
	field: string;
	operator: ComparisonOperator;
	value: Value;
}

/**
 * Membership expression - checks whether a field matches any value in a list
 * Example: status : ["pending", "approved"], status !: ["deleted"] (negated)
 */
export interface OneOfExpression {
	type: "oneOf";
	field: string;
	values: Value[];
	negated: boolean;
}

/**
 * Exists expression - checks whether a field exists (is not null/undefined)
 * Example: email?, -email (negated)
 */
export interface ExistsExpression {
	type: "exists";
	field: string;
	negated: boolean;
}

/**
 * Boolean field expression - shorthand for checking if a boolean field is true
 * Example: verified, premium
 */
export interface BooleanFieldExpression {
	type: "booleanField";
	field: string;
}

/**
 * String value - a quoted string literal
 */
export interface StringValue {
	type: "string";
	value: string;
}

/**
 * Number value - an integer or floating-point number
 */
export interface NumberValue {
	type: "number";
	value: number;
}

/**
 * Boolean value - true or false
 */
export interface BooleanValue {
	type: "boolean";
	value: boolean;
}

/**
 * Identifier value - an unquoted identifier used as a value
 */
export interface IdentifierValue {
	type: "identifier";
	value: string;
}

/**
 * Units for now-relative offsets
 * Case-sensitive: m is minutes, M is months
 */
export type DurationUnit = "s" | "m" | "h" | "d" | "w" | "M" | "y";

/**
 * Date value - an absolute point in time, written as @<ISO 8601>
 * Example: @2024-06-01, @2024-06-30T14:00:00Z
 */
export interface DateValue {
	type: "date";
	value: string;
}

/**
 * Now value - a point in time relative to evaluation, written as
 * @now with an optional offset. Inert at parse time: adapters reject
 * it until it is resolved to a DateValue
 * Example: @now, @now-7d, @now+2h
 */
export interface NowValue {
	type: "now";
	offset: { amount: number; unit: DurationUnit } | null;
}

/**
 * A temporal range bound: an absolute date or a now-relative point
 */
export type TemporalPoint = DateValue | NowValue;

/**
 * Range value over numbers - an inclusive interval
 * Valid with the =, : and != operators only
 * Example: age = 18..65, price != 0..100
 */
export interface NumberRangeValue {
	type: "range";
	kind: "number";
	min: number;
	max: number;
}

/**
 * Range value over points in time - an inclusive interval
 * Valid with the =, : and != operators only
 * Example: deployed = @2024-06-01..2024-06-30, created = @now-7d..now
 */
export interface TemporalRangeValue {
	type: "range";
	kind: "temporal";
	min: TemporalPoint;
	max: TemporalPoint;
}

/**
 * Range value - an inclusive interval over numbers or points in time
 */
export type RangeValue = NumberRangeValue | TemporalRangeValue;
