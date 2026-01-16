// Traversing the AST to extract all field names used in a query.
// Run with: bun run examples/ast-inspection.ts

import { parseOrThrow, type ASTNode } from "../src/index";

function collectFields(node: ASTNode): string[] {
	switch (node.type) {
		case "or":
		case "and":
			return [...collectFields(node.left), ...collectFields(node.right)];
		case "not":
			return collectFields(node.expression);
		case "comparison":
		case "oneOf":
		case "notOneOf":
		case "exists":
		case "booleanField":
		case "range":
			return [node.field];
	}
}

const ast = parseOrThrow('(role = "admin" OR role = "user") AND verified AND age >= 21');
const fields = [...new Set(collectFields(ast))];

console.log("Fields:", fields);
// Output: Fields: [ "role", "verified", "age" ]
