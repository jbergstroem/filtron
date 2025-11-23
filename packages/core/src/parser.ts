import type { ASTNode } from "./types";
import { tryFastPath } from "./fast-path";
import grammarBundle from "./grammar.ohm-bundle.js";
import { semanticActions } from "./semantics";

// Create semantics with proper typing from generated bundle
// Note: We use 'as any' here because the generated types are too restrictive for runtime usage
// The generated types are still useful for compile-time checking in semantics.ts
const grammar = grammarBundle as any;
const semantics = grammar.createSemantics();
semantics.addOperation("toAST", semanticActions);

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
 * Result of a parse operation - either success or error
 */
export type ParseResult = ParseSuccess | ParseError;

/**
 * Options for configuring the parser behavior
 */
export interface ParseOptions {
	/**
	 * Enable fast-path optimization for simple queries.
	 * When enabled, simple queries (like "field = value" or "field1 = 1 AND field2 = 2")
	 * bypass the full parser using optimized regex patterns for better performance.
	 *
	 * Fast-path automatically falls back to the full parser when patterns don't match,
	 * so there's no downside to keeping it enabled (default).
	 *
	 * @default true
	 */
	fastPath?: boolean;
}

/**
 * Parses a Filtron query string into an Abstract Syntax Tree (AST).
 *
 * @param query - The Filtron query string to parse
 * @param options - Optional configuration for parser behavior
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
 *
 * @example
 * ```typescript
 * // Enable fast-path for simple queries
 * const result = parse('status = "active"', { fastPath: true });
 * ```
 *
 * @example
 * ```typescript
 * // Complex queries don't need fast-path
 * const result = parse('(age > 18 OR verified) AND NOT banned', { fastPath: false });
 * ```
 */
export const parse = (
	query: string,
	options: ParseOptions = {},
): ParseResult => {
	const { fastPath = true } = options;

	// Try fast path first for common patterns if enabled
	// Fast paths bypass the full grammar parser for significant speedup
	if (fastPath) {
		const fastPathResult = tryFastPath(query);
		if (fastPathResult) {
			return {
				success: true,
				ast: fastPathResult,
			};
		}
	}

	// Use full grammar parser
	try {
		const matchResult = grammar.match(query);

		if (matchResult.failed()) {
			return {
				success: false,
				error: matchResult.message ?? "Parse error",
				message: matchResult.message ?? "Parse error",
			};
		}

		const ast = semantics(matchResult).toAST() as ASTNode;

		return {
			success: true,
			ast,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
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
 * @param options - Optional configuration for parser behavior
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
 *
 * @example
 * ```typescript
 * // Enable fast-path for simple queries
 * const ast = parseOrThrow('status = "active"', { fastPath: true });
 * ```
 */
export const parseOrThrow = (
	query: string,
	options: ParseOptions = {},
): ASTNode => {
	const result = parse(query, options);

	if (result.success) {
		return result.ast;
	}

	throw new Error(`Failed to parse Filtron query: ${result.error}`);
};
