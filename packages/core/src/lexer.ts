/**
 * Lexer for Filtron query language
 *
 * Tokenizes input strings into a stream of tokens for the parser.
 */

/**
 * Fast character type checking using char codes
 */
const isDigit = (char: string): boolean => {
	const code = char.charCodeAt(0);
	return code >= 48 && code <= 57; // 0-9
};

const isAlpha = (char: string): boolean => {
	const code = char.charCodeAt(0);
	return (
		(code >= 65 && code <= 90) || // A-Z
		(code >= 97 && code <= 122) || // a-z
		code === 95
	); // _
};

const isAlphaNum = (char: string): boolean => {
	const code = char.charCodeAt(0);
	return (
		(code >= 48 && code <= 57) || // 0-9
		(code >= 65 && code <= 90) || // A-Z
		(code >= 97 && code <= 122) || // a-z
		code === 95
	); // _
};

/**
 * Token types produced by the lexer
 */
export type TokenType =
	// Grouping
	| "LPAREN"
	| "RPAREN"
	| "LBRACKET"
	| "RBRACKET"
	// Punctuation
	| "COMMA"
	| "QUESTION"
	| "DOT"
	| "DOTDOT"
	// Keywords (case-insensitive)
	| "AND"
	| "OR"
	| "NOT"
	| "EXISTS"
	| "TRUE"
	| "FALSE"
	// Operators
	| "EQ" // =
	| "NEQ" // !=
	| "GT" // >
	| "GTE" // >=
	| "LT" // <
	| "LTE" // <=
	| "LIKE" // ~
	| "COLON" // :
	| "NOT_COLON" // !:
	// Literals
	| "STRING"
	| "NUMBER"
	| "IDENT"
	// End of input
	| "EOF";

/**
 * A token produced by the lexer
 */
export interface Token {
	type: TokenType;
	value: string | number | boolean;
	start: number;
	end: number;
}

/**
 * Keywords mapped to their token types
 */
const KEYWORDS: Record<string, TokenType> = {
	and: "AND",
	or: "OR",
	not: "NOT",
	exists: "EXISTS",
	true: "TRUE",
	false: "FALSE",
};

/**
 * Lexer error with position information
 */
export class LexerError extends Error {
	constructor(
		message: string,
		public position: number,
	) {
		super(message);
		this.name = "LexerError";
	}
}

/**
 * Lexer for tokenizing Filtron query strings
 */
export class Lexer {
	private pos = 0;
	private readonly input: string;
	private readonly length: number;

	constructor(input: string) {
		this.input = input;
		this.length = input.length;
	}

	/**
	 * Get the current character without advancing
	 */
	private peek(): string {
		return this.pos < this.length ? this.input[this.pos] : "";
	}

	/**
	 * Get the next character without advancing
	 */
	private peekNext(): string {
		return this.pos + 1 < this.length ? this.input[this.pos + 1] : "";
	}

	/**
	 * Advance and return the current character
	 */
	private advance(): string {
		return this.pos < this.length ? this.input[this.pos++] : "";
	}

	/**
	 * Skip whitespace and comments
	 */
	private skipWhitespaceAndComments(): void {
		while (this.pos < this.length) {
			const code = this.input.charCodeAt(this.pos);

			// Skip whitespace (space=32, tab=9, newline=10, carriage=13)
			if (code === 32 || code === 9 || code === 10 || code === 13) {
				this.pos++;
				continue;
			}

			// Skip single-line comments: // ...
			if (code === 47 && this.pos + 1 < this.length && this.input.charCodeAt(this.pos + 1) === 47) {
				this.pos += 2; // skip //
				while (this.pos < this.length && this.input.charCodeAt(this.pos) !== 10) {
					this.pos++;
				}
				continue;
			}

			break;
		}
	}

	/**
	 * Read a string literal (double-quoted)
	 */
	private readString(): Token {
		const start = this.pos;
		this.pos++; // skip opening quote

		const chars: string[] = [];
		let lastPos = this.pos;

		while (this.pos < this.length) {
			const char = this.input[this.pos];

			if (char === '"') {
				// Flush remaining characters
				if (lastPos < this.pos) {
					chars.push(this.input.slice(lastPos, this.pos));
				}
				this.pos++; // skip closing quote
				return {
					type: "STRING",
					value: chars.join(""),
					start,
					end: this.pos,
				};
			}

			if (char === "\\") {
				// Flush accumulated characters before escape
				if (lastPos < this.pos) {
					chars.push(this.input.slice(lastPos, this.pos));
				}
				this.pos++; // skip backslash

				const escaped = this.input[this.pos++];
				switch (escaped) {
					case "n":
						chars.push("\n");
						break;
					case "t":
						chars.push("\t");
						break;
					case "r":
						chars.push("\r");
						break;
					case "\\":
						chars.push("\\");
						break;
					case '"':
						chars.push('"');
						break;
					default:
						// Keep unknown escapes as-is
						chars.push(escaped);
				}
				lastPos = this.pos;
				continue;
			}

			this.pos++;
		}

		throw new LexerError("Unterminated string literal", start);
	}

