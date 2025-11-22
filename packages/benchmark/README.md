# @filtron/benchmark

Continuous performance benchmarks for Filtron using [tinybench](https://github.com/tinylibs/tinybench) and [CodSpeed](https://codspeed.io/) to be run in CI

## Overview

This package contains the benchmark suite for tracking Filtron's performance over time. Benchmarks run automatically on every commit and pull request via GitHub Actions, with results tracked by CodSpeed.

**Note**: The runner needs to use Node.js due to the codspeed libraries relying on it.

```bash
bun run bench
```
