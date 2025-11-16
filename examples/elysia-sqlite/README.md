# Elysia + SQLite + Filtron Example

An example repository showcasing how filtering could work in an API.

## Installation

From the root of the Filtron repository:

```bash
# Install dependencies
bun install

# Navigate to example
cd examples/elysia-sqlite

# Start the dev server (auto-reloads on change)
bun dev
```

## Example queries

As the dev-server is running, send a few queries to showcase how it works.

> **Note:** Filter queries contain special characters (spaces, `>`, `<`, quotes, brackets) that must be URL-encoded. These examples use `curl --get --data-urlencode` which automatically handles the encoding. Alternatively, you can manually encode the URL (e.g., `age > 30` becomes `age%20%3E%2030`).

```bash
# Get all users (returns all 500)
curl "http://localhost:3000/users"

# Get users over 30
curl --get --data-urlencode "filter=age > 30" "http://localhost:3000/users"

# Get active verified users
curl --get --data-urlencode 'filter=status = "active" AND verified' "http://localhost:3000/users"

# Get admins or moderators
curl --get --data-urlencode 'filter=role:["admin","moderator"]' "http://localhost:3000/users"

# Active users with specific roles and age range
curl --get --data-urlencode 'filter=status = "active" AND role:["admin","moderator"] AND age >= 25 AND age <= 45' "http://localhost:3000/users"
```

## Sample Data

The in-memory database is automatically seeded with 500 "users" on startup, generated using [Faker.js](https://fakerjs.dev/) with a constant seed (12345) for reproducibility.