	/**
	 * Read a number literal (integer or float, possibly negative)
	 */
	private readNumber(): Token {
		const start = this.pos;

		// Handle negative sign
		if (this.peek() === "-") {
			this.pos++;
		}

		// Read integer part
		while (this.pos < this.length && isDigit(this.input[this.pos])) {
			this.pos++;
		}

		// Check for decimal part
		if (
			this.pos < this.length &&
			this.input[this.pos] === "." &&
			this.pos + 1 < this.length &&
			isDigit(this.input[this.pos + 1])
		) {
			this.pos++; // skip dot
			while (this.pos < this.length && isDigit(this.input[this.pos])) {
				this.pos++;
			}
			return {
				type: "NUMBER",
				value: parseFloat(this.input.slice(start, this.pos)),
				start,
				end: this.pos,
			};
		}

		return {
			type: "NUMBER",
			value: parseInt(this.input.slice(start, this.pos), 10),
			start,
			end: this.pos,
		};
	}

	/**
	 * Read an identifier or keyword
	 */
	private readIdentifier(): Token {
		const start = this.pos;

		// Read all alphanumeric characters
		while (this.pos < this.length && isAlphaNum(this.input[this.pos])) {
			this.pos++;
		}

		const ident = this.input.slice(start, this.pos);

		// Check if it's a keyword
		const lower = ident.toLowerCase();
		const keywordType = KEYWORDS[lower];
		if (keywordType) {
			if (keywordType === "TRUE") {
				return { type: "TRUE", value: true, start, end: this.pos };
			}
			if (keywordType === "FALSE") {
				return { type: "FALSE", value: false, start, end: this.pos };
			}
			return { type: keywordType, value: lower, start, end: this.pos };
		}

		return { type: "IDENT", value: ident, start, end: this.pos };
	}

	/**
	 * Get the next token
	 */
	next(): Token {
		this.skipWhitespaceAndComments();

		if (this.pos >= this.length) {
			return { type: "EOF", value: "", start: this.pos, end: this.pos };
		}

		const start = this.pos;
		const char = this.peek();

		// Single character tokens
		switch (char) {
			case "(":
				this.advance();
				return { type: "LPAREN", value: "(", start, end: this.pos };
			case ")":
				this.advance();
				return { type: "RPAREN", value: ")", start, end: this.pos };
			case "[":
				this.advance();
				return { type: "LBRACKET", value: "[", start, end: this.pos };
			case "]":
				this.advance();
				return { type: "RBRACKET", value: "]", start, end: this.pos };
			case ",":
				this.advance();
				return { type: "COMMA", value: ",", start, end: this.pos };
			case "?":
				this.advance();
				return { type: "QUESTION", value: "?", start, end: this.pos };
		}

		// Two-character operators (check these before single-char versions)
		if (char === "!" && this.peekNext() === "=") {
			this.advance();
			this.advance();
			return { type: "NEQ", value: "!=", start, end: this.pos };
		}
		if (char === "!" && this.peekNext() === ":") {
			this.advance();
			this.advance();
			return { type: "NOT_COLON", value: "!:", start, end: this.pos };
		}
		if (char === ">" && this.peekNext() === "=") {
			this.advance();
			this.advance();
			return { type: "GTE", value: ">=", start, end: this.pos };
		}
		if (char === "<" && this.peekNext() === "=") {
			this.advance();
			this.advance();
			return { type: "LTE", value: "<=", start, end: this.pos };
		}
		if (char === "." && this.peekNext() === ".") {
			this.advance();
			this.advance();
			return { type: "DOTDOT", value: "..", start, end: this.pos };
		}

		// Single character operators
		switch (char) {
			case ".":
				this.advance();
				return { type: "DOT", value: ".", start, end: this.pos };
			case "=":
				this.advance();
				return { type: "EQ", value: "=", start, end: this.pos };
			case ">":
				this.advance();
				return { type: "GT", value: ">", start, end: this.pos };
			case "<":
				this.advance();
				return { type: "LT", value: "<", start, end: this.pos };
			case "~":
				this.advance();
				return { type: "LIKE", value: "~", start, end: this.pos };
			case ":":
				this.advance();
				return { type: "COLON", value: ":", start, end: this.pos };
		}

		// String literal
		if (char === '"') {
			return this.readString();
		}

		// Number (including negative numbers)
		if (
			isDigit(char) ||
			(char === "-" && this.pos + 1 < this.length && isDigit(this.input[this.pos + 1]))
		) {
			return this.readNumber();
		}

		// Identifier or keyword
		if (isAlpha(char)) {
			return this.readIdentifier();
		}

		throw new LexerError(`Unexpected character: '${char}'`, this.pos);
	}
}
