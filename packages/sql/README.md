# @filtron/sql

SQL WHERE clause generator for [Filtron](https://github.com/jbergstroem/filtron) AST with parameterized queries.

![npm version](https://img.shields.io/npm/v/@filtron/sql.svg)
![npm bundle size](https://img.shields.io/bundlephobia/min/%40filtron%2Fsql)
![codecov](https://codecov.io/gh/jbergstroem/filtron/graph/badge.svg?token=FXIWJKJ9RI&component=sql)

## Installation

```bash
bun add @filtron/sql
```

## Quick Start

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

## API

### `toSQL(ast, options?)`

Converts a Filtron AST to a parameterized SQL WHERE clause.

**Options:**

| Option           | Type                         | Description                                  |
| ---------------- | ---------------------------- | -------------------------------------------- |
| `parameterStyle` | `'numbered'` \| `'question'` | Placeholder style: `$1` (default) or `?`     |
| `fieldMapper`    | `(field) => string`          | Transform field names to column names        |
| `valueMapper`    | `(value) => value`           | Transform values (useful for LIKE wildcards) |
| `startIndex`     | `number`                     | Starting parameter index (default: `1`)      |

```typescript
const { sql, params } = toSQL(ast, {
  parameterStyle: "question", // for MySQL/SQLite
  fieldMapper: (field) => `users.${field}`,
});
```

### Helper Functions

Helpers for use with `valueMapper` when using the LIKE operator (`~`):

```typescript
import { toSQL, contains, prefix, suffix, escapeLike } from "@filtron/sql";

// contains("foo") → "%foo%"
// prefix("foo")   → "foo%"
// suffix("foo")   → "%foo"
// escapeLike("foo%bar") → "foo\\%bar"

const { sql, params } = toSQL(ast, { valueMapper: contains });
```

## Security

This library generates parameterized queries to prevent SQL injection:

```typescript
const { sql, params } = toSQL(ast);
db.query(`SELECT * FROM users WHERE ${sql}`, params);
// Params: ["admin' OR '1'='1"] - safely escaped
```
