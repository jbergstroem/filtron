# Filtron - Agent Workflows

This document describes the core workflows and principles for working on the Filtron query language parser. The two goals of this library are:

1. **Performance** - This parser is designed for real-time API usage where query parsing happens on every request and its performance is mission-critical
2. **Correctness** - The parser must accurately parse all valid queries and reject invalid ones with clear error messages

Filtron source code is maintained at GitHub: https://github.com/jbergstroem/filtron. For additional context on contributing, see [./CONTRIBUTING.md](./CONTRIBUTING.md).

## Project Architecture

Filtron is organized as a **monorepo** with multiple packages.

- **`@filtron/core`** - Core query parser using [Ohm.js](https://ohmjs.org/)
- **`@filtron/sql`** - SQL WHERE clause generator that converts Filtron AST to SQL
- **`@filtron/benchmark`** - A set of benchmarks run in CI and analyzed by CodSpeed

## Project dependencies

- Filtron uses Bun for package management, testing and library transpilation
- Filtron relies on [ohm-js](https://ohmjs.org/docs/api-reference) for parsing PEG grammar

## Workflows

- Run tests with `bun test` in the root folder or in each subsequent package folder
- Measure changes made to the libraries with `bun run bench`
- Validate and format syntax with `bun run lint` from the root folder
- Verify typescript in each package by running `bun run typecheck`

You can additionally use bun's monorepo tooling (`--filter 'package'` or `--filter '**'`) to run commands.

## Adding new grammar

All grammar lives in `packages/core`.

- Start by updating the PEG grammar. Consider how common the pattern is when choosing where in the document to insert it. A common pitfall is evaluating less common scenarios prior to more common ones
- Consider adding fast-path support for the grammar
- Run benchmarks to compare performance and explore ways of making it faster
- Add support to the syntax in the `packages/sql` repository after performance is optimized.
- Add tests (100% coverage for all grammar) - as few as needed. Do not consider every possible variation outside coverage
- Update the documentation in each README.md but stick to as little information as possible

## "Real life" examples

We maintain examples in the `examples` folder:

- **`examples/elysia-sqlite`**: An example API using [elysia-js](https://elysiajs.com/llms.txt) and SQLite, accepting filtron filters over a querystring. This example has an end-to-end suite
