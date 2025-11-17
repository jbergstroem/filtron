# @filtron/sql

SQL WHERE clause generator for [Filtron](https://github.com/jbergstroem/filtron) AST with parameterized queries.

Convert Filtron query language AST to safe, parameterized SQL WHERE clauses that prevent SQL injection.

## Features

- **Safe**: Parameterized queries prevent SQL injection
- **Flexible**: Support for PostgreSQL/DuckDB (`$1`), MySQL/SQLite (`?`) parameter styles
- **Type-safe**: Full TypeScript support
- **Customizable**: Map field names to table columns

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

`@filtron/sql` defaults to numbered placeholders: `$1`, `$2`, `$3`, etc. This
is suitable for PostgreSQL, DuckDB and others. You can alternatively switch to
question mark placeholders if you are using MySQL or SQLite:

```typescript
const { sql, params } = toSQL(ast);
// sql: "age > $1 AND status = $2"
// params: [18, "active"]

// PostgreSQL
await client.query(`SELECT * FROM users WHERE ${sql}`, params);
```

vs:

```typescript
const { sql, params } = toSQL(ast, {
  parameterStyle: "question",
});
// sql: "age > ? AND status = ?"
// params: [18, "active"]

// SQLite
db.all(`SELECT * FROM users WHERE ${sql}`, params, callback);
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

## Performance

**SQL conversion adds minimal overhead to query parsing.**

```bash
# Run this while developing to maintain the performance baseline
bun run bench
# Quick summary showing overhead analysis of using query -> AST -> SQL
bun run overhead.ts
```

## Security

**This library generates parameterized queries to prevent SQL injection.**

```typescript
const { sql, params } = toSQL(ast);
db.query(`SELECT * FROM users WHERE ${sql}`, params);
// SQL: SELECT * FROM users WHERE name = $1
// Params: ["admin' OR '1'='1"]
```

**Never concatenate values directly**:

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
