/**
 * The Filtron parser public API
 */

import { FiltronParseError } from "./errors";
import { parseQuery } from "./rd-parser";
import type { ASTNode } from "./types";

export { FiltronParseError } from "./errors";

/**
 * Limits applied while parsing a query. Both values are upper bounds;
 * pass larger numbers to raise them.
 */
export interface ParseOptions {
	/**
	 * Maximum query length in characters. Defaults to 10000.
	 */
	maxLength?: number;
	/**
	 * Maximum combined nesting depth of parenthesized groups and NOT
	 * expressions. Defaults to 64.
	 */
	maxDepth?: number;
}

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
export interface ParseFailure {
	success: false;
	message: string;
	position?: number;
}

/**
 * The generic parse result
 */
export type ParseResult = ParseSuccess | ParseFailure;

/**
 * Parses a Filtron query string into an Abstract Syntax Tree (AST).
 *
 * @param query - The Filtron query string to parse
 * @param options - Optional parse limits, see {@link ParseOptions}
 * @returns A ParseResult containing either the AST or an error
 *
 * @example
 * ```typescript
 * const result = parse('age > 18 AND status = "active"');
 * if (result.success) {
 *   console.log(result.ast);
 * } else {
 *   console.error(result.message);
 * }
 * ```
 */
export const parse = (query: string, options?: ParseOptions): ParseResult => {
	try {
		const ast = parseQuery(query, options);
		return {
			success: true,
			ast,
		};
	} catch (error) {
		if (error instanceof FiltronParseError) {
			return {
				success: false,
				message: error.message,
				position: error.position,
			};
		}

		return {
			success: false,
			message: error instanceof Error ? error.message : String(error),
		};
	}
};

/**
 * Parses a Filtron query string and throws an error if parsing fails.
 * Use this when you want to handle errors with try/catch instead of checking the result.
 *
 * @param query - The Filtron query string to parse
 * @param options - Optional parse limits, see {@link ParseOptions}
 * @returns The parsed AST
 * @throws FiltronParseError if parsing fails, with position information
 *
 * @example
 * ```typescript
 * try {
 *   const ast = parseOrThrow('age > 18');
 *   console.log(ast);
 * } catch (error) {
 *   if (error instanceof FiltronParseError) {
 *     console.error('Parse failed at position', error.position, ':', error.message);
 *   }
 * }
 * ```
 */
export const parseOrThrow = (query: string, options?: ParseOptions): ASTNode => {
	try {
		return parseQuery(query, options);
	} catch (error) {
		if (error instanceof FiltronParseError) {
			throw error;
		}

		throw new FiltronParseError(error instanceof Error ? error.message : String(error));
	}
};
