/**
 * Lexer for Filtron query language
 *
 * Tokenizes input strings into a stream of tokens for the parser.
 */

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
			const char = this.peek();

			// Skip whitespace
			if (char === " " || char === "\t" || char === "\n" || char === "\r") {
				this.advance();
				continue;
			}

			// Skip single-line comments: // ...
			if (char === "/" && this.peekNext() === "/") {
				this.advance(); // skip /
				this.advance(); // skip /
				while (this.pos < this.length && this.peek() !== "\n") {
					this.advance();
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
		this.advance(); // skip opening quote

		let value = "";
		while (this.pos < this.length) {
			const char = this.peek();

			if (char === '"') {
				this.advance(); // skip closing quote
				return { type: "STRING", value, start, end: this.pos };
			}

			if (char === "\\") {
				this.advance(); // skip backslash
				const escaped = this.advance();
				switch (escaped) {
					case "n":
						value += "\n";
						break;
					case "t":
						value += "\t";
						break;
					case "r":
						value += "\r";
						break;
					case "\\":
						value += "\\";
						break;
					case '"':
						value += '"';
						break;
					default:
						// Keep unknown escapes as-is
						value += escaped;
				}
				continue;
			}

			value += this.advance();
		}

		throw new LexerError("Unterminated string literal", start);
	}

	/**
	 * Read a number literal (integer or float, possibly negative)
	 */
	private readNumber(): Token {
		const start = this.pos;
		let numStr = "";

		// Handle negative sign
		if (this.peek() === "-") {
			numStr += this.advance();
		}

		// Read integer part
		while (/[0-9]/.test(this.peek())) {
			numStr += this.advance();
		}

		// Check for decimal part
		if (this.peek() === "." && /[0-9]/.test(this.peekNext())) {
			numStr += this.advance(); // the dot
			while (/[0-9]/.test(this.peek())) {
				numStr += this.advance();
			}
			return { type: "NUMBER", value: parseFloat(numStr), start, end: this.pos };
		}

		return { type: "NUMBER", value: parseInt(numStr, 10), start, end: this.pos };
	}

	/**
	 * Read an identifier or keyword
	 */
	private readIdentifier(): Token {
		const start = this.pos;
		let ident = "";

		while (this.pos < this.length) {
			const char = this.peek();
			if (/[a-zA-Z0-9_]/.test(char)) {
				ident += this.advance();
			} else {
				break;
			}
		}

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
		if (/[0-9]/.test(char) || (char === "-" && /[0-9]/.test(this.peekNext()))) {
			return this.readNumber();
		}

		// Identifier or keyword
		if (/[a-zA-Z_]/.test(char)) {
			return this.readIdentifier();
		}

		throw new LexerError(`Unexpected character: '${char}'`, this.pos);
	}

	/**
	 * Peek at the next token without consuming it
	 */
	peek_token(): Token {
		const savedPos = this.pos;
		const token = this.next();
		this.pos = savedPos;
		return token;
	}
}
