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
  - `parameterStyle`: `'numbered'` (default) or `'question'` - Parameter placeholder style
  - `fieldMapper`: `(field: string) => string` - Field transformation
  - `valueMapper`: `(value: string | number | boolean) => string | number | boolean` - Value transformation
  - `startIndex`: `number` (default: 1) - Starting parameter index for numbered parameters

**Returns:** `SQLResult`

- `sql` (string): SQL WHERE clause (without the WHERE keyword)
- `params` (unknown[]): Array of parameter values in order

### Helper Functions

A set of common functions that can be used in conjunction with `fieldMapper` and `valueMapper`.

#### `contains(value)`

Wraps a value with `%` wildcards for substring matching. Automatically escapes special LIKE characters.

```typescript
toSQL(ast, { valueMapper: contains });
// "foo" → "%foo%"
```

#### `escapeLike(value)`

Escapes LIKE special characters (`%`, `_`, `\`) in a string value. Use this to prevent LIKE injection.

The `contains`, `prefix`, and `suffix` helpers use this internally. You'll typically use `escapeLike` when building custom `valueMapper` functions.

```typescript
escapeLike("foo%bar");
// "foo\\%bar"
```

#### `prefix(value)`

Adds trailing `%` wildcard for "starts with" matching. Automatically escapes special LIKE characters.

```typescript
toSQL(ast, { valueMapper: prefix });
// "admin" → "admin%"
```

#### `suffix(value)`

Adds leading `%` wildcard for "ends with" matching. Automatically escapes special LIKE characters.

```typescript
toSQL(ast, { valueMapper: suffix });
// ".pdf" → "%.pdf"
```

## Parameter Styles

`@filtron/sql` defaults to numbered placeholders: `$1`, `$2`, `$3`, etc. This
is suitable for PostgreSQL, DuckDB and others. You can alternatively switch to
question mark placeholders if you are using MySQL or SQLite.

```typescript
const { sql, params } = toSQL(ast, {
  // use this for SQLite/MySQL
  // parameterStyle: "question"
});
// sql: "age > $1 AND status = $2"
// params: [18, "active"]

await db.query(`SELECT * FROM users WHERE ${sql}`, params);
```

## Field Mapping

Field mapping is useful when you want to map fields
to database column names or handle field values in a
specific way.

```typescript
const { sql, params } = toSQL(ast, {
  fieldMapper: (field) => `users.${field}`,
});
// Input:  age > 18
// Output: users.age > $1
```

## Value Mapping

The `valueMapper` option allows you to transform values before they're added to the parameter list. This is particularly useful with the LIKE operator (`~`) to add wildcards or escape special characters.

```typescript
import { parse } from "@filtron/core";
import { toSQL, contains } from "@filtron/sql";

const ast1 = parse('name ~ "john"');
const result1 = toSQL(ast1, { valueMapper: contains });
// sql: "name LIKE $1"
// params: ["%john%"]
```

### Custom Value Mapping

```typescript
// Custom mapper: uppercase all string values
const { sql, params } = toSQL(ast, {
  valueMapper: (value) => {
    return typeof value === "string" ? value.toUpperCase() : value;
  },
});
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
