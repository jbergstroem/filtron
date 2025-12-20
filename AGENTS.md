# Filtron - Agent Guidelines

## Goals

1. **Performance** - Query parsing is mission-critical; measure all changes
2. **Correctness** - Parse valid queries, reject invalid ones with clear errors

## Rules

- Do NOT add dependencies without explicit approval
- Do NOT expose internal functions in public API
- Do NOT write tests beyond what's needed for coverage
- Keep README updates factual - no marketing language

## Key Files

| Purpose                  | Path                             |
| ------------------------ | -------------------------------- |
| Lexer (tokenizer)        | `packages/core/src/lexer.ts`     |
| Recursive descent parser | `packages/core/src/rd-parser.ts` |
| Parser API               | `packages/core/src/parser.ts`    |
| AST types                | `packages/core/src/types.ts`     |
| JS filter                | `packages/js/src/filter.ts`      |
| SQL generator            | `packages/sql/src/converter.ts`  |
| Benchmarks               | `packages/benchmark/*.bench.ts`  |

## Commands

| Task           | Command             |
| -------------- | ------------------- |
| Run tests      | `bun test`          |
| Run benchmarks | `bun run bench`     |
| Lint/format    | `bun run lint`      |
| Type check     | `bun run typecheck` |

## Performance Requirements

- Parser changes must not regress simple query parsing beyond 5%
- Run `bun run bench` before and after changes

## Testing

- One test file per source file: `foo.ts` → `foo.test.ts`
- Target 100% coverage with minimal tests
- No snapshot tests
- No mocking unless absolutely required

## Code Style

- No default exports
- No `any` types
- No classes—use functions (except Lexer/Parser which use classes for state)
- Prefer `switch` with exhaustiveness checks over `if/else` chains

## Parser Architecture

Filtron uses a hand-written recursive descent parser for performance:

1. **Lexer** (`packages/core/lexer.ts`) - Tokenizes input into tokens (STRING, NUMBER, IDENT, operators, etc.)
2. **Parser** (`packages/core/rd-parser.ts`) - Recursive descent parser that builds AST during parsing
3. **API** (`packages/core/parser.ts`) - Public `parse()` and `parseOrThrow()` functions

### Grammar (in precedence order, lowest to highest)

```
Query           = OrExpression
OrExpression    = AndExpression (OR AndExpression)*
AndExpression   = NotExpression (AND NotExpression)*
NotExpression   = NOT NotExpression | PrimaryExpression
PrimaryExpression = '(' OrExpression ')' | FieldExpression
FieldExpression = FieldName ('?' | EXISTS | ComparisonOp Value | OneOfOp '[' Values ']')?
FieldName       = IDENT ('.' IDENT)*
Value           = STRING | NUMBER | BOOLEAN | DottedIdent
```

## Checklist: Modifying Parser

1. Edit `packages/core/src/lexer.ts` if new tokens needed
2. Edit `packages/core/src/rd-parser.ts` for grammar changes
3. Add types to `packages/core/src/types.ts`
4. Run `bun run bench` — compare results
5. Add tests in `packages/core/src/*.test.ts`
6. Update README.md in affected packages

## Checklist: Modifying SQL Generator

1. Ensure syntax follows standard SQL; use options for database-specific syntax
2. All values must be parameterized—never concatenate
3. Run `bun run bench` in `packages/benchmark`
4. Add tests in `packages/sql/src/*.test.ts`

## Checklist: Modifying JS Filter

1. Performance is critical—measure filter creation and execution overhead
2. All field access must respect `fieldMapping` option if provided
3. Optimize for common cases (small arrays, repeated field access)
4. Run `bun run bench` in `packages/js`
5. Add tests in `packages/js/src/*.test.ts`
