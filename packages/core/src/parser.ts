import type { ASTNode } from "./types";
import grammarBundle from "./grammar.ohm-bundle.js";
import { semanticActions } from "./semantics";
import {
	tryFastPath,
	getFastPathMetrics,
} from "./fast-path";

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
	// Try fast path first for common patterns
	// Fast paths bypass the full grammar parser for significant speedup
	const fastPathResult = tryFastPath(query);
	if (fastPathResult) {
		return {
			success: true,
			ast: fastPathResult,
		};
	}

	// Fall back to full grammar parser for complex queries
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
