// Using LIKE patterns with automatic wildcard helpers.
// Run with: bun run examples/like-patterns.ts

import { parseOrThrow } from "@filtron/core";
import { toSQL, contains, prefix, suffix, escapeLike } from "../src/converter";

const ast = parseOrThrow('name ~ "john"');

// Manual wildcards in the query string
const manual = toSQL(parseOrThrow('name ~ "%john%"'));
console.log("Manual:", manual.sql, manual.params);
// Output: name LIKE $1 ["%john%"]

// Using contains() helper - wraps with % on both sides
const containsResult = toSQL(ast, { valueMapper: contains });
console.log("Contains:", containsResult.sql, containsResult.params);
// Output: name LIKE $1 ["%john%"]

// Using prefix() helper - for "starts with" queries
const prefixResult = toSQL(ast, { valueMapper: prefix });
console.log("Prefix:", prefixResult.sql, prefixResult.params);
// Output: name LIKE $1 ["john%"]

// Using suffix() helper - for "ends with" queries
const suffixResult = toSQL(ast, { valueMapper: suffix });
console.log("Suffix:", suffixResult.sql, suffixResult.params);
// Output: name LIKE $1 ["%john"]

// escapeLike() prevents LIKE injection when user input contains % or _
const userInput = "100%_match";
console.log("Escaped:", escapeLike(userInput));
// Output: 100\%\_match
