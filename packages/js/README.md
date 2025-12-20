# @filtron/js

Filtron helper: transform filter expressions into JavaScript predicates for `Array.filter()`.

![npm version](https://img.shields.io/npm/v/@filtron/js.svg)
![npm bundle size](https://img.shields.io/bundlephobia/min/%40filtron%2Fjs)
![codecov](https://codecov.io/gh/jbergstroem/filtron/graph/badge.svg?token=FXIWJKJ9RI&component=js)

## Installation

```bash
bun add @filtron/js
# or
npm install @filtron/js
```

## Quick Start

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

  const filtered = users.filter(filter);
  // [{ name: "Alice", age: 25, status: "active" }]
}
```

## API

### `toFilter(ast, options?)`

Converts a Filtron AST to a predicate function for use with `Array.filter()`.

**Options:**

| Option            | Type                      | Description                                             |
| ----------------- | ------------------------- | ------------------------------------------------------- |
| `allowedFields`   | `string[]`                | Restrict queryable fields (throws if field not in list) |
| `fieldAccessor`   | `(obj, field) => unknown` | Custom field value accessor                             |
| `caseInsensitive` | `boolean`                 | Case-insensitive string comparisons (default: `false`)  |
| `fieldMapping`    | `Record<string, string>`  | Map query field names to object property names          |

```typescript
const filter = toFilter(ast, {
  allowedFields: ["name", "email", "age"],
  caseInsensitive: true,
});
```

### `nestedAccessor(separator?)`

Creates a field accessor for dot-notation nested properties.

```typescript
import { toFilter, nestedAccessor } from "@filtron/js";

const filter = toFilter(ast, {
  fieldAccessor: nestedAccessor(),
});

// Query: "user.profile.age > 18"
// Matches: { user: { profile: { age: 25 } } }
```

## Advanced Usage

### Field Mapping

Map query field names to different object property names. This is useful when you want to expose a different API in your queries than your internal data structure:

```typescript
import { parse } from "@filtron/core";
import { toFilter } from "@filtron/js";

const result = parse('email = "user@example.com" AND age > 18');

if (result.success) {
  const filter = toFilter(result.ast, {
    fieldMapping: {
      email: "emailAddress",
      age: "userAge",
    },
  });

  const users = [
    { emailAddress: "user@example.com", userAge: 25 },
    { emailAddress: "other@example.com", userAge: 16 },
  ];

  const filtered = users.filter(filter);
  // [{ emailAddress: "user@example.com", userAge: 25 }]
}
```

Field mapping works with all expression types and can be combined with other options:

```typescript
const filter = toFilter(ast, {
  fieldMapping: {
    user_id: "id",
    user_email: "email",
  },
  allowedFields: ["user_id", "user_email"], // Validation uses query field names (before mapping)
  caseInsensitive: true,
});
```

## Security

When accepting user input, use `allowedFields` to prevent access to sensitive fields:

```typescript
const filter = toFilter(ast, {
  allowedFields: ["name", "email", "status"], // "password" queries will throw
});
```
