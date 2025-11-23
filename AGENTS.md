# Filtron - Agent Workflows

This document describes the core workflows and principles for working on the Filtron query language parser. The two most important goals of this library are:

1. **Performance** - This parser is designed for real-time API usage where query parsing happens on every request (200-900ns for simple/medium queries via fast-path)
2. **Correctness** - The parser must accurately parse all valid queries and reject invalid ones with clear error messages

## Project Architecture

Filtron is organized as a **monorepo** with multiple packages:

- **`@filtron/core`** - Core query parser using [Ohm.js](https://ohmjs.org/)
- **`@filtron/sql`** - SQL WHERE clause generator that converts Filtron AST to SQL

## Workflow Checklist

Before submitting changes, ensure:

- [ ] All tests pass: `bun test` (from root, runs all packages)
- [ ] Package-specific tests pass: `cd packages/core && bun test`
- [ ] Examples work: `bun run packages/core/examples/basic.ts`
- [ ] Grammar compiles without warnings: `cd packages/core && bun run build:grammar`
- [ ] Build succeeds: `bun run build` (from root, builds all packages)
- [ ] Code has no linting, formatting or type errors: `bun run lint`
- [ ] Coverage maintained: Check test output
- [ ] Documentation is maintained in README.md (high level overview), CONTRIBUTING.md (collaboration guidelines), and AGENTS.md (agent workflows). Each package has their own README.md that further explains its functionality.

### General Guidelines

- **Use Bun APIs for tooling** - Build scripts, tests, and examples can use Bun
- **Compiled output must be engine-agnostic** - The published libraries work in any JavaScript runtime
- **Prefer immutability** - AST nodes are immutable plain objects
- **Use discriminated unions** - All AST nodes have `type` field
- **Monorepo-aware** - Use workspace dependencies (`workspace:*`) and catalog dependencies (`catalog:`)
- **Fast-path first** - 85-90% of queries use regex fast-path, Ohm.js handles complex cases

### Fast-Path Coverage

The parser uses a hybrid approach for optimal performance:

**Fast-Path Patterns** (85-90% of queries, 200-900ns):

- ✅ Simple comparisons: `field = value`, `age > 18`
- ✅ Boolean fields: `verified`, `premium`
- ✅ EXISTS checks: `email?`, `name exists`
- ✅ NOT expressions: `NOT banned`, `NOT status = "deleted"`
- ✅ oneOf/notOneOf: `status : ["active", "pending"]`, `role !: [0]`
- ✅ Simple AND: `verified AND age > 18` (up to 5 terms)
- ✅ Simple OR: `admin OR moderator` (up to 5 terms)

**Ohm.js Fallback** (10-15% of queries, 2-240μs):

- Parentheses: `(a OR b) AND c`
- Mixed AND/OR: `a AND b OR c` (without parentheses)
- Nested NOT: `NOT (a AND b)`
- Escape sequences: `"hello \"world\""`
- Complex nesting and error recovery

## Working with @filtron/core

**Flow**: `Query String` → `grammar.ohm` (parse) → `semantics.ts` (build AST) → `ASTNode`

All core parser work happens in `packages/core/`.

### Making Grammar Changes

When modifying the grammar (adding syntax, operators, etc.) follow these steps:

#### 1. Edit Grammar (`packages/core/src/grammar.ohm`)

Make your changes to the grammar file:

```ohm
// Example: Adding a "contains all" operator
ContainsAllOp = "::"
ComparisonOp = "!=" | ">=" | "<=" | "=" | "~" | ">" | "<" | "::" | ":"
```

Consider:

- **Left-recursion**: Ohm handles it, but consider operator precedence
- **Keywords**: Add to the `keyword` rule to prevent field name conflicts
- **Operators**: Add to appropriate operator rule

You must regenerate the bundle after any grammar changes:

```bash
cd packages/core
bun run build:grammar
```

This compiles `src/grammar.ohm` → `src/grammar.ohm-bundle.{js,d.ts}`

#### 2. Update AST Types (`packages/core/src/types.ts`)

Add TypeScript types for the new AST nodes:

```typescript
export interface ContainsAllExpression {
  type: "containsAll";
  field: string;
  values: Value[];
}

export type ASTNode =
  | OrExpression
  | ContainsAllExpression  // Add to union
  | ...
```

#### 3. Update Semantics (`packages/core/src/semantics.ts`)

Add semantic action to build the AST node:

```typescript
FieldExpression_containsAll(
  fieldName: Node,
  _op: Node,
  _open: Node,
  values: Node,
  _close: Node
): ASTNode {
  return {
    type: "containsAll",
    field: fieldName.sourceString,
    values: values.asIteration().children.map((v: Node) => v.toAST()),
  };
}
```

#### 4. Add Tests

Add comprehensive tests to `packages/core/src/parser.test.ts`:

- Basic usage
- With different value types
- Combined with other operators (AND, OR, NOT)
- Edge cases (single value, empty array, etc.)
- Error cases (invalid syntax)

#### 5. Update SQL Converter (if needed)

If the new syntax requires SQL support, update `packages/sql/src/converter.ts`:

```typescript
case "containsAll":
  // Generate appropriate SQL for the new operator
  return convertContainsAll(node, options);
```

Add tests to `packages/sql/src/converter.test.ts`.

### Correctness Guidelines

1. **Grammar must be unambiguous** - One query = one parse tree
2. **Error messages must be clear** - Users should understand what's wrong
3. **All valid syntax must parse** - No false negatives
4. **All invalid syntax must fail** - No false positives
5. **AST must be fully typed** - TypeScript catches errors

## Working with @filtron/sql

The `@filtron/sql` package converts Filtron AST to SQL WHERE clauses.

**Flow**: `ASTNode` → `converter.ts` (generate SQL) → `{ sql: string, params: any[] }`

### Adding SQL Support for New Features

When `@filtron/core` adds new grammar features:

#### 1. Update Converter (`packages/sql/src/converter.ts`)

Add conversion logic for the new AST node type:

```typescript
function convertNode(node: ASTNode, options: Options): SQLResult {
  switch (node.type) {
    case "containsAll":
      return convertContainsAll(node, options);
    // ... other cases
  }
}
```

#### 2. Add Tests (`packages/sql/src/converter.test.ts`)

Test the SQL generation:

- Correct SQL syntax for each dialect (postgres, mysql, sqlite, duckdb)
- Correct parameterization
- Edge cases
- Integration with other operators

#### 3. Run Benchmarks

Ensure performance is acceptable:

```bash
cd packages/sql
bun run bench
```

## Key Performance Considerations

### Why Performance Matters

This library is designed for **real-time API filtering**:

```typescript
// API endpoint - runs on every request
app.get("/users", (req) => {
  const filterQuery = req.query.filter; // e.g., "age > 18 AND verified"
  const ast = parse(filterQuery); // MUST BE FAST
  const { sql, params } = toSQL(ast); // Also must be fast
  const users = db.query(sql, params);
  return users;
});
```

If parsing takes 10ms and you have 100 req/s, that's 1 full CPU core just parsing.

### Optimization Techniques

1. **Fast-path regex patterns** - 85-90% of queries bypass Ohm.js entirely (100x faster)
2. **Pre-compiled grammar bundle** - Considerably faster than parsing grammar source
3. **Grammar is loaded once** - At module init, zero overhead per parse
4. **Early pattern rejection** - Check for parentheses before running regex patterns
5. **Ohm memoization** - Repeated patterns are cached during parse
6. **Single-pass AST generation** - No tree traversal after parsing
7. **Zero-copy strings** - Use `.sourceString` from Ohm nodes
8. **Discriminated unions** - Fast type narrowing without instanceof
9. **Minimal allocations** - Reuse parameter arrays in SQL converter

### Benchmarking

Use the benchmark suites to ensure performance:

```bash
# Core parser benchmarks
cd packages/core
bun run bench

# SQL converter benchmarks
cd packages/sql
bun run bench
```

Typical targets:

- **Parser (fast-path)**: 180-300ns for simple queries, 700ns-1μs for medium queries
- **Parser (Ohm.js fallback)**: 2-240μs for complex queries
- **SQL Converter**: < 50μs for simple queries, < 500μs for complex queries (adds minimal overhead)

Current benchmarks (as of fast-path expansion):

- Simple queries: 180-300ns ⚡
- Medium queries: 700ns-1μs
- Complex queries: 2-240μs
- Average throughput: 84K+ parses/sec

### When to Optimize

- ❌ Don't optimize prematurely
- ✅ Do measure with realistic queries
- ✅ Do optimize if > 1μs for simple/medium queries (fast-path target)
- ✅ Do profile before changing anything
- ✅ Expand fast-path for patterns used in >5% of real-world queries

### Expanding Fast-Path

When adding new fast-path patterns:

1. **Measure frequency** - Pattern should appear in >5% of queries
2. **Keep it simple** - Only handle unambiguous cases, fallback to Ohm.js for complexity
3. **Test thoroughly** - Fast-path AST must match Ohm.js AST exactly
4. **Limit chain length** - Cap AND/OR chains at 5 terms for performance
5. **Reject early** - Use string checks (`.includes()`) before expensive regex
6. **Document limitations** - Be clear about what falls back to Ohm.js

## Key Correctness Considerations

### Why Correctness Matters

Incorrect parsing or SQL generation leads to:

- **Security issues** - SQL injection if parameterization is wrong
- **Data leaks** - Wrong filters may expose unauthorized data
- **User frustration** - Queries fail unexpectedly

### Correctness Techniques

1. **Grammar-first design** - Define syntax formally before implementing
2. **Comprehensive tests** - 100+ tests covering all features
3. **Type safety** - TypeScript catches AST structure errors
4. **Clear errors** - Users understand what's wrong
5. **No undefined behavior** - All inputs produce success or clear error
6. **Parameterized queries** - SQL converter always uses parameters, never string concatenation

### Correctness Checklist

When adding features:

- [ ] Grammar rule is unambiguous
- [ ] All valid inputs parse correctly (positive tests)
- [ ] All invalid inputs fail with clear errors (negative tests)
- [ ] AST structure is typed correctly
- [ ] Semantic action handles all cases
- [ ] SQL generation is properly parameterized (no injection risk)
- [ ] SQL works across all supported dialects
- [ ] Edge cases are tested (empty, single item, large)
- [ ] Integration with existing features tested (AND, OR, NOT)
