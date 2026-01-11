# @filtron/js

Convert Filtron AST to JavaScript filter predicates for use with `Array.filter()`.

[![npm version](https://img.shields.io/npm/v/@filtron/js.svg)](https://www.npmjs.com/package/@filtron/js)
[![npm bundle size](https://img.shields.io/bundlephobia/min/%40filtron%2Fjs)](https://bundlephobia.com/package/@filtron/js)
[![codecov](https://codecov.io/gh/jbergstroem/filtron/graph/badge.svg?token=FXIWJKJ9RI&component=js)](https://codecov.io/gh/jbergstroem/filtron)

## Installation

```bash
npm install @filtron/js
```

## Usage

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

## API

### `toFilter<T>(ast, options?): (item: T) => boolean`

Converts a Filtron AST to a predicate function.

#### Options

| Option            | Type                                 | Default     | Description                                                 |
| ----------------- | ------------------------------------ | ----------- | ----------------------------------------------------------- |
| `allowedFields`   | `string[]`                           | `undefined` | Whitelist of queryable fields (throws if field not in list) |
| `fieldAccessor`   | `(obj: T, field: string) => unknown` | `undefined` | Custom function to retrieve field values                    |
| `caseInsensitive` | `boolean`                            | `false`     | Case-insensitive string comparisons                         |
| `fieldMapping`    | `Record<string, string>`             | `undefined` | Map query field names to object property names              |

#### Examples

**Restrict allowed fields:**

```typescript
const filter = toFilter(ast, {
	allowedFields: ["name", "email", "age"],
});
// Querying "password" will throw an error
```

**Case-insensitive matching:**

```typescript
const filter = toFilter(ast, {
	caseInsensitive: true,
});
// "status = 'ACTIVE'" matches { status: "active" }
```

**Field mapping:**

```typescript
const filter = toFilter(ast, {
	fieldMapping: {
		email: "emailAddress",
		age: "userAge",
	},
});
// Query "email" maps to object property "emailAddress"
```

**Combined options:**

```typescript
const filter = toFilter(ast, {
	fieldMapping: { user_email: "email" },
	allowedFields: ["user_email"], // Validates against query field names
	caseInsensitive: true,
});
```

### `nestedAccessor(separator?): FieldAccessor`

Creates a field accessor for dot-notation nested properties:

```typescript
import { toFilter, nestedAccessor } from "@filtron/js";

const filter = toFilter(ast, {
	fieldAccessor: nestedAccessor(),
});

// Query: "user.profile.age > 18"
// Matches: { user: { profile: { age: 25 } } }
```

Custom separator:

```typescript
const filter = toFilter(ast, {
	fieldAccessor: nestedAccessor("/"),
});
// Query: "user/profile/age > 18"
```

## Security

When accepting user input, use `allowedFields` to prevent access to sensitive properties:

```typescript
const filter = toFilter(ast, {
	allowedFields: ["name", "email", "status"],
});
// Queries against "password", "token", etc. will throw
```

## License

MIT
