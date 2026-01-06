# Filtron

Let users filter your data with simple, readable expressions.

```
age > 18 AND status = "active"
```

Filtron parses human-friendly filter strings into structured queries you can use anywhere — SQL databases, in-memory arrays, or your own custom backend.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![CodSpeed](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://codspeed.io/jbergstroem/filtron)

## Why Filtron?

Building filter functionality is tedious. You need to:

- Parse user input safely (no "SQL injection")
- Handle different operators, boolean logic, nested conditions
- Generate the right output for your data layer

Filtron handles the hard parts. You get a well-tested parser that turns readable expressions into type-safe, structured queries.

Since filtering usually is a synchronous operation in real-time APIs, performance is one of its main priorities. We benchmark every change and continuously look for ways to improve it.

**Input:**

```
price < 100 AND category : ["electronics", "books"] AND inStock
```

**Output (SQL):**

```sql
WHERE (price < $1 AND category IN ($2, $3) AND inStock = $4)
-- params: [100, "electronics", "books", true]
```

**Output (JavaScript):**

```javascript
items.filter(item =>
  item.price < 100 &&
  ["electronics", "books"].includes(item.category) &&
  item.inStock
)
```

## Use Cases

- **Search UIs** — Let users type natural filter expressions instead of building complex form interfaces
- **API query parameters** — Accept `?filter=price < 50 AND rating >= 4` in your REST endpoints
- **Admin dashboards** — Give power users flexible filtering without writing raw SQL
- **Real-time streams** — Filter WebSocket or event data on the fly

## Installation

```bash
npm install @filtron/core

# Or directly add SQL or JavaScript helpers
npm install @filtron/sql   # For SQL WHERE clauses
npm install @filtron/js    # For in-memory array filtering
```

## Quick Start

### Parse a filter expression

```typescript
import { parse } from "@filtron/core";

const result = parse('age > 18 AND status = "active"');

if (result.success) {
  // result.ast contains the parsed query
} else {
  // result.error contains what went wrong
}
```

### Generate SQL

```typescript
import { parse } from "@filtron/core";
import { toSQL } from "@filtron/sql";

const result = parse('age > 18 AND status = "active"');

if (result.success) {
  const { sql, params } = toSQL(result.ast);
  // sql: "(age > $1 AND status = $2)"
  // params: [18, "active"]

  await db.query(`SELECT * FROM users WHERE ${sql}`, params);
}
```

### Filter JavaScript arrays

```typescript
import { parse } from "@filtron/core";
import { toFilter } from "@filtron/js";

const result = parse('age > 18 AND status = "active"');

if (result.success) {
  const filter = toFilter(result.ast);

  const users = [
    { name: "Alice", age: 25, status: "active" },
    { name: "Bob", age: 16, status: "active" },
  ];

  users.filter(filter);
  // => [{ name: "Alice", age: 25, status: "active" }]
}
```

## Syntax reference

Filtron supports a rich set of operators for building expressive queries:

### Comparisons

```
age > 18
age >= 21
price < 100
score <= 4.5
status = "active"
role != "guest"
```

### Boolean Logic

```
age > 18 AND verified
role = "admin" OR role = "moderator"
NOT suspended
(role = "admin" OR role = "mod") AND active
```

### Grouping with parentheses

Use parentheses to control precedence and group conditions:

```
(role = "admin" OR role = "moderator") AND active
((a AND b) OR (c AND d)) AND verified
```

### Field existence

Check if a field is present:

```
email?
profile EXISTS
```

### Contains (substring matching)

```
name ~ "john"
description ~ "sale"
```

### One-of (IN)

Match against a list of values:

```
status : ["pending", "approved", "rejected"]
category : ["books", "electronics"]
```

### Ranges

```
age = 18..65
temperature = -10..20
```

### Nested fields

```
user.profile.age >= 18
order.shipping.address.country = "PT"
```

### Operators

| Operator             | Meaning       | Example                             |
| -------------------- | ------------- | ----------------------------------- |
| `=`, `:`             | Equal         | `status = "active"`                 |
| `!=`, `!:`           | Not equal     | `role != "guest"`                   |
| `>`, `>=`, `<`, `<=` | Comparison    | `age >= 18`                         |
| `~`                  | Contains      | `name ~ "john"`                     |
| `?`, `EXISTS`        | Field exists  | `email?`                            |
| `..`                 | Range         | `age = 18..65`                      |
| `: [...]`            | One of        | `status : ["pending", "active"]`    |
| `AND`, `OR`, `NOT`   | Boolean logic | `verified AND (admin OR moderator)` |

## Error handling

Use `parseOrThrow` if you prefer exceptions over result objects:

```typescript
import { parseOrThrow, FiltronParseError } from "@filtron/core";

try {
  const ast = parseOrThrow('age > 18 AND status = "active"');
} catch (error) {
  if (error instanceof FiltronParseError) {
    console.error(error.message, error.position);  // error description and position
  }
}
```

## Packages

Filtron is a monorepo with focused packages:

| Package                                    | Version                                                 | Bundle Size                                                                    | Description                                    |
| ------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------- |
| [@filtron/core](./packages/core)           | ![npm](https://img.shields.io/npm/v/@filtron/core)      | ![npm bundle size](https://img.shields.io/bundlephobia/min/@filtron/core)      | Core parser — parses expressions into an AST   |
| [@filtron/sql](./packages/sql)             | ![npm](https://img.shields.io/npm/v/@filtron/sql)       | ![npm bundle size](https://img.shields.io/bundlephobia/min/@filtron/sql)       | Generates parameterized SQL WHERE clauses      |
| [@filtron/js](./packages/js)               | ![npm](https://img.shields.io/npm/v/@filtron/js)        | ![npm bundle size](https://img.shields.io/bundlephobia/min/@filtron/js)        | Creates filter functions for JavaScript arrays |
| [@filtron/benchmark](./packages/benchmark) | ![npm](https://img.shields.io/npm/v/@filtron/benchmark) | ![npm bundle size](https://img.shields.io/bundlephobia/min/@filtron/benchmark) | Benchmark utilities and performance tests      |

## Advanced

### AST structure

The parser produces a typed AST you can traverse for custom use cases:

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

Full TypeScript types are exported for building custom AST consumers.

## Performance

Filtron currently uses a hand-written lexer and recursive descent parser and has no runtime dependencies (~9 KB minified). We continuously monitor performance with [CodSpeed](https://codspeed.io/) to test out new optimizations.

The AST syntax is seen as stable and any changes follows strict semantic versioning (we for instance switched from a PEG parser to a recursive descent parser after the initial release).

| Query Complexity | Parse Time | Throughput        |
| ---------------- | ---------- | ----------------- |
| Simple           | ~90-250ns  | 4-11M ops/sec     |
| Medium           | ~360-870ns | 1.1-2.8M ops/sec  |
| Complex          | ~0.9-1.5μs | 650K-1.1M ops/sec |

The helper packages add minimal overhead:

| Package      | Additional Overhead |
| ------------ | ------------------- |
| @filtron/js  | ~0.2μs              |
| @filtron/sql | ~0.3μs              |

Run benchmarks locally: `bun run bench` in each package directory.

## Contributing

See the [Contributing Guide](./CONTRIBUTING.md) for development setup and guidelines.

## Acknowledgments

The query syntax was strongly inspired by [dumbql](https://github.com/tomakado/dumbql).

## License

MIT — See [LICENSE](./LICENSE)
