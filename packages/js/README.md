# @filtron/js

In-memory JavaScript array filtering using [Filtron](https://github.com/jbergstroem/filtron) AST.

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

| Option | Type | Description |
|--------|------|-------------|
| `allowedFields` | `string[]` | Restrict queryable fields (throws if field not in list) |
| `fieldAccessor` | `(obj, field) => unknown` | Custom field value accessor |
| `caseInsensitive` | `boolean` | Case-insensitive string comparisons (default: `false`) |

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

## Security

When accepting user input, use `allowedFields` to prevent access to sensitive fields:

```typescript
const filter = toFilter(ast, {
  allowedFields: ["name", "email", "status"], // "password" queries will throw
});
```
