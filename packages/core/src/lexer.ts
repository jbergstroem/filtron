/**
 * A Lexer for the Filtron query language
 */

/**
 * Token types produced by the lexer
 */
export type TokenType =
	| "LPAREN"
	| "RPAREN"
	| "LBRACKET"
	| "RBRACKET"
	| "COMMA"
	| "QUESTION"
	| "DOT"
	| "DOTDOT"
	| "AND"
	| "OR"
	| "NOT"
	| "EXISTS"
	| "TRUE"
	| "FALSE"
	| "EQ"
	| "NEQ"
	| "GT"
	| "GTE"
	| "LT"
	| "LTE"
	| "LIKE"
	| "COLON"
	| "NOT_COLON"
	| "STRING"
	| "NUMBER"
	| "IDENT"
	| "EOF";

/** Base token properties */
interface TokenBase {
	start: number;
	end: number;
}

/** Tokens with string values (string literals and identifiers) */
export interface StringToken extends TokenBase {
	type: "STRING" | "IDENT";
	value: string;
}

/** Tokens without values (operators, punctuation, keywords, EOF) */
export interface SymbolToken extends TokenBase {
	type:
		| "LPAREN"
		| "RPAREN"
		| "LBRACKET"
		| "RBRACKET"
		| "COMMA"
		| "QUESTION"
		| "DOT"
		| "DOTDOT"
		| "AND"
		| "OR"
		| "NOT"
		| "EXISTS"
		| "EQ"
		| "NEQ"
		| "GT"
		| "GTE"
		| "LT"
		| "LTE"
		| "LIKE"
		| "COLON"
		| "NOT_COLON"
		| "EOF";
}

/** Tokens with number values */
export interface NumberToken extends TokenBase {
	type: "NUMBER";
	value: number;
}

/** Tokens with boolean values */
export interface BooleanToken extends TokenBase {
	type: "TRUE" | "FALSE";
	value: boolean;
}

/**
 * Discriminated union of all token types for proper type narrowing
 */
export type Token = StringToken | NumberToken | BooleanToken | SymbolToken;

