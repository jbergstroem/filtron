# @filtron/time-resolver

Resolve now-relative temporal values in a Filtron AST into absolute dates.

[![npm version](https://img.shields.io/npm/v/@filtron/time-resolver.svg)](https://www.npmjs.com/package/@filtron/time-resolver)
[![npm bundle size](https://img.shields.io/bundlephobia/min/%40filtron%2Ftime-resolver)](https://bundlephobia.com/package/@filtron/time-resolver)
[![codecov](https://codecov.io/gh/jbergstroem/filtron/graph/badge.svg?token=FXIWJKJ9RI&component=time-resolver)](https://codecov.io/gh/jbergstroem/filtron)

Queries like `created > @now-7d` parse into inert `{ type: "now", offset }` values. The adapters ([@filtron/js](../js/README.md), [@filtron/sql](../sql/README.md)) reject these until they are resolved, since "now" changes between calls. This package is that resolution step: run it once per evaluation and pass the result to an adapter.

## Installation

```bash
npm install @filtron/time-resolver
```

## Usage

```typescript
import { parseOrThrow } from "@filtron/core";
import { resolveTemporal } from "@filtron/time-resolver";
import { toSQL } from "@filtron/sql";

const ast = resolveTemporal(parseOrThrow("created > @now-7d"));
const { sql, params } = toSQL(ast);
// sql: "created > $1"
// params: ["2026-07-10T12:00:00.000Z"]
```

## API

### `resolveTemporal(ast, options?): ASTNode`

Returns a new AST in which every `now` value (bare `@now` or offset forms like `@now-7d`, including range bounds such as `@now-7d..now`) is replaced by an absolute `{ type: "date" }` value in ISO 8601 UTC. Absolute dates, numbers, strings and all other values pass through untouched. Subtrees without relative values are returned by reference, so an AST that never uses `@now` comes back identity-equal.

#### Options

| Option | Type   | Default      | Description                        |
| ------ | ------ | ------------ | ---------------------------------- |
| `now`  | `Date` | `new Date()` | The instant `now` resolves against |

Pass a fixed `now` for deterministic output (tests, cache keys, replaying a query at a past instant):

```typescript
const ast = resolveTemporal(parseOrThrow("created > @now-1M"), {
	now: new Date("2026-07-17T12:00:00Z"),
});
// comparison value: { type: "date", value: "2026-06-17T12:00:00.000Z" }
```

#### Offset arithmetic

| Unit | Meaning | Arithmetic                                   |
| ---- | ------- | -------------------------------------------- |
| `s`  | seconds | fixed length                                 |
| `m`  | minutes | fixed length                                 |
| `h`  | hours   | fixed length                                 |
| `d`  | days    | fixed length (24 hours)                      |
| `w`  | weeks   | fixed length (7 days)                        |
| `M`  | months  | calendar months in UTC, clamped to month end |
| `y`  | years   | calendar years in UTC, clamped to month end  |

Clamping means Jul 31 minus one month is Jun 30, and Feb 29 plus one year is Feb 28. Fixed-length units ignore the calendar entirely: `@now-1d` is always exactly 24 hours ago.

#### Errors

`resolveTemporal` throws when:

- the reference time is an invalid `Date`
- a temporal range is inverted after resolution, such as `created = @now-1d..now-7d`

Ranges with absolute bounds are ordering-checked by the parser; ranges involving `now` can only be checked here, once both bounds are concrete.

## Why a separate package

Resolution is a policy decision: the caller picks the instant, decides how often to re-resolve, and may want to cache the resolved AST. Keeping it out of the adapters keeps them pure functions of the AST and keeps this dependency out of apps that never use `@now`.

## License

MIT
