/**
 * Errors thrown by the Filtron parser
 */

/**
 * Error thrown when parsing a Filtron query fails.
 * Includes the position in the query where the error occurred.
 */
export class FiltronParseError extends Error {
	constructor(
		message: string,
		public position?: number,
	) {
		super(message);
		this.name = "FiltronParseError";
	}
}
