// Overview of Filtron query syntax and supported operators.
// Run with: bun run examples/query-syntax.ts

import { parseOrThrow } from "../src/index";

// Comparison operators: =, !=, >, >=, <, <=
parseOrThrow('status = "active"');
parseOrThrow("age >= 18");
parseOrThrow("price < 100");

// Contains operator (~) for substring matching
parseOrThrow('name ~ "john"');

// Boolean field shorthand (field is truthy)
parseOrThrow("verified");
parseOrThrow("premium AND verified");

// Field existence check (?)
parseOrThrow("email?");

// One-of operator (:) for matching against a list
parseOrThrow('role : ["admin", "moderator", "user"]');

// Not-one-of operator (!:)
parseOrThrow('status !: ["deleted", "banned"]');

// Range values for numeric intervals (inclusive)
parseOrThrow("age = 18..65");
parseOrThrow("age != 18..65"); // outside the interval

// Temporal values: absolute dates and now-relative points
parseOrThrow("created > @2024-06-01");
parseOrThrow("updated > @now-1h"); // resolve now-relative values before filtering
parseOrThrow("deployed = @2024-06-01..2024-06-30");

// Logical operators: AND, OR, NOT
parseOrThrow('active AND role = "admin"');
parseOrThrow('role = "admin" OR role = "moderator"');
parseOrThrow("NOT suspended");

// Parentheses for grouping
parseOrThrow('(role = "admin" OR role = "moderator") AND active');

// Dotted field names for nested access
parseOrThrow("user.profile.age >= 18");

console.log("All syntax examples parsed successfully");
