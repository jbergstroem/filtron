// Handling parse errors with both parse() and parseOrThrow().
// Run with: bun run examples/error-handling.ts

import { parse, parseOrThrow, FiltronParseError } from "../src/index";

// Using parse() - returns a result object with success/error
const result = parse("invalid === query");

if (!result.success) {
	console.log("Parse failed:", result.error);
	if (result.position !== undefined) {
		console.log("Error position:", result.position);
	}
}

// Using parseOrThrow() - throws FiltronParseError on failure
try {
	parseOrThrow("another bad >> query");
} catch (error) {
	if (error instanceof FiltronParseError) {
		console.log("Caught FiltronParseError:", error.message);
		if (error.position !== undefined) {
			console.log("Error position:", error.position);
		}
	}
}
