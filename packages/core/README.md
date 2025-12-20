# @filtron/core

A fast, human-friendly filter language designed for real-time APIs. Parses expressions like `age > 18 AND verified` into a type-safe AST.

![npm version](https://img.shields.io/npm/v/@filtron/core.svg)
![npm bundle size](https://img.shields.io/bundlephobia/min/%40filtron%2Fcore)
![codecov](https://codecov.io/gh/jbergstroem/filtron/graph/badge.svg?token=FXIWJKJ9RI&component=core)

## Features

- **Fast**: High-performance recursive descent parser — 90ns-1.5μs per query
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

| Query Type | Parse Time | Throughput        |
| ---------- | ---------- | ----------------- |
| Simple     | ~90-250ns  | 4-11M ops/sec     |
| Medium     | ~360-870ns | 1.1-2.8M ops/sec  |
| Complex    | ~0.9-1.5μs | 650K-1.1M ops/sec |

Run benchmarks: `bun run bench`

## Documentation

- **[Contributing Guide](../../CONTRIBUTING.md)** - Development setup and workflow

## Inspiration

The Filtron query language syntax was strongly inspired by [dumbql](https://github.com/tomakado/dumbql).
