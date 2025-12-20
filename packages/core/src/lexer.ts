/**
 * Optimized Lexer for Filtron query language
 *
 * Optimizations:
 * - Works with char codes directly (avoids string creation)
 * - Lookup table for character classification
 * - Inlined hot paths
 * - Fast keyword detection
 * - Fast path for strings without escapes
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

/**
 * The generic token produced by the lexer
 */
export interface Token {
	type: TokenType;
	value: string | number | boolean;
	start: number;
	end: number;
}

// Character codes
const enum CharCode {
	Tab = 9,
	Newline = 10,
	CarriageReturn = 13,
	Space = 32,
	Bang = 33, // !
	Quote = 34, // "
	Dot = 46, // .
	Slash = 47, // /
	Zero = 48,
	Nine = 57,
	Colon = 58, // :
	LessThan = 60, // <
	Equals = 61, // =
	GreaterThan = 62, // >
	Question = 63, // ?
	UpperA = 65,
	UpperZ = 90,
	LBracket = 91, // [
	Backslash = 92, // \
	RBracket = 93, // ]
	Underscore = 95, // _
	LowerA = 97,
	LowerZ = 122,
	Tilde = 126, // ~
	LParen = 40, // (
	RParen = 41, // )
	Comma = 44, // ,
	Minus = 45, // -
	LowerN = 110,
	LowerR = 114,
	LowerT = 116,
}

// Character classification lookup table (0-127)
const enum CharClass {
	Other = 0,
	Whitespace = 1,
	Digit = 2,
	Alpha = 4,
	AlphaNum = 6, // Alpha | Digit
}

