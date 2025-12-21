# Security Policy

## Supported Versions

We support the current major version of each package:

| Package       | Supported Versions |
| ------------- | ------------------ |
| @filtron/core | 1.x                |
| @filtron/sql  | 1.x                |
| @filtron/js   | 1.x                |

## Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues. Instead, create a [private security advisory](https://github.com/jbergstroem/filtron/security/advisories/new) on GitHub.

Include in your report:

- Description of the vulnerability
- Impact and affected versions
- Steps to reproduce
- Suggested fix (optional)

We'll acknowledge your report within 72 hours and keep you informed of progress.

## Security Considerations

### SQL Injection Prevention

The `@filtron/sql` package generates parameterized SQL queries, therefore avoiding SQL-related vulnerabilities:

```typescript
// Safe - uses parameterized queries
const { sql, params } = toSQL(ast, { dialect: "postgres" });
db.query(sql, params);

// Unsafe - string concatenation
const unsafeSql = `SELECT * FROM ${userInput} WHERE ${filterString}`;
```

### Input Validation

Ultimately, it is up to the user to ensure that input is validated and sanitized before passing it on to the actual dataset. Both the `js` package and the `sql` package provide utilities for this purpose.

In general:

- Validate and sanitize user input before parsing
- Set reasonable limits on expression complexity
- Consider rate limiting for public APIs

### Denial of Service

- Deeply nested expressions can cause performance issues
- Consider setting a maximum depth or complexity limit
