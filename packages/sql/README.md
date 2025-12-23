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

| Function     | Input   | Output    | Use case             |
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

## Performance

For APIs with repeated filter queries, cache parsed results to avoid redundant parsing:

```typescript
const cache = new Map<string, SQLResult>();

function getFilterSQL(filter: string): SQLResult | null {
  const cached = cache.get(filter);
  if (cached) return cached;

  const result = parse(filter);
  if (!result.success) return null;

  const sql = toSQL(result.ast, { parameterStyle: "question" });
  cache.set(filter, sql);
  return sql;
}
```

Consider using an LRU cache with a size limit for production:

```typescript
// https://github.com/isaacs/node-lru-cache
import { LRUCache } from "lru-cache";

const cache = new LRUCache<string, SQLResult>({ max: 1000 });
```

Caching is effective when:

- Users frequently repeat the same filter queries
- Filter expressions are complex (nested `AND`/`OR` conditions)

For simple queries or unique filters, caching overhead is not worthwhile.

In practice, caching the database query results at http level is often more effective than caching parsed SQL alone — the database query is typically orders of magnitude slower than processing the Filtron query.

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
