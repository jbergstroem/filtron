// Minimal example of parsing a Filtron query.
// Run with: bun run examples/simple.ts

import { parse } from "../src/index";

const result = parse('status = "active" AND age >= 18');

if (result.success) {
	console.log(result.ast);
} else {
	console.error(result.error);
}
