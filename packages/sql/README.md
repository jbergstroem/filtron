# @filtron/sql

Convert Filtron AST to parameterized SQL WHERE clauses.

[![npm version](https://img.shields.io/npm/v/@filtron/sql.svg)](https://www.npmjs.com/package/@filtron/sql)
[![npm bundle size](https://img.shields.io/bundlephobia/min/%40filtron%2Fsql)](https://bundlephobia.com/package/@filtron/sql)
[![codecov](https://codecov.io/gh/jbergstroem/filtron/graph/badge.svg?token=FXIWJKJ9RI&component=sql)](https://codecov.io/gh/jbergstroem/filtron)

## Installation

```bash
npm install @filtron/sql
```

## Usage

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

## API

### `toSQL(ast, options?): SQLResult`

Converts a Filtron AST to a parameterized SQL WHERE clause.

**Returns:**

```typescript
interface SQLResult {
  sql: string;      // The WHERE clause (without "WHERE" keyword)
  params: unknown[]; // Parameter values in order
}
```

#### Options

| Option           | Type                          | Default      | Description                              |
| ---------------- | ----------------------------- | ------------ | ---------------------------------------- |
| `parameterStyle` | `"numbered"` \| `"question"`  | `"numbered"` | Placeholder format                       |
| `fieldMapper`    | `(field: string) => string`   | `undefined`  | Transform field names to column names    |
| `valueMapper`    | `(value: unknown) => unknown` | `undefined`  | Transform values before parameterization |
| `startIndex`     | `number`                      | `1`          | Starting index for numbered placeholders |

#### Parameter styles

**Numbered (`$1`, `$2`, ...)** — PostgreSQL, CockroachDB:

```typescript
const { sql, params } = toSQL(ast);
// sql: "(age > $1 AND status = $2)"
```

**Question marks (`?`, `?`, ...)** — MariaDB, SQLite, DuckDB:

```typescript
const { sql, params } = toSQL(ast, {
  parameterStyle: "question",
});
// sql: "(age > ? AND status = ?)"
```

#### Examples

**Custom field mapping:**

```typescript
const { sql, params } = toSQL(ast, {
  fieldMapper: (field) => `users.${field}`,
});
// "age > 18" becomes "users.age > $1"
```

**Table-qualified columns:**

```typescript
const { sql, params } = toSQL(ast, {
  fieldMapper: (field) => `"${field}"`,  // Quote column names
});
```

**Start index (for combining queries):**

```typescript
const { sql, params } = toSQL(ast, {
  startIndex: 3,
});
// Placeholders start at $3
```

### LIKE helpers

Helper functions for the contains operator (`~`):

```typescript
import { toSQL, contains, prefix, suffix, escapeLike } from "@filtron/sql";
```

| Function     | Input   | Output    | Use Case             |
| ------------ | ------- | --------- | -------------------- |
| `contains`   | `"foo"` | `"%foo%"` | Substring match      |
| `prefix`     | `"foo"` | `"foo%"`  | Starts with          |
| `suffix`     | `"foo"` | `"%foo"`  | Ends with            |
| `escapeLike` | `"a%b"` | `"a\\%b"` | Escape special chars |

**Usage with valueMapper:**

```typescript
const { sql, params } = toSQL(ast, {
  valueMapper: contains,
});
// Query "name ~ 'john'" produces params: ["%john%"]
```

## Security

All queries are parameterized to prevent SQL injection:

```typescript
// User input with SQL injection attempt
const result = parse('name = "admin\' OR \'1\'=\'1"');
const { sql, params } = toSQL(result.ast);

// sql: "(name = $1)"
// params: ["admin' OR '1'='1"]  — treated as literal string value
```

Never interpolate user input directly into SQL. Always use the `params` array with your database driver's parameterized query support.

## License

MIT
