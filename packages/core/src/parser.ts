/**
 * Filtron Parser
 *
 * High-performance recursive descent parser for Filtron query language.
 */

import type { ASTNode } from "./types";
import { LexerError } from "./lexer";
import { parseQuery, ParseError as RDParseError } from "./rd-parser";

/**
 * Result of a successful parse operation
 */
export interface ParseSuccess {
	success: true;
	ast: ASTNode;
}

/**
 * Result of a failed parse operation
 */
export interface ParseError {
	success: false;
	error: string;
	message: string;
}

/**
 * The generic parse result
 */
export type ParseResult = ParseSuccess | ParseError;

/**
 * Parses a Filtron query string into an Abstract Syntax Tree (AST).
 *
 * @param query - The Filtron query string to parse
 * @returns A ParseResult containing either the AST or an error message
 *
 * @example
 * ```typescript
 * const result = parse('age > 18 AND status = "active"');
 * if (result.success) {
 *   console.log(result.ast);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export const parse = (query: string): ParseResult => {
	try {
		const ast = parseQuery(query);
		return {
			success: true,
			ast,
		};
	} catch (error) {
		let message: string;

		if (error instanceof RDParseError || error instanceof LexerError) {
			message = error.message;
		} else if (error instanceof Error) {
			message = error.message;
		} else {
			message = String(error);
		}

		return {
			success: false,
			error: message,
			message,
		};
	}
};

/**
 * Parses a Filtron query string and throws an error if parsing fails.
 * Use this when you want to handle errors with try/catch instead of checking the result.
 *
 * @param query - The Filtron query string to parse
 * @returns The parsed AST
 * @throws Error if parsing fails
 *
 * @example
 * ```typescript
 * try {
 *   const ast = parseOrThrow('age > 18');
 *   console.log(ast);
 * } catch (error) {
 *   console.error('Parse failed:', error.message);
 * }
 * ```
 */
export const parseOrThrow = (query: string): ASTNode => {
	const result = parse(query);

	if (result.success) {
		return result.ast;
	}

	throw new Error(`Failed to parse Filtron query: ${result.error}`);
};