// Build lookup table at module load
const charClass = new Uint8Array(128);
for (let i = 0; i < 128; i++) {
	if (i === CharCode.Space || i === CharCode.Tab || i === CharCode.Newline || i === CharCode.CarriageReturn) {
		charClass[i] = CharClass.Whitespace;
	} else if (i >= CharCode.Zero && i <= CharCode.Nine) {
		charClass[i] = CharClass.Digit;
	} else if ((i >= CharCode.UpperA && i <= CharCode.UpperZ) || (i >= CharCode.LowerA && i <= CharCode.LowerZ) || i === CharCode.Underscore) {
		charClass[i] = CharClass.Alpha;
	}
}

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
 * Optimized Lexer for tokenizing Filtron query strings
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
	 * Skip whitespace and comments (inlined for performance)
	 */
	private skipWhitespace(): void {
		const input = this.input;
		const length = this.length;
		let pos = this.pos;

		while (pos < length) {
			const code = input.charCodeAt(pos);

			// Fast whitespace check
			if (code === CharCode.Space || code === CharCode.Tab || code === CharCode.Newline || code === CharCode.CarriageReturn) {
				pos++;
				continue;
			}

			// Comment check
			if (code === CharCode.Slash && pos + 1 < length && input.charCodeAt(pos + 1) === CharCode.Slash) {
				pos += 2;
				while (pos < length && input.charCodeAt(pos) !== CharCode.Newline) {
					pos++;
				}
				continue;
			}

			break;
		}

		this.pos = pos;
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
			if (code === CharCode.Quote) {
				// No escapes - just slice
				this.pos = pos + 1;
				return {
					type: "STRING",
					value: input.slice(scanStart, pos),
					start,
					end: this.pos,
				};
			}
			if (code === CharCode.Backslash) {
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

				if (code === CharCode.Quote) {
					result += input.slice(chunkStart, pos);
					this.pos = pos + 1;
					return { type: "STRING", value: result, start, end: this.pos };
				}

				if (code === CharCode.Backslash) {
					result += input.slice(chunkStart, pos);
					pos++;
					const escaped = input.charCodeAt(pos);
					pos++;
					switch (escaped) {
						case CharCode.LowerN:
							result += "\n";
							break;
						case CharCode.LowerT:
							result += "\t";
							break;
						case CharCode.LowerR:
							result += "\r";
							break;
						case CharCode.Backslash:
							result += "\\";
							break;
						case CharCode.Quote:
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
		if (input.charCodeAt(pos) === CharCode.Minus) {
			pos++;
		}

		// Read integer part
		while (pos < length) {
			const code = input.charCodeAt(pos);
			if (code < CharCode.Zero || code > CharCode.Nine) break;
			pos++;
		}

		// Check for decimal
		if (
			pos < length &&
			input.charCodeAt(pos) === CharCode.Dot &&
			pos + 1 < length
		) {
			const nextCode = input.charCodeAt(pos + 1);
			if (nextCode >= CharCode.Zero && nextCode <= CharCode.Nine) {
				pos++; // skip dot
				while (pos < length) {
					const code = input.charCodeAt(pos);
					if (code < CharCode.Zero || code > CharCode.Nine) break;
					pos++;
				}
				this.pos = pos;
				return {
					type: "NUMBER",
					value: parseFloat(input.slice(start, pos)),
					start,
					end: pos,
				};
			}
		}

		this.pos = pos;
		return {
			type: "NUMBER",
			value: parseInt(input.slice(start, pos), 10),
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
				(code >= CharCode.LowerA && code <= CharCode.LowerZ) ||
				(code >= CharCode.UpperA && code <= CharCode.UpperZ) ||
				(code >= CharCode.Zero && code <= CharCode.Nine) ||
				code === CharCode.Underscore
			) {
				pos++;
			} else {
				break;
			}
		}

		this.pos = pos;
		const len = pos - start;

		// Fast keyword detection based on length and first char
		if (len >= 2 && len <= 6) {
			const firstCode = input.charCodeAt(start) | 0x20; // lowercase

			if (len === 2) {
				// "or"
				if (firstCode === 111 && (input.charCodeAt(start + 1) | 0x20) === 114) {
					return { type: "OR", value: "or", start, end: pos };
				}
			} else if (len === 3) {
				// "and", "not"
				if (firstCode === 97) {
					// 'a'
					if ((input.charCodeAt(start + 1) | 0x20) === 110 && (input.charCodeAt(start + 2) | 0x20) === 100) {
						return { type: "AND", value: "and", start, end: pos };
					}
				} else if (firstCode === 110) {
					// 'n'
					if ((input.charCodeAt(start + 1) | 0x20) === 111 && (input.charCodeAt(start + 2) | 0x20) === 116) {
						return { type: "NOT", value: "not", start, end: pos };
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
						return { type: "EXISTS", value: "exists", start, end: pos };
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
		this.skipWhitespace();

		const input = this.input;
		const pos = this.pos;

		if (pos >= this.length) {
			return { type: "EOF", value: "", start: pos, end: pos };
		}

		const code = input.charCodeAt(pos);

		// Single character tokens (most common first)
		switch (code) {
			case CharCode.LParen:
				this.pos = pos + 1;
				return { type: "LPAREN", value: "(", start: pos, end: pos + 1 };
			case CharCode.RParen:
				this.pos = pos + 1;
				return { type: "RPAREN", value: ")", start: pos, end: pos + 1 };
			case CharCode.LBracket:
				this.pos = pos + 1;
				return { type: "LBRACKET", value: "[", start: pos, end: pos + 1 };
			case CharCode.RBracket:
				this.pos = pos + 1;
				return { type: "RBRACKET", value: "]", start: pos, end: pos + 1 };
			case CharCode.Comma:
				this.pos = pos + 1;
				return { type: "COMMA", value: ",", start: pos, end: pos + 1 };
			case CharCode.Question:
				this.pos = pos + 1;
				return { type: "QUESTION", value: "?", start: pos, end: pos + 1 };
			case CharCode.Equals:
				this.pos = pos + 1;
				return { type: "EQ", value: "=", start: pos, end: pos + 1 };
			case CharCode.Tilde:
				this.pos = pos + 1;
				return { type: "LIKE", value: "~", start: pos, end: pos + 1 };
			case CharCode.Colon:
				this.pos = pos + 1;
				return { type: "COLON", value: ":", start: pos, end: pos + 1 };
		}

		// Two-character operators
		const nextCode = pos + 1 < this.length ? input.charCodeAt(pos + 1) : 0;

		if (code === CharCode.Bang) {
			if (nextCode === CharCode.Equals) {
				this.pos = pos + 2;
				return { type: "NEQ", value: "!=", start: pos, end: pos + 2 };
			}
			if (nextCode === CharCode.Colon) {
				this.pos = pos + 2;
				return { type: "NOT_COLON", value: "!:", start: pos, end: pos + 2 };
			}
		}

		if (code === CharCode.GreaterThan) {
			if (nextCode === CharCode.Equals) {
				this.pos = pos + 2;
				return { type: "GTE", value: ">=", start: pos, end: pos + 2 };
			}
			this.pos = pos + 1;
			return { type: "GT", value: ">", start: pos, end: pos + 1 };
		}

		if (code === CharCode.LessThan) {
			if (nextCode === CharCode.Equals) {
				this.pos = pos + 2;
				return { type: "LTE", value: "<=", start: pos, end: pos + 2 };
			}
			this.pos = pos + 1;
			return { type: "LT", value: "<", start: pos, end: pos + 1 };
		}

		if (code === CharCode.Dot) {
			if (nextCode === CharCode.Dot) {
				this.pos = pos + 2;
				return { type: "DOTDOT", value: "..", start: pos, end: pos + 2 };
			}
			this.pos = pos + 1;
			return { type: "DOT", value: ".", start: pos, end: pos + 1 };
		}

		// String literal
		if (code === CharCode.Quote) {
			return this.readString();
		}

		// Number
		if (code >= CharCode.Zero && code <= CharCode.Nine) {
			return this.readNumber();
		}
		if (code === CharCode.Minus && nextCode >= CharCode.Zero && nextCode <= CharCode.Nine) {
			return this.readNumber();
		}

		// Identifier or keyword
		if (
			(code >= CharCode.LowerA && code <= CharCode.LowerZ) ||
			(code >= CharCode.UpperA && code <= CharCode.UpperZ) ||
			code === CharCode.Underscore
		) {
			return this.readIdentifier();
		}

		throw new LexerError(`Unexpected character: '${input[pos]}'`, pos);
	}
}
