# Filtron Examples

This directory contains comprehensive examples demonstrating how to use Filtron in real-world applications.

## Available Examples

### [Elysia + SQLite](./elysia-sqlite)

A complete REST API example showing how to integrate Filtron with Elysia and in-memory SQLite for dynamic filtering.

**Features:**
- ✨ Dynamic filtering with Filtron query language
- 🔒 SQL injection prevention with parameterized queries
- ⚡ High-performance real-time API filtering
- 🎯 Type-safe throughout with TypeScript
- 🎲 Realistic test data with Faker.js (500 users, constant seed)
- 🧪 Focused test suite (14 E2E tests)
- 🎯 Ultra-minimal API (single endpoint)
- 💾 In-memory SQLite (no database files)
- 📚 Extensive documentation and examples

**Tech Stack:**
- [Elysia](https://elysiajs.com/) - Fast web framework
- [Bun SQLite](https://bun.sh/docs/api/sqlite) - Built-in in-memory SQLite
- [@filtron/core](../packages/core) - Query parser
- [@filtron/sql](../packages/sql) - SQL converter

**Quick Start:**
```bash
cd elysia-sqlite
bun install
bun start  # Auto-seeds in-memory database on startup
```

Then try:
```bash
# Get all users (500 in-memory)
curl "http://localhost:3000/users"

# Filter users
curl "http://localhost:3000/users?filter=age > 30"
curl "http://localhost:3000/users?filter=status = \"active\" AND verified"
```

See the [full documentation](./elysia-sqlite/README.md) for more details.

## Running Examples

All examples are part of the Filtron monorepo workspace. To run any example:

1. **Install dependencies** (from repository root):
   ```bash
   bun install
   ```

2. **Build Filtron packages** (from repository root):
   ```bash
   bun run build
   ```

3. **Navigate to example**:
   ```bash
   cd examples/elysia-sqlite
   ```

4. **Start the server** (database auto-seeds on first run):
   ```bash
   bun start
   ```

## Example Structure

Each example follows a consistent structure:

```
example-name/
├── src/                    # Source code
│   ├── index.ts           # Main application entry
│   ├── *.test.ts          # Tests
│   └── ...                # Additional modules
├── README.md              # Comprehensive documentation
├── EXAMPLES.md            # Advanced usage examples (if applicable)
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── .gitignore            # Ignored files
```

## Creating Your Own Example

Want to add a new example? Here's the recommended approach:

1. **Create example directory:**
   ```bash
   mkdir -p examples/my-example/src
   ```

2. **Add to workspace** in root `package.json`:
   ```json
   {
     "workspaces": {
       "packages": [
         "packages/core",
         "packages/sql",
         "examples/elysia-sqlite",
         "examples/my-example"
       ]
     }
   }
   ```

3. **Create package.json:**
   ```json
   {
     "name": "my-example",
     "private": true,
     "type": "module",
     "dependencies": {
       "@filtron/core": "workspace:*",
       "@filtron/sql": "workspace:*"
     }
   }
   ```

4. **Implement your example** following the patterns in existing examples

5. **Document thoroughly** with README.md and inline comments

## Guidelines for Examples

When creating examples, follow these guidelines:

### Code Quality
- ✅ Use TypeScript with strict mode
- ✅ Include comprehensive error handling
- ✅ Write tests for key functionality
- ✅ Add inline comments explaining Filtron usage
- ✅ Follow the project's code style

### Documentation
- ✅ Write a comprehensive README.md
- ✅ Include a "Quick Start" section
- ✅ Provide multiple example queries
- ✅ Explain key concepts and patterns
- ✅ Document all API endpoints (if applicable)

### Performance
- ✅ Demonstrate best practices for performance
- ✅ Use database indexes where appropriate
- ✅ Show proper parameterization
- ✅ Include benchmarking (if relevant)

### Security
- ✅ Always use parameterized queries
- ✅ Demonstrate proper input validation
- ✅ Show error handling for malicious input
- ✅ Never trust user input directly

## Example Ideas

Looking for inspiration? Here are some example ideas:

- **Express + PostgreSQL** - Classic Node.js REST API
- **Fastify + MySQL** - High-performance API server
- **Next.js API Routes** - Serverless functions with filtering
- **Hono + DuckDB** - Edge runtime with analytics
- **GraphQL Resolver** - Dynamic filtering in GraphQL
- **CLI Tool** - Command-line interface for querying data
- **React Admin Panel** - Frontend with dynamic filters
- **Svelte Dashboard** - Real-time filtered data visualization

## Contributing Examples

We welcome community contributions! If you've built something cool with Filtron:

1. Fork the repository
2. Create your example following the guidelines above
3. Test thoroughly
4. Submit a pull request

See [CONTRIBUTING.md](../CONTRIBUTING.md) for more details.

## Support

- 📖 [Filtron Documentation](../README.md)
- 💬 [GitHub Issues](https://github.com/jbergstroem/filtron/issues)
- 🐛 [Report a Bug](https://github.com/jbergstroem/filtron/issues/new)

## License

All examples are MIT licensed. See [LICENSE](../LICENSE) for details.