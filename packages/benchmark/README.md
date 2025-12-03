# @filtron/benchmark

Continuous performance benchmarks for Filtron using [tinybench](https://github.com/tinylibs/tinybench) and [CodSpeed](https://codspeed.io/) to be run in CI

## Overview

This package contains the benchmark suite for tracking Filtron's performance over time. Benchmarks run automatically on every commit and pull request via GitHub Actions, with results tracked by CodSpeed.

**Benchmarked packages:**

- `@filtron/core` - Parser performance
- `@filtron/sql` - SQL generation overhead
- `@filtron/js` - Filter creation and array filtering

**Note**: Benchmarks run via CodSpeed needs Node.js

```bash
bun run bench
```
