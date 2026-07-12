/**
 * The Filtron parser public API
 */

import { FiltronParseError } from "./errors";
import { parseQuery } from "./rd-parser";
import type { ASTNode } from "./types";

export { FiltronParseError } from "./errors";

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
export const parse = (query: string): ParseResult => {
	try {
		const ast = parseQuery(query);
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
export const parseOrThrow = (query: string): ASTNode => {
	try {
		return parseQuery(query);
	} catch (error) {
		if (error instanceof FiltronParseError) {
			throw error;
		}

		throw new FiltronParseError(error instanceof Error ? error.message : String(error));
	}
};
