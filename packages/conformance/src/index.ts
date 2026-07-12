/**
 * Shared conformance fixtures for Filtron adapters
 *
 * Every case pins the current, intended behavior of the language across
 * adapters: the ids a compiled filter must match against the canonical
 * dataset, and the SQL an AST must generate with default options. Adapters
 * run these in CI, so an intentional semantic change shows up as a fixture
 * diff in the same PR that changes it. Known divergences between adapters
 * carry a note referencing the tracking issue.
 */

/** A record in the canonical dataset */
export type ConformanceRecord = Record<string, unknown> & { id: number };

/** A single conformance case */
export interface ConformanceCase {
	/** Unique, kebab-case case name */
	name: string;
	/** The Filtron query under test */
	query: string;
	/** Dataset ids a @filtron/js filter with default options must match, in dataset order */
	matches: number[];
	/** WHERE clause @filtron/sql must generate with default options */
	sql: string;
	/** Parameters @filtron/sql must produce, in order */
	params: (string | number | boolean)[];
	/** Behavior worth calling out, including known adapter divergences */
	notes?: string;
}

/**
 * Canonical dataset. Values are chosen so each operator discriminates:
 * case variants ("active"/"ACTIVE", "admin"/"Admin"), a missing vs null vs
 * empty email, a literal dotted property name, LIKE metacharacters and an
 * apostrophe in data, and negative/zero/float scores.
 */
export const dataset: ConformanceRecord[] = [
	{
		id: 1,
		name: "Alice Johnson",
		age: 25,
		score: 4.5,
		status: "active",
		role: "admin",
		verified: true,
		premium: true,
		suspended: false,
		email: "alice@example.com",
	},
	{
		id: 2,
		name: "Bob Smith",
		age: 17,
		score: 2,
		status: "pending",
		role: "user",
		verified: false,
		premium: false,
		suspended: false,
		email: null,
	},
	{
		id: 3,
		name: "Charlie Brown",
		age: 30,
		score: 3.25,
		status: "inactive",
		role: "moderator",
		verified: true,
		premium: false,
		suspended: true,
	},
	{
		id: 4,
		name: "Dana White",
		age: 42,
		score: -1.5,
		status: "active",
		role: "user",
		verified: true,
		premium: false,
		suspended: false,
		email: "dana@example.com",
	},
	{
		id: 5,
		name: "Eve Adams",
		age: 18,
		score: 0,
		status: "deleted",
		role: "user",
		verified: false,
		premium: true,
		suspended: true,
		email: "",
	},
	{
		id: 6,
		name: "frank o'neil",
		age: 65,
		score: 5,
		status: "ACTIVE",
		role: "Admin",
		verified: true,
		premium: true,
		suspended: false,
		email: "frank@example.com",
	},
	{
		id: 7,
		name: "Grace_Hopper",
		age: 85,
		score: 10.75,
		status: "retired",
		role: "admin",
		verified: true,
		premium: true,
		suspended: false,
		email: "grace@navy.mil",
		"profile.level": 9,
	},
	{
		id: 8,
		name: "Hank 100%",
		age: 33,
		score: 3,
		status: "active",
		role: "user",
		verified: false,
		premium: false,
		suspended: false,
		email: "hank@example.com",
	},
];

