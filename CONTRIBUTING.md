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

## Development Workflow

### Making Changes

1. **Create a branch**

   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make your changes**
   - Edit source files in `packages/core/src/` or `packages/sql/src/`
   - Add or update tests in the respective package
   - Update documentation if needed

3. **Test your changes**

   ```bash
   bun test
   ```

4. **Build and verify**

   ```bash
   bun run build
   cd packages/core && bun run examples/basic.ts
   ```

5. **Commit your changes**
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

```bash
# Core parser benchmarks
cd packages/core && bun run bench

# SQL converter benchmarks
cd packages/sql && bun run bench

# With memory stats
cd packages/core && MIMALLOC_SHOW_STATS=1 bun run bench
```

### Performance Regression Testing

Before submitting changes that could affect performance:

```bash
# Run benchmarks before changes (from package directory)
cd packages/core && bun run bench > before.txt

# Make your changes

# Run benchmarks after changes
cd packages/core && bun run bench > after.txt

# Compare results
diff before.txt after.txt
```

## Building

### Development Build

```bash
# Full build (all packages)
bun run build

# Just rebuild core grammar bundle
cd packages/core && bun run build:grammar
```

### Verifying the Build

```bash
# Verify core bundle works
cd packages/core
node -e "import('./dist/index.js').then(m => console.log(m.parse('age>18')))"

# Or with Bun
bun -e "import('./dist/index.js').then(m => console.log(m.parse('age>18')))"
```

## Submitting Changes

### Before Submitting

**Checklist**:

- [ ] All tests pass: `bun test`
- [ ] Code builds: `bun run build`
- [ ] Types are correct: `bunx tsc --noEmit`
- [ ] Examples work: `bun run examples/basic.ts`
- [ ] Grammar bundle regenerated (if grammar changed)
- [ ] Documentation updated (if API changed)
- [ ] Benchmarks run (if performance changed)
- [ ] Commit messages follow conventions

### Creating a Pull Request

1. **Push your branch**

   ```bash
   git push origin feature/my-feature
   ```

2. **Create PR on GitHub**
   - Provide clear description
   - Reference any related issues
   - Include examples if adding features
   - Note any breaking changes

### Which Docs to Update

- **README.md** - Quick start and overview
- **CONTRIBUTING.md** - Development guide
- **AGENTS.md** - Agent collaboration guide
- **examples/** - Usage examples
- **JSDoc comments** - In-code documentation

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/jbergstroem/filtron/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jbergstroem/filtron/discussions)
- **Documentation**: Check [README.md](./README.md) and [AGENTS.md](./AGENTS.md)

## Code of Conduct

Be respectful and constructive in all interactions. We're all here to build great software together.

## License

By contributing to Filtron, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Filtron! 🎉
