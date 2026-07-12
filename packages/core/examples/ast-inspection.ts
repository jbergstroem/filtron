// Traversing the AST to extract all field names used in a query.
// Run with: bun run examples/ast-inspection.ts

import { parseOrThrow, walk } from "../src/index";

const ast = parseOrThrow('(role = "admin" OR role = "user") AND verified AND age >= 21');

const fields = new Set<string>();
walk(ast, (node) => {
	if ("field" in node) {
		fields.add(node.field);
	}
});

console.log("Fields:", [...fields]);
// Output: Fields: [ "role", "verified", "age" ]
