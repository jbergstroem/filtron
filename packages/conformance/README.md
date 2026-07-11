# @filtron/conformance

Shared conformance fixtures that every Filtron adapter runs in CI. Private, not published.

Each case pins the intended behavior of a query across adapters:

- the dataset ids a `@filtron/js` filter must match with default options
- the WHERE clause and parameters `@filtron/sql` must generate with default options

Cases run against a canonical dataset chosen so every operator discriminates: case variants, missing vs null vs empty values, a literal dotted property name, LIKE metacharacters in data, and negative/zero/float numbers.

## Changing semantics

Fixtures describe current behavior, including known divergences between adapters (marked with a `notes` field referencing the tracking issue). An intentional semantic change must update the affected fixtures in the same PR, which makes the change reviewable as a diff. A fixture failure without a fixture change is a regression.

## Adding a case

Add an entry to `cases` in [src/index.ts](./src/index.ts). Keep names kebab-case and unique. If the case documents an adapter divergence, say so in `notes` and link the issue.