// Character codes
const C = {
	Tab: 9,
	Newline: 10,
	CarriageReturn: 13,
	Space: 32,
	Bang: 33,
	Quote: 34,
	LParen: 40,
	RParen: 41,
	Comma: 44,
	Minus: 45,
	Dot: 46,
	Slash: 47,
	Zero: 48,
	Nine: 57,
	Colon: 58,
	LessThan: 60,
	Equals: 61,
	GreaterThan: 62,
	Question: 63,
	UpperA: 65,
	UpperZ: 90,
	LBracket: 91,
	Backslash: 92,
	RBracket: 93,
	Underscore: 95,
	LowerA: 97,
	LowerN: 110,
	LowerR: 114,
	LowerT: 116,
	LowerZ: 122,
	Tilde: 126,
} as const;

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
	 * Read a string literal - fast path for no escapes
	 */
	private readString(): Token {
		const input = this.input;
		const length = this.length;
		const start = this.pos;
		let pos = this.pos + 1; // skip opening quote

		// Fast path: scan for closing quote or backslash
		let hasEscape = false;
		const scanStart = pos;
		while (pos < length) {
			const code = input.charCodeAt(pos);
			if (code === C.Quote) {
				// No escapes - just slice
				this.pos = pos + 1;
				return {
					type: "STRING",
					value: input.slice(scanStart, pos),
					start,
					end: this.pos,
				};
			}
			if (code === C.Backslash) {
				hasEscape = true;
				break;
			}
			pos++;
		}

		// Slow path: handle escapes
		if (hasEscape) {
			pos = scanStart;
			let result = "";
			let chunkStart = pos;

			while (pos < length) {
				const code = input.charCodeAt(pos);

				if (code === C.Quote) {
					result += input.slice(chunkStart, pos);
					this.pos = pos + 1;
					return { type: "STRING", value: result, start, end: this.pos };
				}

				if (code === C.Backslash) {
					result += input.slice(chunkStart, pos);
					pos++;
					const escaped = input.charCodeAt(pos);
					pos++;
					switch (escaped) {
						case C.LowerN:
							result += "\n";
							break;
						case C.LowerT:
							result += "\t";
							break;
						case C.LowerR:
							result += "\r";
							break;
						case C.Backslash:
							result += "\\";
							break;
						case C.Quote:
							result += '"';
							break;
						default:
							result += String.fromCharCode(escaped);
					}
					chunkStart = pos;
					continue;
				}

				pos++;
			}
		}

		throw new LexerError("Unterminated string literal", start);
	}

	/**
	 * Read a number literal
	 */
	private readNumber(): Token {
		const input = this.input;
		const length = this.length;
		const start = this.pos;
		let pos = this.pos;

		// Handle negative sign
		let negative = false;
		if (input.charCodeAt(pos) === C.Minus) {
			negative = true;
			pos++;
		}

		// Read integer part directly
		let value = 0;
		while (pos < length) {
			const code = input.charCodeAt(pos);
			if (code < C.Zero || code > C.Nine) break;
			value = value * 10 + (code - C.Zero);
			pos++;
		}

		// Check for decimal
		if (pos < length && input.charCodeAt(pos) === C.Dot && pos + 1 < length) {
			const nextCode = input.charCodeAt(pos + 1);
			if (nextCode >= C.Zero && nextCode <= C.Nine) {
				pos++; // skip dot
				let fraction = 0;
				let divisor = 1;
				while (pos < length) {
					const code = input.charCodeAt(pos);
					if (code < C.Zero || code > C.Nine) break;
					fraction = fraction * 10 + (code - C.Zero);
					divisor *= 10;
					pos++;
				}
				this.pos = pos;
				const floatValue = value + fraction / divisor;
				return {
					type: "NUMBER",
					value: negative ? -floatValue : floatValue,
					start,
					end: pos,
				};
			}
		}

		this.pos = pos;
		return {
			type: "NUMBER",
			value: negative ? -value : value,
			start,
			end: pos,
		};
	}

	/**
	 * Read identifier with fast keyword detection
	 */
	private readIdentifier(): Token {
		const input = this.input;
		const length = this.length;
		const start = this.pos;
		let pos = this.pos;

		// Read all alphanumeric characters
		while (pos < length) {
			const code = input.charCodeAt(pos);
			if (
				(code >= C.LowerA && code <= C.LowerZ) ||
				(code >= C.UpperA && code <= C.UpperZ) ||
				(code >= C.Zero && code <= C.Nine) ||
				code === C.Underscore
			) {
				pos++;
			} else {
				break;
			}
		}

		this.pos = pos;
		const len = pos - start;

		// Keyword detection based on length and first char
		if (len >= 2 && len <= 6) {
			const firstCode = input.charCodeAt(start) | 0x20; // lowercase

			if (len === 2) {
				// "or"
				if (firstCode === 111 && (input.charCodeAt(start + 1) | 0x20) === 114) {
					return { type: "OR", start, end: pos };
				}
			} else if (len === 3) {
				// "and", "not"
				if (firstCode === 97) {
					// 'a'
					if (
						(input.charCodeAt(start + 1) | 0x20) === 110 &&
						(input.charCodeAt(start + 2) | 0x20) === 100
					) {
						return { type: "AND", start, end: pos };
					}
				} else if (firstCode === 110) {
					// 'n'
					if (
						(input.charCodeAt(start + 1) | 0x20) === 111 &&
						(input.charCodeAt(start + 2) | 0x20) === 116
					) {
						return { type: "NOT", start, end: pos };
					}
				}
			} else if (len === 4) {
				// "true"
				if (firstCode === 116) {
					// 't'
					if (
						(input.charCodeAt(start + 1) | 0x20) === 114 &&
						(input.charCodeAt(start + 2) | 0x20) === 117 &&
						(input.charCodeAt(start + 3) | 0x20) === 101
					) {
						return { type: "TRUE", value: true, start, end: pos };
					}
				}
			} else if (len === 5) {
				// "false"
				if (firstCode === 102) {
					// 'f'
					if (
						(input.charCodeAt(start + 1) | 0x20) === 97 &&
						(input.charCodeAt(start + 2) | 0x20) === 108 &&
						(input.charCodeAt(start + 3) | 0x20) === 115 &&
						(input.charCodeAt(start + 4) | 0x20) === 101
					) {
						return { type: "FALSE", value: false, start, end: pos };
					}
				}
			} else if (len === 6) {
				// "exists"
				if (firstCode === 101) {
					// 'e'
					if (
						(input.charCodeAt(start + 1) | 0x20) === 120 &&
						(input.charCodeAt(start + 2) | 0x20) === 105 &&
						(input.charCodeAt(start + 3) | 0x20) === 115 &&
						(input.charCodeAt(start + 4) | 0x20) === 116 &&
						(input.charCodeAt(start + 5) | 0x20) === 115
					) {
						return { type: "EXISTS", start, end: pos };
					}
				}
			}
		}

		return { type: "IDENT", value: input.slice(start, pos), start, end: pos };
	}

	/**
	 * Get the next token
	 */
	next(): Token {
		const input = this.input;
		const length = this.length;

		let pos = this.pos;
		while (pos < length) {
			const c = input.charCodeAt(pos);
			if (c === C.Space || c === C.Tab || c === C.Newline || c === C.CarriageReturn) {
				pos++;
				continue;
			}
			if (c === C.Slash && pos + 1 < length && input.charCodeAt(pos + 1) === C.Slash) {
				pos += 2;
				while (pos < length && input.charCodeAt(pos) !== C.Newline) {
					pos++;
				}
				continue;
			}
			break;
		}
		this.pos = pos;

		if (pos >= this.length) {
			return { type: "EOF", start: pos, end: pos };
		}

		const code = input.charCodeAt(pos);

		// Single character tokens (most common first)
		switch (code) {
			case C.LParen:
				this.pos = pos + 1;
				return { type: "LPAREN", start: pos, end: pos + 1 };
			case C.RParen:
				this.pos = pos + 1;
				return { type: "RPAREN", start: pos, end: pos + 1 };
			case C.LBracket:
				this.pos = pos + 1;
				return { type: "LBRACKET", start: pos, end: pos + 1 };
			case C.RBracket:
				this.pos = pos + 1;
				return { type: "RBRACKET", start: pos, end: pos + 1 };
			case C.Comma:
				this.pos = pos + 1;
				return { type: "COMMA", start: pos, end: pos + 1 };
			case C.Question:
				this.pos = pos + 1;
				return { type: "QUESTION", start: pos, end: pos + 1 };
			case C.Equals:
				this.pos = pos + 1;
				return { type: "EQ", start: pos, end: pos + 1 };
			case C.Tilde:
				this.pos = pos + 1;
				return { type: "LIKE", start: pos, end: pos + 1 };
			case C.Colon:
				this.pos = pos + 1;
				return { type: "COLON", start: pos, end: pos + 1 };
		}

		// Two-character operators
		const nextCode = pos + 1 < this.length ? input.charCodeAt(pos + 1) : 0;

		if (code === C.Bang) {
			if (nextCode === C.Equals) {
				this.pos = pos + 2;
				return { type: "NEQ", start: pos, end: pos + 2 };
			}
			if (nextCode === C.Colon) {
				this.pos = pos + 2;
				return { type: "NOT_COLON", start: pos, end: pos + 2 };
			}
		}

		if (code === C.GreaterThan) {
			if (nextCode === C.Equals) {
				this.pos = pos + 2;
				return { type: "GTE", start: pos, end: pos + 2 };
			}
			this.pos = pos + 1;
			return { type: "GT", start: pos, end: pos + 1 };
		}

		if (code === C.LessThan) {
			if (nextCode === C.Equals) {
				this.pos = pos + 2;
				return { type: "LTE", start: pos, end: pos + 2 };
			}
			this.pos = pos + 1;
			return { type: "LT", start: pos, end: pos + 1 };
		}

		if (code === C.Dot) {
			if (nextCode === C.Dot) {
				this.pos = pos + 2;
				return { type: "DOTDOT", start: pos, end: pos + 2 };
			}
			this.pos = pos + 1;
			return { type: "DOT", start: pos, end: pos + 1 };
		}

		// String literal
		if (code === C.Quote) {
			return this.readString();
		}

		// Number
		if (code >= C.Zero && code <= C.Nine) {
			return this.readNumber();
		}
		if (code === C.Minus && nextCode >= C.Zero && nextCode <= C.Nine) {
			return this.readNumber();
		}

		// Identifier or keyword
		if (
			(code >= C.LowerA && code <= C.LowerZ) ||
			(code >= C.UpperA && code <= C.UpperZ) ||
			code === C.Underscore
		) {
			return this.readIdentifier();
		}

		throw new LexerError(`Unexpected character: '${input[pos]}'`, pos);
	}
}
