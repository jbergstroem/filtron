# @filtron/core

A fast, human-friendly filter language for JavaScript and TypeScript. Parse expressions like `age > 18 AND verified` into a type-safe AST.

[![npm version](https://img.shields.io/npm/v/@filtron/core.svg)](https://www.npmjs.com/package/@filtron/core)
[![npm bundle size](https://img.shields.io/bundlephobia/min/%40filtron%2Fcore)](https://bundlephobia.com/package/@filtron/core)
[![codecov](https://codecov.io/gh/jbergstroem/filtron/graph/badge.svg?token=FXIWJKJ9RI&component=core)](https://codecov.io/gh/jbergstroem/filtron)

## Why Filtron?

Let users filter data with readable expressions:

```
price < 100 AND category : ["electronics", "books"] AND inStock
```

Filtron parses these expressions into a structured AST you can use to generate SQL, filter arrays, or build custom query backends — safely, with no risk of injection attacks.

Filtron works best when your data has dynamic or user-defined fields that aren't part of your type system: e-commerce catalogs, log aggregation, CMS taxonomies, or multi-tenant platforms with custom metadata.

## Installation

```bash
npm install @filtron/core
```

**Optional helpers:**

- `@filtron/sql` — Generate parameterized SQL WHERE clauses
- `@filtron/js` — Filter JavaScript arrays in-memory

## Usage

```typescript
import { parse } from "@filtron/core";

const result = parse('age > 18 AND status = "active"');

if (result.success) {
	console.log(result.ast);
} else {
	console.error(result.message);
}
```

## Syntax

```typescript
// Comparisons
parse("age > 18");
parse('status = "active"');
parse('role != "guest"');

// Boolean logic
parse("age > 18 AND verified");
parse("admin OR moderator");
parse("NOT suspended");
parse("(admin OR mod) AND active");

// Field existence
parse("email?");
parse("profile EXISTS");

// Contains (substring)
parse('name ~ "john"');

// One-of (IN)
parse('status : ["pending", "approved"]');

// Ranges
parse("age = 18..65");
parse("price = 9.99..99.99");

// Nested fields
parse("user.profile.age >= 18");
```

## Operators

| Operator             | Meaning       | Example               |
| -------------------- | ------------- | --------------------- |
| `=`, `:`             | Equal         | `status = "active"`   |
| `!=`, `!:`           | Not equal     | `role != "guest"`     |
| `>`, `>=`, `<`, `<=` | Comparison    | `age >= 18`           |
| `~`                  | Contains      | `name ~ "john"`       |
| `?`, `EXISTS`        | Field exists  | `email?`              |
| `-`                  | Field missing | `-email`              |
| `..`                 | Range value   | `age = 18..65`        |
| `@`                  | Temporal      | `created > @now-7d`   |
| `: [...]`            | One of        | `status : ["a", "b"]` |
| `AND`, `OR`, `NOT`   | Boolean logic | `a AND (b OR c)`      |

## API

### `parse(input: string, options?: ParseOptions): ParseResult`

Parses a filter expression and returns a result object.

```typescript
const result = parse("age > 18");

if (result.success) {
	result.ast; // ASTNode
} else {
	result.message; // string - error message
	result.position; // number - position in input where error occurred
}
```

Both `parse` and `parseOrThrow` accept an optional `ParseOptions` object to
bound how large a query can be:

| Option      | Default | Meaning                                                  |
| ----------- | ------- | -------------------------------------------------------- |
| `maxLength` | 10000   | Maximum query length in characters                       |
| `maxDepth`  | 64      | Maximum combined nesting of parenthesized groups and NOT |

Queries exceeding a limit fail with a `FiltronParseError`:

```typescript
const userInput = '(role = "admin" OR role = "moderator") AND verified';

// Safe: tighten the limits for untrusted input
const safeResult = parse(userInput, { maxLength: 500, maxDepth: 8 });

// Unsafe: raising the limits removes the guard against pathological queries
const unsafeResult = parse(userInput, {
	maxLength: Number.MAX_SAFE_INTEGER,
	maxDepth: Number.MAX_SAFE_INTEGER,
});
```

### `parseOrThrow(input: string, options?: ParseOptions): ASTNode`

Parses a filter expression, throwing `FiltronParseError` on invalid input. The same error class is used for all parse failures, whether they originate in the lexer or the parser.

```typescript
import { parseOrThrow, FiltronParseError } from "@filtron/core";

try {
	const ast = parseOrThrow("age > 18");
} catch (error) {
	if (error instanceof FiltronParseError) {
		console.error(error.message); // error description
		console.error(error.position); // position in input where error occurred
	}
}
```

### `walk(node: ASTNode, visitor: (node: ASTNode) => boolean | undefined): void`

Walks an AST in pre-order depth-first order, calling the visitor on each node before its children. Return `false` from the visitor to skip a node's children.

```typescript
import { parseOrThrow, walk } from "@filtron/core";

const ast = parseOrThrow('age > 18 AND status = "active"');
const fields: string[] = [];
walk(ast, (node) => {
	if ("field" in node) {
		fields.push(node.field);
	}
});
// fields: ["age", "status"]
```

### `print(node: ASTNode): string`

Prints an AST as canonical Filtron query text. Parsing the output reproduces the AST, so `print` is suitable for canonicalizing queries (cache keys, logs) and roundtrip testing. Parentheses appear only where a child binds looser than its parent.

```typescript
import { parseOrThrow, print } from "@filtron/core";

print(parseOrThrow("(a AND (b OR c))"));
// "a AND (b OR c)"
```

### `validateFields(node: ASTNode, allowedFields: readonly string[]): void`

Validates that every field referenced in an AST is in the allowlist. Throws an `Error` on the first disallowed field. Consumers like @filtron/js and @filtron/sql use this for their `allowedFields` option.

```typescript
import { parseOrThrow, validateFields } from "@filtron/core";

const ast = parseOrThrow('password = "secret"');

// Safe: an allowlist rejects fields the caller did not expose
validateFields(ast, ["name", "age"]);
// Error: Field "password" is not allowed. Allowed fields: name, age

// Unsafe: skipping validation lets any field through to the adapter
// toSQL(ast) would interpolate whatever field name the AST contains
```

## Types

All AST types are exported for building custom consumers:

```typescript
import {
	FiltronParseError, // Error class for all parse failures
	type ParseOptions,
	type ParseResult,
	type ASTNode,
	type AndExpression,
	type OrExpression,
	type NotExpression,
	type ComparisonExpression,
	type ExistsExpression,
	type BooleanFieldExpression,
	type OneOfExpression,
	type RangeExpression,
	type Value,
	type ComparisonOperator,
	type StringValue,
	type NumberValue,
	type BooleanValue,
	type IdentifierValue,
} from "@filtron/core";
```

The Lexer types are also available if you want to use them for syntax highlighting or other purposes:

```typescript
import { Lexer } from "@filtron/core";
import type { Token, TokenType, StringToken, NumberToken, BooleanToken } from "@filtron/core";
```

### AST structure

| Node Type      | Fields                       | Example input         |
| -------------- | ---------------------------- | --------------------- |
| `and`          | `children`                   | `a AND b`             |
| `or`           | `children`                   | `a OR b`              |
| `not`          | `expression`                 | `NOT a`               |
| `comparison`   | `field`, `operator`, `value` | `age > 18`            |
| `exists`       | `field`, `negated`           | `email?`, `-email`    |
| `booleanField` | `field`                      | `verified`            |
| `oneOf`        | `field`, `values`, `negated` | `status : ["a", "b"]` |

Temporal literals start with `@` and are either a point or a range: `created > @2024-06-01`, `updated > @now-1h`, `deployed = @2024-06-01..2024-06-30`, `created = @now-7d..now`. Absolute dates produce `{ type: "date", value }`; `@now` with an optional signed offset (`s`, `m`, `h`, `d`, `w`, `M`, `y`) produces an inert `{ type: "now", offset }` that adapters reject until it is resolved to a date ([@filtron/time-resolver](../time-resolver/README.md) does this). Points work with every comparison operator except `~`; temporal ranges follow the same `=`, `:`, `!=` rule as numeric ranges.

Ranges are values, not nodes, discriminated by `kind`: `age = 18..65` produces a comparison whose value is `{ type: "range", kind: "number", min: 18, max: 65 }`, and `deployed = @2024-06-01..2024-06-30` produces `{ type: "range", kind: "temporal", min: { type: "date", value: "2024-06-01" }, max: { type: "date", value: "2024-06-30" } }`. Hand-built range values must set `kind`. Ranges work with `=`, `:` and `!=` (outside the interval) and are rejected inside arrays.

Chains of the same operator are flat: `a AND b AND c` produces a single `and` node with three children, never nested pairs.

**Example output:**

```typescript
parse('age > 18 AND status = "active"')

// Returns:
{
  success: true,
  ast: {
    type: "and",
    children: [
      {
        type: "comparison",
        field: "age",
        operator: ">",
        value: { type: "number", value: 18 }
      },
      {
        type: "comparison",
        field: "status",
        operator: "=",
        value: { type: "string", value: "active" }
      }
    ]
  }
}
```

## Performance

Recursive descent parser. ~9 KB minified, zero dependencies.

| Query complexity | Parse time | Throughput        |
| ---------------- | ---------- | ----------------- |
| Simple           | ~90-250ns  | 4-11M ops/sec     |
| Medium           | ~360-870ns | 1.1-2.8M ops/sec  |
| Complex          | ~0.9-1.5μs | 650K-1.1M ops/sec |

## License

MIT
