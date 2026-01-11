# @filtron/core

A fast, human-friendly filter language for JavaScript and TypeScript. Parse expressions like `age > 18 AND verified` into a type-safe AST.

[![npm version](https://img.shields.io/npm/v/@filtron/core.svg)](https://www.npmjs.com/package/@filtron/core)
[![npm bundle size](https://img.shields.io/bundlephobia/min/%40filtron%2Fcore)](https://bundlephobia.com/package/@filtron/core)
[![codecov](https://codecov.io/gh/jbergstroem/filtron/graph/badge.svg?token=FXIWJKJ9RI&component=core)](https://codecov.io/gh/jbergstroem/filtron)

## Why Filtron?

Let users filter data with readable expressions instead of building complex query UIs:

```
price < 100 AND category : ["electronics", "books"] AND inStock
```

Filtron parses these expressions into a structured AST you can use to generate SQL, filter arrays, or build custom query backends — safely, with no risk of injection attacks.

**Use cases:** Search UIs, API query parameters, admin dashboards, real-time data filtering.

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
	console.error(result.error);
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
| `..`                 | Range         | `age = 18..65`        |
| `: [...]`            | One of        | `status : ["a", "b"]` |
| `AND`, `OR`, `NOT`   | Boolean logic | `a AND (b OR c)`      |

## API

### `parse(input: string): ParseResult`

Parses a filter expression and returns a result object.

```typescript
const result = parse("age > 18");

if (result.success) {
	result.ast; // ASTNode
} else {
	result.error; // string - error message
	result.position; // number - position in input where error occurred
}
```

### `parseOrThrow(input: string): ASTNode`

Parses a filter expression, throwing `FiltronParseError` on invalid input.

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

## Types

All AST types are exported for building custom consumers:

```typescript
import {
	FiltronParseError, // Error class thrown by parseOrThrow
	type ParseResult,
	type ASTNode,
	type AndExpression,
	type OrExpression,
	type NotExpression,
	type ComparisonExpression,
	type ExistsExpression,
	type BooleanFieldExpression,
	type OneOfExpression,
	type NotOneOfExpression,
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
import { Lexer, LexerError } from "@filtron/core";
import type { Token, TokenType, StringToken, NumberToken, BooleanToken } from "@filtron/core";
```

### AST structure

| Node Type      | Fields                       | Example input          |
| -------------- | ---------------------------- | ---------------------- |
| `and`          | `left`, `right`              | `a AND b`              |
| `or`           | `left`, `right`              | `a OR b`               |
| `not`          | `expression`                 | `NOT a`                |
| `comparison`   | `field`, `operator`, `value` | `age > 18`             |
| `exists`       | `field`                      | `email?`               |
| `booleanField` | `field`                      | `verified`             |
| `oneOf`        | `field`, `values`            | `status : ["a", "b"]`  |
| `notOneOf`     | `field`, `values`            | `status !: ["a", "b"]` |
| `range`        | `field`, `min`, `max`        | `age = 18..65`         |

**Example output:**

```typescript
parse('age > 18 AND status = "active"')

// Returns:
{
  success: true,
  ast: {
    type: "and",
    left: {
      type: "comparison",
      field: "age",
      operator: ">",
      value: { type: "number", value: 18 }
    },
    right: {
      type: "comparison",
      field: "status",
      operator: "=",
      value: { type: "string", value: "active" }
    }
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
