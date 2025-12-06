import { describe, expect, test } from "bun:test";
import { Lexer, LexerError, type Token, type TokenType } from "./lexer";

/**
 * Helper to tokenize a complete input string
 */
function tokenize(input: string): Token[] {
	const lexer = new Lexer(input);
	const tokens: Token[] = [];
	let token: Token;
	do {
		token = lexer.next();
		tokens.push(token);
	} while (token.type !== "EOF");
	return tokens;
}

/**
 * Helper to get token types only
 */
function tokenTypes(input: string): TokenType[] {
	return tokenize(input).map((t) => t.type);
}

describe("Lexer", () => {
	describe("Grouping and Punctuation", () => {
		test("parentheses", () => {
			expect(tokenTypes("()")).toEqual(["LPAREN", "RPAREN", "EOF"]);
		});

		test("brackets", () => {
			expect(tokenTypes("[]")).toEqual(["LBRACKET", "RBRACKET", "EOF"]);
		});

		test("comma", () => {
			expect(tokenTypes(",")).toEqual(["COMMA", "EOF"]);
		});

		test("question mark", () => {
			expect(tokenTypes("?")).toEqual(["QUESTION", "EOF"]);
		});

		test("dot", () => {
			expect(tokenTypes(".")).toEqual(["DOT", "EOF"]);
		});

		test("double dot (range)", () => {
			expect(tokenTypes("..")).toEqual(["DOTDOT", "EOF"]);
		});
	});

	describe("Operators", () => {
		test("comparison operators", () => {
			expect(tokenTypes("= != > >= < <=")).toEqual(["EQ", "NEQ", "GT", "GTE", "LT", "LTE", "EOF"]);
		});

		test("like operator", () => {
			expect(tokenTypes("~")).toEqual(["LIKE", "EOF"]);
		});

		test("colon operators", () => {
			expect(tokenTypes(": !:")).toEqual(["COLON", "NOT_COLON", "EOF"]);
		});
	});

	describe("Keywords", () => {
		test("boolean operators (lowercase)", () => {
			expect(tokenTypes("and or not")).toEqual(["AND", "OR", "NOT", "EOF"]);
		});

		test("boolean operators (uppercase)", () => {
			expect(tokenTypes("AND OR NOT")).toEqual(["AND", "OR", "NOT", "EOF"]);
		});

		test("boolean operators (mixed case)", () => {
			expect(tokenTypes("AnD oR NoT")).toEqual(["AND", "OR", "NOT", "EOF"]);
		});

		test("exists keyword", () => {
			expect(tokenTypes("exists EXISTS")).toEqual(["EXISTS", "EXISTS", "EOF"]);
		});

		test("boolean literals", () => {
			const tokens = tokenize("true false TRUE FALSE");
			expect(tokens[0]).toEqual({ type: "TRUE", value: true, start: 0, end: 4 });
			expect(tokens[1]).toEqual({ type: "FALSE", value: false, start: 5, end: 10 });
			expect(tokens[2]).toEqual({ type: "TRUE", value: true, start: 11, end: 15 });
			expect(tokens[3]).toEqual({ type: "FALSE", value: false, start: 16, end: 21 });
		});
	});

	describe("Identifiers", () => {
		test("simple identifier", () => {
			const tokens = tokenize("age");
			expect(tokens[0]).toEqual({ type: "IDENT", value: "age", start: 0, end: 3 });
		});

		test("identifier with underscore", () => {
			const tokens = tokenize("user_name");
			expect(tokens[0]).toEqual({
				type: "IDENT",
				value: "user_name",
				start: 0,
				end: 9,
			});
		});

		test("identifier with numbers", () => {
			const tokens = tokenize("field123");
			expect(tokens[0]).toEqual({
				type: "IDENT",
				value: "field123",
				start: 0,
				end: 8,
			});
		});

		test("identifier starting with underscore", () => {
			const tokens = tokenize("_private");
			expect(tokens[0]).toEqual({
				type: "IDENT",
				value: "_private",
				start: 0,
				end: 8,
			});
		});
	});

	describe("Numbers", () => {
		test("positive integer", () => {
			const tokens = tokenize("42");
			expect(tokens[0]).toEqual({ type: "NUMBER", value: 42, start: 0, end: 2 });
		});

		test("negative integer", () => {
			const tokens = tokenize("-42");
			expect(tokens[0]).toEqual({ type: "NUMBER", value: -42, start: 0, end: 3 });
		});

		test("positive float", () => {
			const tokens = tokenize("3.14");
			expect(tokens[0]).toEqual({ type: "NUMBER", value: 3.14, start: 0, end: 4 });
		});

		test("negative float", () => {
			const tokens = tokenize("-3.14");
			expect(tokens[0]).toEqual({ type: "NUMBER", value: -3.14, start: 0, end: 5 });
		});

		test("zero", () => {
			const tokens = tokenize("0");
			expect(tokens[0]).toEqual({ type: "NUMBER", value: 0, start: 0, end: 1 });
		});
	});

	describe("Strings", () => {
		test("simple string", () => {
			const tokens = tokenize('"hello"');
			expect(tokens[0]).toEqual({
				type: "STRING",
				value: "hello",
				start: 0,
				end: 7,
			});
		});

		test("empty string", () => {
			const tokens = tokenize('""');
			expect(tokens[0]).toEqual({ type: "STRING", value: "", start: 0, end: 2 });
		});

		test("string with spaces", () => {
			const tokens = tokenize('"hello world"');
			expect(tokens[0]).toEqual({
				type: "STRING",
				value: "hello world",
				start: 0,
				end: 13,
			});
		});

		test("string with escaped quote", () => {
			const tokens = tokenize('"say \\"hi\\""');
			expect(tokens[0]).toEqual({
				type: "STRING",
				value: 'say "hi"',
				start: 0,
				end: 12,
			});
		});

		test("string with escaped backslash", () => {
			const tokens = tokenize('"path\\\\to\\\\file"');
			expect(tokens[0]).toEqual({
				type: "STRING",
				value: "path\\to\\file",
				start: 0,
				end: 16,
			});
		});

		test("string with escape sequences", () => {
			const tokens = tokenize('"line1\\nline2\\ttab"');
			expect(tokens[0]).toEqual({
				type: "STRING",
				value: "line1\nline2\ttab",
				start: 0,
				end: 19,
			});
		});

		test("unterminated string throws error", () => {
			const lexer = new Lexer('"unterminated');
			expect(() => lexer.next()).toThrow(LexerError);
			try {
				const lexer2 = new Lexer('"unterminated');
				lexer2.next();
			} catch (error) {
				expect(error).toBeInstanceOf(LexerError);
				expect((error as Error).message).toBe("Unterminated string literal");
			}
		});
	});

	describe("Whitespace and Comments", () => {
		test("skips spaces", () => {
			expect(tokenTypes("a    b")).toEqual(["IDENT", "IDENT", "EOF"]);
		});

		test("skips tabs", () => {
			expect(tokenTypes("a\t\tb")).toEqual(["IDENT", "IDENT", "EOF"]);
		});

		test("skips newlines", () => {
			expect(tokenTypes("a\n\nb")).toEqual(["IDENT", "IDENT", "EOF"]);
		});

		test("skips single-line comments", () => {
			expect(tokenTypes("a // comment\nb")).toEqual(["IDENT", "IDENT", "EOF"]);
		});

		test("comment at end of input", () => {
			expect(tokenTypes("a // comment")).toEqual(["IDENT", "EOF"]);
		});

		test("multiple comments", () => {
			expect(tokenTypes("a // comment 1\n// comment 2\nb")).toEqual(["IDENT", "IDENT", "EOF"]);
		});
	});

	describe("Complex Expressions", () => {
		test("dotted field name", () => {
			expect(tokenTypes("user.age")).toEqual(["IDENT", "DOT", "IDENT", "EOF"]);
		});

		test("comparison expression", () => {
			expect(tokenTypes("age > 18")).toEqual(["IDENT", "GT", "NUMBER", "EOF"]);
		});

		test("range expression", () => {
			expect(tokenTypes("age = 18..65")).toEqual([
				"IDENT",
				"EQ",
				"NUMBER",
				"DOTDOT",
				"NUMBER",
				"EOF",
			]);
		});

		test("array expression", () => {
			expect(tokenTypes('status : ["active", "pending"]')).toEqual([
				"IDENT",
				"COLON",
				"LBRACKET",
				"STRING",
				"COMMA",
				"STRING",
				"RBRACKET",
				"EOF",
			]);
		});

		test("boolean expression", () => {
			expect(tokenTypes("a AND b OR NOT c")).toEqual([
				"IDENT",
				"AND",
				"IDENT",
				"OR",
				"NOT",
				"IDENT",
				"EOF",
			]);
		});
	});

	describe("Error Handling", () => {
		test("unexpected character", () => {
			const lexer = new Lexer("@");
			expect(() => lexer.next()).toThrow(LexerError);
			expect(() => lexer.next()).toThrow("Unexpected character: '@'");
		});

		test("error includes position", () => {
			const lexer = new Lexer("valid @");
			lexer.next(); // consume 'valid'
			try {
				lexer.next();
				expect(true).toBe(false); // should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(LexerError);
				expect((error as LexerError).position).toBe(6);
			}
		});
	});

	describe("EOF Token", () => {
		test("empty input returns EOF", () => {
			const tokens = tokenize("");
			expect(tokens).toEqual([{ type: "EOF", value: "", start: 0, end: 0 }]);
		});

		test("EOF at end of input", () => {
			const tokens = tokenize("a");
			expect(tokens[tokens.length - 1].type).toBe("EOF");
		});

		test("multiple calls return EOF", () => {
			const lexer = new Lexer("a");
			lexer.next(); // consume 'a'
			const eof1 = lexer.next();
			const eof2 = lexer.next();
			expect(eof1.type).toBe("EOF");
			expect(eof2.type).toBe("EOF");
		});
	});

	describe("Token Positions", () => {
		test("single token positions", () => {
			const tokens = tokenize("hello");
			expect(tokens[0].start).toBe(0);
			expect(tokens[0].end).toBe(5);
		});

		test("multiple token positions", () => {
			const tokens = tokenize("a = b");
			expect(tokens[0]).toMatchObject({ start: 0, end: 1 }); // a
			expect(tokens[1]).toMatchObject({ start: 2, end: 3 }); // =
			expect(tokens[2]).toMatchObject({ start: 4, end: 5 }); // b
		});

		test("string token positions include quotes", () => {
			const tokens = tokenize('"test"');
			expect(tokens[0].start).toBe(0);
			expect(tokens[0].end).toBe(6);
		});
	});
});
