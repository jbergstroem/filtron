# @filtron/core

Fast, type-safe query language parser for filtering data in real-time APIs.

[![npm version](https://img.shields.io/npm/v/@filtron/core.svg)](https://www.npmjs.com/package/@filtron/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

## Features

- **Fast**: High-performance recursive descent parser — 250ns-3μs per query
- **Small**: ~8 KB minified, zero runtime dependencies
- **Type-safe**: Full TypeScript support with discriminated union AST

## Installation

```bash
bun add @filtron/core
# or
npm install @filtron/core
```

## Quick Start

```typescript
import { parse } from "@filtron/core";

const result = parse('age > 18 AND status = "active"');

if (result.success) {
  console.log(result.ast);
  // Use AST to build SQL, filter data, etc.
} else {
  console.error(result.error);
}
```

..or use `parseOrThrow` for try/catch style error handling:

```typescript
import { parseOrThrow } from "@filtron/core";

try {
  const ast = parseOrThrow('age > 18 AND status = "active"');
  console.log(ast);
  // Use AST to build SQL, filter data, etc.
} catch (error) {
  console.error(error.message);
}
```

## Syntax

```typescript
// Comparison operators
parse("age > 18");
parse('status = "active"');
parse("score >= 4.5");

// Boolean operators
parse("age > 18 AND verified");
parse('role = "admin" OR role = "moderator"');
parse("NOT suspended");

// Field existence
parse("email?");
parse("name EXISTS");

// One-of expressions
parse('status : ["pending", "approved", "active"]');

// Range expressions
parse("age = 18..65");
parse("price = 9.99..99.99");

// Complex queries
parse('(role = "admin" OR role = "mod") AND status = "active"');

// Nested fields
parse("user.profile.age >= 18");
```

## Operators

| Operator             | Meaning       | Example             |
| -------------------- | ------------- | ------------------- |
| `=`, `:`             | Equal         | `status = "active"` |
| `!=`, `!:`           | Not equal     | `role != "guest"`   |
| `>`, `>=`, `<`, `<=` | Comparison    | `age >= 18`         |
| `~`                  | Contains      | `name ~ "john"`     |
| `?`, `EXISTS`        | Field exists  | `email?`            |
| `..`                 | Range         | `age = 18..65`      |
| `AND`, `OR`, `NOT`   | Boolean logic | `a AND b OR c`      |

## AST Structure

```typescript
parse('age > 18 AND status = "active"')

// Returns:
{
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
```

## TypeScript

Full type definitions included:

```typescript
import type {
  ParseResult,
  ASTNode,
  ComparisonExpression,
  // ... all types exported
} from "@filtron/core";

function handleAST(node: ASTNode) {
  switch (node.type) {
    case "comparison":
      // TypeScript knows node.field, node.operator, node.value exist
      break;
    case "and":
      // TypeScript knows node.left, node.right exist
      break;
    // ... fully typed
  }
}
```

## Use Cases

- **SQL Generation**: Build WHERE clauses from user queries
- **In-Memory Filtering**: Filter arrays/collections with complex logic
- **Search APIs**: Parse user search filters safely
- **Access Control**: Define permission rules with queries

## Performance

Filtron uses a hand-written recursive descent parser optimized for speed:

| Query Type | Parse Time    | Throughput       |
| ---------- | ------------- | ---------------- |
| Simple     | ~250-350ns    | 3-4M ops/sec     |
| Medium     | ~600-1700ns   | 600K-1.6M ops/sec |
| Complex    | ~1.5-3μs      | 350-700K ops/sec |

Run benchmarks: `bun run bench`

## Documentation

- **[Contributing Guide](../../CONTRIBUTING.md)** - Development setup and workflow

## Inspiration

The Filtron query language syntax was strongly inspired by [dumbql](https://github.com/tomakado/dumbql).
