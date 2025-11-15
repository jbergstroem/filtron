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
	| NotOneOfExpression
	| ExistsExpression
	| BooleanFieldExpression;

/**
 * Value type - represents literal values in expressions
 */
export type Value = StringValue | NumberValue | BooleanValue | IdentifierValue;

/**
 * Comparison operators supported
 */
export type ComparisonOperator =
	| "="
	| "!="
	| "~"
	| ">"
	| ">="
	| "<"
	| "<="
	| ":";

/**
 * Logical OR expression - combines two expressions with OR
 */
export interface OrExpression {
	type: "or";
	left: ASTNode;
	right: ASTNode;
}

/**
 * Logical AND expression - combines two expressions with AND
 */
export interface AndExpression {
	type: "and";
	left: ASTNode;
	right: ASTNode;
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
 * One-of expression - checks if field matches any value in a list
 * Example: status : ["pending", "approved"]
 */
export interface OneOfExpression {
	type: "oneOf";
	field: string;
	values: Value[];
}

/**
 * Not-one-of expression - checks if field doesn't match any value in a list
 * Example: status !: ["inactive", "deleted"]
 */
export interface NotOneOfExpression {
	type: "notOneOf";
	field: string;
	values: Value[];
}

/**
 * Exists expression - checks if a field exists and is not its zero value
 * Example: email?, name EXISTS
 */
export interface ExistsExpression {
	type: "exists";
	field: string;
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