export const cases: ConformanceCase[] = [
	{
		name: "equals-string",
		query: 'status = "active"',
		matches: [1, 4, 8],
		sql: "status = $1",
		params: ["active"],
	},
	{
		name: "colon-identifier",
		query: "role : admin",
		matches: [1, 7],
		sql: "role = $1",
		params: ["admin"],
	},
	{
		name: "not-equals",
		query: 'status != "active"',
		matches: [2, 3, 5, 6, 7],
		sql: "status != $1",
		params: ["active"],
	},
	{
		name: "greater-than",
		query: "age > 30",
		matches: [4, 6, 7, 8],
		sql: "age > $1",
		params: [30],
	},
	{
		name: "greater-than-or-equal",
		query: "age >= 30",
		matches: [3, 4, 6, 7, 8],
		sql: "age >= $1",
		params: [30],
	},
	{
		name: "less-than-float",
		query: "score < 3",
		matches: [2, 4, 5],
		sql: "score < $1",
		params: [3],
	},
	{
		name: "less-than-or-equal",
		query: "age <= 18",
		matches: [2, 5],
		sql: "age <= $1",
		params: [18],
	},
	{
		name: "contains",
		query: 'name ~ "an"',
		matches: [4, 6, 8],
		sql: "name LIKE $1",
		params: ["%an%"],
		notes: "~ is substring-contains in both adapters; sql wraps the parameter in % wildcards.",
	},
	{
		name: "case-sensitive-default",
		query: 'status = "ACTIVE"',
		matches: [6],
		sql: "status = $1",
		params: ["ACTIVE"],
	},
	{
		name: "range",
		query: "age = 18..30",
		matches: [1, 3, 5],
		sql: "age BETWEEN $1 AND $2",
		params: [18, 30],
	},
	{
		name: "one-of-small",
		query: 'status : ["active", "pending"]',
		matches: [1, 2, 4, 8],
		sql: "status IN ($1, $2)",
		params: ["active", "pending"],
	},
	{
		name: "not-one-of",
		query: "role !: [admin, moderator]",
		matches: [2, 4, 5, 6, 8],
		sql: "role NOT IN ($1, $2)",
		params: ["admin", "moderator"],
	},
	{
		name: "one-of-large",
		query: "age : [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]",
		matches: [2, 5],
		sql: "age IN ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
		params: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
		notes: "More than 10 values exercises the Set lookup path in @filtron/js.",
	},
	{
		name: "exists-question-mark",
		query: "email?",
		matches: [1, 4, 5, 6, 7, 8],
		sql: "email IS NOT NULL",
		params: [],
		notes: "Empty string exists; null and missing keys do not.",
	},
	{
		name: "exists-keyword",
		query: "email EXISTS",
		matches: [1, 4, 5, 6, 7, 8],
		sql: "email IS NOT NULL",
		params: [],
	},
	{
		name: "negated-exists-minus",
		query: "-email",
		matches: [2, 3],
		sql: "email IS NULL",
		params: [],
		notes: "Negated exists (#266/#284): matches null and missing values; empty string exists.",
	},
	{
		name: "negated-exists-composes",
		query: "-email AND suspended",
		matches: [3],
		sql: "(email IS NULL AND suspended = $1)",
		params: [true],
	},
	{
		name: "boolean-shorthand",
		query: "verified",
		matches: [1, 3, 4, 6, 7],
		sql: "verified = $1",
		params: [true],
	},
	{
		name: "compare-boolean",
		query: "premium = true",
		matches: [1, 5, 6, 7],
		sql: "premium = $1",
		params: [true],
	},
	{
		name: "not",
		query: "NOT suspended",
		matches: [1, 2, 4, 6, 7, 8],
		sql: "NOT (suspended = $1)",
		params: [true],
	},
	{
		name: "and",
		query: 'status = "active" AND verified',
		matches: [1, 4],
		sql: "(status = $1 AND verified = $2)",
		params: ["active", true],
	},
	{
		name: "or",
		query: "role : admin OR role : moderator",
		matches: [1, 3, 7],
		sql: "(role = $1 OR role = $2)",
		params: ["admin", "moderator"],
	},
	{
		name: "and-chain",
		query: "verified AND premium AND age > 21",
		matches: [1, 6, 7],
		sql: "(verified = $1 AND premium = $2 AND age > $3)",
		params: [true, true, 21],
		notes: "Chains are n-ary AST nodes (#283), so a chain renders flat instead of nested pairs.",
	},
	{
		name: "parens-grouping",
		query: '(role : admin OR role : moderator) AND status = "active"',
		matches: [1],
		sql: "((role = $1 OR role = $2) AND status = $3)",
		params: ["admin", "moderator", "active"],
	},
	{
		name: "precedence-and-over-or",
		query: "role : admin OR role : moderator AND verified",
		matches: [1, 3, 7],
		sql: "(role = $1 OR (role = $2 AND verified = $3))",
		params: ["admin", "moderator", true],
	},
	{
		name: "not-inside-and",
		query: "NOT suspended AND verified",
		matches: [1, 4, 6, 7],
		sql: "(NOT (suspended = $1) AND verified = $2)",
		params: [true, true],
	},
	{
		name: "dotted-field-literal",
		query: "profile.level > 5",
		matches: [7],
		sql: "profile.level > $1",
		params: [5],
		notes:
			"The default js accessor reads the literal 'profile.level' property; nested traversal requires nestedAccessor.",
	},
	{
		name: "apostrophe-in-string",
		query: `name ~ "o'neil"`,
		matches: [6],
		sql: "name LIKE $1",
		params: ["%o'neil%"],
		notes: "The apostrophe stays in the parameter; only LIKE metacharacters are escaped.",
	},
	{
		name: "like-metacharacters-in-value",
		query: 'name ~ "100%"',
		matches: [8],
		sql: "name LIKE $1",
		params: ["%100\\%%"],
		notes:
			"sql escapes LIKE metacharacters (%, _, \\) by default, so the % matches literally, as in js.",
	},
	{
		name: "negative-number",
		query: "score = -1.5",
		matches: [4],
		sql: "score = $1",
		params: [-1.5],
	},
	{
		name: "zero-boundary",
		query: "score < 0",
		matches: [4],
		sql: "score < $1",
		params: [0],
	},
	{
		name: "string-number-guard",
		query: 'age > "18"',
		matches: [],
		sql: "age > $1",
		params: ["18"],
		notes:
			"Known divergence: js type-guards numeric comparisons and matches nothing for a string target; sql defers comparison semantics to the database.",
	},
	{
		name: "no-matches",
		query: 'status = "nope"',
		matches: [],
		sql: "status = $1",
		params: ["nope"],
	},
	{
		name: "escape-sequences",
		query: 'name = "line\\nbreak"',
		matches: [],
		sql: "name = $1",
		params: ["line\nbreak"],
		notes: "The lexer resolves the escape; adapters receive the actual newline.",
	},
];
