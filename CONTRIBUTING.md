# Contributing to Filtron

Thank you for your interest in contributing to Filtron! This guide will help you get started with development.

## Getting started

### Prerequisites

- Git
- [Bun](https://bun.sh) ≥1.1.0

### Initial setup

```bash
git clone https://github.com/jbergstroem/filtron.git && cd filtron
bun install # Install dependencies
bun run build # Build all packages
bun test # Test all packages
```

### Code style and correctness

Filtron uses oxlint (including the experimental tsgolint) and oxfmt. Run it all in one go:

```bash
bun run lint
```

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/jbergstroem/filtron/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jbergstroem/filtron/discussions)

## Development Workflow

### Making Changes

1. **Create a branch**

   ```bash
   git switch -c feature/my-feature
   ```

2. **Make your changes**
   - Edit source files in `packages/core/src/` or `packages/sql/src/`
   - Add or update tests in the respective package
   - Update documentation as needed

3. **Test your changes**

   ```bash
   bun test
   ```

4. **Build and verify**

   ```bash
   bun run build
   cd packages/core && bun run examples/basic.ts
   ```

5. **Update documentation**
   - **README.md** - Quick start and overview
   - **packages/\*/README.md** - Package-specific documentation
   - **CONTRIBUTING.md** - Development guide
   - **AGENTS.md** - Agent collaboration guide
   - **JSDoc comments** - In-code documentation

6. **Commit your changes**
   Follow [Conventional Commits](https://www.conventionalcommits.org/) and the guidelines below
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

### Commit Message Guidelines

Follow these conventions for all commits:

- **Title length**: Maximum 72 characters
- **Body wrapping**: Wrap at 100 characters
- **Markdown links**: Use reference-style links with references in the git footer

**Example commit message**:

```
feat: add support for ILIKE operator in SQL converter

This adds case-insensitive pattern matching support for PostgreSQL
and DuckDB dialects. The implementation uses the ILIKE operator
which is more efficient than LOWER() with LIKE. See the benchmark
results in [PR #123][pr-123] for performance comparison.

Closes: https://github.com/jbergstroem/filtron/issues/122
[pr-123]: https://github.com/jbergstroem/filtron/pull/123
```

## Performance

### Running Benchmarks

As you make changes, compare the before/after. We also keep tabs on this in CI when you open a PR.
If you are creating a new package, also add a benchmark in `packages/benchmark`, similar to how
the other benchmarks are maintained.

```bash
# Core parser benchmarks
cd packages/core && bun run bench

# SQL converter benchmarks
cd packages/sql && bun run bench
```

## Building

### Development Build

```bash
# Full build (all packages)
bun run build
# Only build one package
bun run build --filter='@filtron/core'
```

## Submitting Changes

### Before Submitting

**Checklist**:

- [ ] All tests pass: `bun test`
- [ ] Code builds: `bun run build`
- [ ] Types are correct: `bun run typecheck`
- [ ] Linting passes: `bun run lint`
- [ ] Documentation updated (if API changed)
- [ ] Benchmarks run (if performance-sensitive code changed)
- [ ] Commit messages follow conventions

## Code of Conduct

Be respectful and constructive in all interactions. We're all here to build great software together.

## License

By contributing to Filtron, you agree that your contributions will be licensed under the MIT License.
