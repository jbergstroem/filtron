# Filtron

Fast, type-safe query language parser for filtering data in real-time APIs. Built with [Ohm.js](https://ohmjs.org/).

[![npm version](https://img.shields.io/npm/v/@filtron/core.svg)](https://www.npmjs.com/package/@filtron/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

## Features

- **Fast**: ~50μs parse time, 18K+ parses/sec (benchmarked on M2 Max)
- **Small**: 15 KB minified, 56 KB installed
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

## Parser Options

Both `parse()` and `parseOrThrow()` accept an optional second parameter for configuration:

```typescript
interface ParseOptions {
  fastPath?: boolean; // Enable fast-path optimization (default: true)
}
```

### Fast Path Optimization

The `fastPath` option enables optimized regex-based parsing for simple queries, bypassing the full grammar parser for significant performance gains. **It is enabled by default** and automatically falls back to the full parser when patterns don't match, so there's no downside to keeping it enabled.

**When to keep enabled (`fastPath: true`, default):**

- Most use cases - fast-path automatically handles both simple and complex queries
- Simple comparisons: `field = value`, `age > 18` (uses fast-path)
- Simple AND expressions: `field1 = 1 AND field2 = 2` (uses fast-path)
- Boolean fields: `verified`, `active` (uses fast-path)
- Complex queries: automatically falls back to full parser

**When to disable (`fastPath: false`):**

- Rare cases where you know all queries are complex and want to skip the fast-path check entirely
- Benchmarking or profiling the full parser specifically

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

## Packages

### [@filtron/sql](./packages/sql)

SQL WHERE clause generator with parameterized queries for safe database filtering.

```typescript
import { parse } from "@filtron/core";
import { toSQL } from "@filtron/sql";

const result = parse('age > 18 AND status = "active"');
if (result.success) {
  const { sql, params } = toSQL(result.ast);
  // sql: "(age > $1 AND status = $2)"
  // params: [18, "active"]

  const users = await db.query(`SELECT * FROM users WHERE ${sql}`, params);
}
```

**Features:**

- Parameterized queries (PostgreSQL/DuckDB `$1`, MySQL/SQLite/DuckDB `?`)
- Field name mapping and escaping
- Zero SQL injection risk
- Full TypeScript support

See the [@filtron/sql README](./packages/sql/README.md) for full documentation.

## Performance

```
Parse Time:       ~20μs per query (simple queries with fast-path, default)
                  ~50μs per query (complex queries or fast-path disabled)
Throughput:       ~35,000 parses/sec (simple queries with fast-path, default)
                  18,755 parses/sec (complex queries or fast-path disabled)
Startup:          <1ms with pre-compiled grammar
Memory:           Efficient GC, minimal allocation
```

Run benchmarks: `bun run bench`

**Note:** Fast-path optimization is enabled by default and provides 2-3x performance improvement for simple queries. See [Parser Options](#parser-options) for details.

## Documentation

- **[Contributing Guide](./CONTRIBUTING.md)** - Development setup and workflow

## Inspiration

The Filtron query language syntax was strongly inspired by [dumbql](https://github.com/tomakado/dumbql).
