// LIKE pattern behavior for the contains operator (~).
// Run with: bun run examples/like-patterns.ts

import { parseOrThrow } from "@filtron/core";
import { toSQL, prefix, suffix, escapeLike } from "../src/converter";

const ast = parseOrThrow('name ~ "john"');

// Default: ~ means contains. The value is wrapped in % wildcards
// with LIKE metacharacters escaped, matching @filtron/js semantics.
const contains = toSQL(ast);
console.log("Contains (default):", contains.sql, contains.params);
// Output: name LIKE $1 ["%john%"]

// Metacharacters in the value are escaped so they match literally
const escaped = toSQL(parseOrThrow('name ~ "100%"'));
console.log("Escaped:", escaped.sql, escaped.params);
// Output: name LIKE $1 ["%100\\%%"]

// likeMode "raw" passes the value through untouched;
// wildcards and escaping are up to the caller
const raw = toSQL(parseOrThrow('name ~ "john%"'), { likeMode: "raw" });
console.log("Raw:", raw.sql, raw.params);
// Output: name LIKE $1 ["john%"]

// valueMapper gives full control and takes precedence over likeMode
const prefixResult = toSQL(ast, { valueMapper: prefix });
console.log("Prefix:", prefixResult.sql, prefixResult.params);
// Output: name LIKE $1 ["john%"]

const suffixResult = toSQL(ast, { valueMapper: suffix });
console.log("Suffix:", suffixResult.sql, suffixResult.params);
// Output: name LIKE $1 ["%john"]

// escapeLike() escapes %, _ and \ for custom patterns
console.log("escapeLike:", escapeLike("100%_match"));
// Output: 100\%\_match
