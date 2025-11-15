# @filtron/sql

SQL WHERE clause generator for [Filtron](https://github.com/jbergstroem/filtron) AST with parameterized queries.

Convert Filtron query language AST to safe, parameterized SQL WHERE clauses that prevent SQL injection.

## Features

- **Safe**: Parameterized queries prevent SQL injection
- **Flexible**: Support for PostgreSQL/DuckDB ($1), MySQL/SQLite/DuckDB (?) parameter styles
- **Type-safe**: Full TypeScript support
- **Customizable**: Map field names to table columns
- **Zero dependencies**: Only requires `filtron` peer dependency

## Installation

```bash
bun add @filtron/core @filtron/sql
# or
npm install @filtron/core @filtron/sql
```

## Quick Start

```typescript
import { parse } from "@filtron/core";
import { toSQL } from "@filtron/sql";

// Parse a query
const result = parse('age > 18 AND status = "active"');

if (result.success) {
  // Convert to SQL
  const { sql, params } = toSQL(result.ast);

  console.log(sql); // "(age > $1 AND status = $2)"
  console.log(params); // [18, "active"]

  // Use with your database
  const users = await db.query(`SELECT * FROM users WHERE ${sql}`, params);
}
```

## API

### `toSQL(ast, options?)`

Converts a Filtron AST node to a parameterized SQL WHERE clause.

**Parameters:**

- `ast` (ASTNode): The Filtron AST to convert
- `options` (SQLOptions, optional): Generation options

**Returns:** `SQLResult`

- `sql` (string): SQL WHERE clause (without the WHERE keyword)
- `params` (unknown[]): Array of parameter values in order

## Parameter Styles

### PostgreSQL/DuckDB Style (Default)

Uses numbered placeholders: `$1`, `$2`, `$3`, etc.

```typescript
const { sql, params } = toSQL(ast);
// sql: "age > $1 AND status = $2"
// params: [18, "active"]

// PostgreSQL
await client.query(`SELECT * FROM users WHERE ${sql}`, params);

// DuckDB
await db.all(`SELECT * FROM users WHERE ${sql}`, ...params);
```

### MySQL/SQLite/DuckDB Style

Uses question mark placeholders: `?`, `?`, `?`, etc.

```typescript
const { sql, params } = toSQL(ast, {
  parameterStyle: "question",
});
// sql: "age > ? AND status = ?"
// params: [18, "active"]

// MySQL
await connection.query(`SELECT * FROM users WHERE ${sql}`, params);

// SQLite
db.all(`SELECT * FROM users WHERE ${sql}`, params, callback);

// DuckDB (also supports this style)
await db.all(`SELECT * FROM users WHERE ${sql}`, ...params);
```

## Field Mapping

Map Filtron field names to database column names:

```typescript
const { sql, params } = toSQL(ast, {
  fieldMapper: (field) => `users.${field}`,
});
// Input:  age > 18
// Output: users.age > $1
```

### Escaping Field Names

```typescript
const { sql, params } = toSQL(ast, {
  fieldMapper: (field) => `"${field}"`,
});
// Input:  user-name = "john"
// Output: "user-name" = $1
```

### Table Aliases

```typescript
const { sql, params } = toSQL(ast, {
  fieldMapper: (field) => `u.${field}`,
});
// Input:  status = "active" AND verified
// Output: (u.status = $1 AND u.verified = $2)
```

## Custom Start Index

Useful when combining multiple queries:

```typescript
// First query uses $1, $2
const query1 = toSQL(ast1);

// Second query starts at $3
const query2 = toSQL(ast2, {
  startIndex: query1.params.length + 1,
});

const sql = `${query1.sql} OR ${query2.sql}`;
const params = [...query1.params, ...query2.params];
```

## Operator Mapping

| Filtron Operator | SQL Operator |
| ---------------- | ------------ |
| `=`, `:`         | `=`          |
| `!=`             | `!=`         |
| `>`              | `>`          |
| `>=`             | `>=`         |
| `<`              | `<`          |
| `<=`             | `<=`         |
| `~`              | `LIKE`       |

## Expression Types

### Comparison

```typescript
// Filtron: age > 18
// SQL: age > $1
// Params: [18]
```

### Boolean Logic

```typescript
// Filtron: age > 18 AND status = "active"
// SQL: (age > $1 AND status = $2)
// Params: [18, "active"]

// Filtron: role = "admin" OR role = "mod"
// SQL: (role = $1 OR role = $2)
// Params: ["admin", "mod"]

// Filtron: NOT suspended
// SQL: NOT (suspended = $1)
// Params: [true]
```

### One-of (IN clause)

```typescript
// Filtron: status : ["pending", "approved", "active"]
// SQL: status IN ($1, $2, $3)
// Params: ["pending", "approved", "active"]

// Filtron: role !: ["guest", "banned"]
// SQL: role NOT IN ($1, $2)
// Params: ["guest", "banned"]
```

### Field Exists

```typescript
// Filtron: email?
// SQL: email IS NOT NULL
// Params: []
```

### Boolean Field

```typescript
// Filtron: verified
// SQL: verified = $1
// Params: [true]
```

## Real-world Examples

### User Filtering

```typescript
import { parseOrThrow } from "@filtron/core";
import { toSQL } from "@filtron/sql";

// Parse user input
const query = 'age >= 18 AND verified AND role : ["user", "premium"]';
const ast = parseOrThrow(query);

// Generate SQL
const { sql, params } = toSQL(ast, {
  fieldMapper: (field) => `users.${field}`,
});

// Execute query
const users = await db.query(`SELECT * FROM users WHERE ${sql}`, params);
```

### Product Search

```typescript
const query =
  'price <= 100 AND name ~ "laptop" AND category : ["electronics", "computers"]';
const ast = parseOrThrow(query);

const { sql, params } = toSQL(ast, {
  parameterStyle: "question",
  fieldMapper: (field) => `products.${field}`,
});

const products = await db.all(
  `SELECT * FROM products WHERE ${sql} ORDER BY price`,
  params,
);
```

### Access Control

```typescript
const query = '(role = "admin" OR role = "moderator") AND NOT suspended';
const ast = parseOrThrow(query);

const { sql, params } = toSQL(ast);

const hasAccess = await db.get(
  `SELECT COUNT(*) as count FROM users WHERE id = ? AND ${sql}`,
  [userId, ...params],
);

return hasAccess.count > 0;
```

### DuckDB - Analytical Queries

```typescript
import { parseOrThrow } from "@filtron/core";
import { toSQL } from "@filtron/sql";

// Query Parquet files directly
const query = 'region : ["US", "EU"] AND revenue > 10000';
const ast = parseOrThrow(query);

const { sql, params } = toSQL(ast, {
  parameterStyle: "numbered", // DuckDB supports both $1 and ?
});

// DuckDB excels at analytical queries
const results = await db.all(
  `
  SELECT 
    region, 
    SUM(revenue) as total_revenue,
    COUNT(*) as transaction_count
  FROM read_parquet('sales_*.parquet')
  WHERE ${sql}
  GROUP BY region
  ORDER BY total_revenue DESC
`,
  ...params,
);
```

### DuckDB - Time Series Filtering

```typescript
const query = 'sensor_type = "temperature" AND value > 25';
const ast = parseOrThrow(query);

const { sql, params } = toSQL(ast, {
  parameterStyle: "numbered",
  fieldMapper: (field) => `"${field}"`, // Quote field names
});

// Time-series aggregation
const timeSeries = await db.all(
  `
  SELECT 
    time_bucket('1 hour', timestamp) as hour,
    AVG(value) as avg_value,
    MAX(value) as max_value
  FROM sensor_data
  WHERE ${sql}
  GROUP BY hour
  ORDER BY hour
`,
  ...params,
);
```

## Performance

**SQL conversion adds minimal overhead to query parsing.**

### Running Benchmarks

Comprehensive benchmark suite with detailed metrics:

```bash
bun run bench
```

Quick summary showing overhead analysis:

```bash
bun run overhead.ts
```

### Key Metrics

- **SQL Conversion Overhead**: ~0.1-0.2μs per query
- **Impact**: Less than 1% of parse time
- **Throughput**: 11,000+ queries/sec (parse + SQL generation)
- **Memory**: Minimal allocations, efficient GC pressure

### Benchmark Results

```
Simple queries:      26-33 μs  (parse + SQL)
Complex queries:     60-130 μs (parse + SQL)
SQL conversion only: 30-200 ns (isolated)
```

The overhead of SQL conversion is negligible compared to parsing, making it suitable for real-time API usage where every request may involve parsing and converting user filters.

## Security

**This library generates parameterized queries to prevent SQL injection.**

✅ **Safe** - Values are passed as parameters:

```typescript
const { sql, params } = toSQL(ast);
db.query(`SELECT * FROM users WHERE ${sql}`, params);
// SQL: SELECT * FROM users WHERE name = $1
// Params: ["admin' OR '1'='1"]
```

❌ **Unsafe** - Never concatenate values directly:

```typescript
// DON'T DO THIS!
const unsafeSQL = `SELECT * FROM users WHERE name = '${userInput}'`;
```

**Note:** Field names from the `fieldMapper` are **not** parameterized. Ensure field names come from trusted sources or validate them before use.

## TypeScript

Full type definitions included:

```typescript
import type { SQLResult, SQLOptions } from "@filtron/sql";

const options: SQLOptions = {
  parameterStyle: "numbered",
  fieldMapper: (field) => `t.${field}`,
  startIndex: 1,
};

const result: SQLResult = toSQL(ast, options);
// result.sql: string
// result.params: unknown[]
```

## License

MIT - See [LICENSE](../../LICENSE)

## Links

- **Filtron**: https://github.com/jbergstroem/filtron
- **GitHub**: https://github.com/jbergstroem/filtron/tree/main/packages/sql
- **npm**: https://www.npmjs.com/package/@filtron/sql
