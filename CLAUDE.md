# Filtron - agent guidelines

## Goals

1. Performance: Query parsing is mission-critical; measure all changes
2. Correctness: Parse valid queries, reject invalid ones with clear errors

## Rules

- Do NOT add dependencies without explicit approval
- Do NOT expose internal functions in public API
- Do NOT write tests beyond what's needed for coverage
- Keep README updates factual; no marketing language

## Key files

| Purpose                  | Path                             |
| ------------------------ | -------------------------------- |
| Lexer (tokenizer)        | `packages/core/src/lexer.ts`     |
| Recursive descent parser | `packages/core/src/rd-parser.ts` |
| Parser API               | `packages/core/src/parser.ts`    |
| AST types                | `packages/core/src/types.ts`     |
| JS filter                | `packages/js/src/filter.ts`      |
| SQL generator            | `packages/sql/src/converter.ts`  |
| CI benchmarks            | `packages/benchmark/*.bench.ts`  |
| Local benchmarks         | `packages/*/bench.ts`            |

## Commands

All commands must be run from the repository root. Do NOT `cd` into individual
packages to run tests, lint, or benchmarks.

| Task            | Command            |
| --------------- | ------------------ |
| Run tests       | `bun test`         |
| Run benchmarks  | `bun run bench`    |
| Lint/format     | `bun run lint`     |
| Fix lint/format | `bun run lint:fix` |
| Type check      | `bun run lint`     |
| Check for cruft | `bun run knip`     |

Note: There is no separate `typecheck` script. Type checking is handled by oxlint
via `--type-aware --type-check` flags in the lint command.

## Performance requirements

- Parser changes must not regress simple query parsing beyond 5%
- Run `bun run bench` before and after changes for the package that is modified

## Testing

- One test file per source file: `foo.ts` → `foo.test.ts`
- Target 100% coverage with minimal testing
- No snapshot tests
- No mocking unless absolutely required
- Run `bun run lint` after writing code to catch issues early
- Run `bun run knip` to check for unused files, exports, and dependencies

## Code style

- No default exports
- No `any` types
- No classes—use functions (except Lexer/Parser which use classes for state)
- Prefer `switch` with exhaustiveness checks over `if/else` chains

## Parser architecture

Filtron uses a hand-written recursive descent parser for performance:

1. **Lexer** (`packages/core/lexer.ts`) - Tokenizes input into tokens (STRING, NUMBER, IDENT, operators, etc.)
2. **Parser** (`packages/core/rd-parser.ts`) - Recursive descent parser that builds AST during parsing
3. **API** (`packages/core/parser.ts`) - Public `parse()` and `parseOrThrow()` functions

## Dependencies

- Keep third-party dependencies to an absolute minimum
- If dependencies are added, pin the version

### Grammar (in precedence order, lowest to highest)

```
Query           = OrExpression
OrExpression    = AndExpression (OR AndExpression)*
AndExpression   = NotExpression (AND NotExpression)*
NotExpression   = NOT NotExpression | PrimaryExpression
PrimaryExpression = '(' OrExpression ')' | FieldExpression
FieldExpression = FieldName ('?' | EXISTS | ComparisonOp Value RangeSuffix? | OneOfOp '[' Values ']')?
RangeSuffix     = '..' NUMBER
FieldName       = IDENT ('.' IDENT)*
Values          = Value (',' Value)*
Value           = STRING | NUMBER | BOOLEAN | DottedIdent
```

## Checklist: modifying parser

1. Edit `packages/core/src/lexer.ts` if new tokens needed
2. Edit `packages/core/src/rd-parser.ts` for grammar changes
3. Add types to `packages/core/src/types.ts`
4. Run `bun run bench` — compare results
5. Add tests in `packages/core/src/*.test.ts`
6. Update README.md in affected packages

## Checklist: modifying SQL generator

1. Ensure syntax follows standard SQL; use options for database-specific syntax
2. All values must be parameterized—never concatenate
3. Run `bun run --filter='@filtron/sql' bench` — compare results
4. Add tests in `packages/sql/src/*.test.ts`

## Checklist: modifying JS filter

1. Performance is critical—measure filter creation and execution overhead
2. All field access must respect `fieldMapping` option if provided
3. Optimize for common cases (small arrays, repeated field access)
4. Run `bun run --filter='@filtron/js' bench` — compare results
5. Add tests in `packages/js/src/*.test.ts`

## Documentation guidelines

- No emojis in code, comments, documentation, or commit messages
- Keep updates factual; no marketing language or hyperbole
- Write concisely - remove verbose explanations and redundant sections
- Avoid bold text for emphasis; let the content speak for itself
- Use sentence case for headings (not Title Case)
- Code examples should be minimal and runnable
- Show both safe and unsafe patterns in security-related examples
- Tables for structured information (operators, commands, etc.)
- Use TypeScript for all code examples
- Link to other docs using relative paths: `[Guide](./CONTRIBUTING.md)`

## GitHub Actions workflow style

- Use concise style: `uses:` and `run:` without `name:` unless clarity requires it
- Pin action versions to full SHA with version comment: `actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8 # v6`
- Use `ubuntu-slim` as the default runner except for benchmarks
- Use `bun-version-file: package.json` for setup-bun
- Use `bun ci` (alias for `bun install --frozen-lockfile`) for dependency installation
