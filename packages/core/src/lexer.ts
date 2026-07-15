/**
 * A Lexer for the Filtron query language
 */

import { FiltronParseError } from "./errors";
import type { DateValue, NowValue, TemporalPoint, TemporalRangeValue } from "./types";

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
	| "MINUS"
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
	| "TEMPORAL"
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
		| "MINUS"
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

/** Temporal literal tokens: the scanner builds the finished value */
export interface TemporalToken extends TokenBase {
	type: "TEMPORAL";
	value: DateValue | NowValue | TemporalRangeValue;
}

/**
 * Discriminated union of all token types for proper type narrowing
 */
export type Token = StringToken | NumberToken | BooleanToken | TemporalToken | SymbolToken;

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
	At: 64,
	UpperA: 65,
	Plus: 43,
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
 * Character dispatch classes for next(). Dense small integers so the
 * dispatch switch compiles to a jump table instead of a compare chain.
 */
const CLS_INVALID = 0;
const CLS_IDENT = 1;
const CLS_DIGIT = 2;
const CLS_QUOTE = 3;
const CLS_MINUS = 4;
const CLS_BANG = 5;
const CLS_GT = 6;
const CLS_LT = 7;
const CLS_DOT = 8;
const CLS_LPAREN = 9;
const CLS_RPAREN = 10;
const CLS_LBRACKET = 11;
const CLS_RBRACKET = 12;
const CLS_COMMA = 13;
const CLS_QUESTION = 14;
const CLS_EQ = 15;
const CLS_TILDE = 16;
const CLS_COLON = 17;
const CLS_AT = 18;

const CHAR_CLASS: Uint8Array = (() => {
	const table = new Uint8Array(128);
	for (let c = C.LowerA; c <= C.LowerZ; c++) table[c] = CLS_IDENT;
	for (let c = C.UpperA; c <= C.UpperZ; c++) table[c] = CLS_IDENT;
	table[C.Underscore] = CLS_IDENT;
	for (let c = C.Zero; c <= C.Nine; c++) table[c] = CLS_DIGIT;
	table[C.Quote] = CLS_QUOTE;
	table[C.Minus] = CLS_MINUS;
	table[C.Bang] = CLS_BANG;
	table[C.GreaterThan] = CLS_GT;
	table[C.LessThan] = CLS_LT;
	table[C.Dot] = CLS_DOT;
	table[C.LParen] = CLS_LPAREN;
	table[C.RParen] = CLS_RPAREN;
	table[C.LBracket] = CLS_LBRACKET;
	table[C.RBracket] = CLS_RBRACKET;
	table[C.Comma] = CLS_COMMA;
	table[C.Question] = CLS_QUESTION;
	table[C.Equals] = CLS_EQ;
	table[C.Tilde] = CLS_TILDE;
	table[C.Colon] = CLS_COLON;
	table[C.At] = CLS_AT;
	return table;
})();

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

		throw new FiltronParseError("Unterminated string literal", start);
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
	 * Scan exactly n digits starting at pos, returning the position after them
	 */
	private scanDigits(pos: number, n: number): number {
		for (let i = 0; i < n; i++) {
			const code = pos < this.length ? this.input.charCodeAt(pos) : 0;
			if (code < C.Zero || code > C.Nine) {
				throw new FiltronParseError("Invalid date in temporal value", pos);
			}
			pos++;
		}
		return pos;
	}

	/**
	 * Read n already-validated digits as a number
	 */
	private digitsValue(pos: number, n: number): number {
		let value = 0;
		for (let i = 0; i < n; i++) {
			value = value * 10 + (this.input.charCodeAt(pos + i) - C.Zero);
		}
		return value;
	}

	/**
	 * Scan a single expected character, returning the position after it
	 */
	private scanChar(pos: number, expected: number): number {
		if (pos >= this.length || this.input.charCodeAt(pos) !== expected) {
			throw new FiltronParseError("Invalid date in temporal value", pos);
		}
		return pos + 1;
	}

	/**
	 * A temporal literal must end at a token boundary
	 */
	private assertTemporalBoundary(): void {
		if (this.pos < this.length) {
			const code = this.input.charCodeAt(this.pos);
			if (code < 128) {
				const cls = CHAR_CLASS[code];
				if (cls === CLS_IDENT || cls === CLS_DIGIT) {
					throw new FiltronParseError("Unexpected character in temporal value", this.pos);
				}
			}
		}
	}

	/**
	 * Read one temporal point: an ISO 8601 date, or now with an
	 * optional signed offset
	 */
	private readTemporalPoint(context: string): TemporalPoint {
		const input = this.input;
		const length = this.length;
		const start = this.pos;
		const code = start < length ? input.charCodeAt(start) : 0;

		// now, optionally followed by +N<unit> or -N<unit>
		if (code === 110) {
			if (
				start + 2 >= length ||
				input.charCodeAt(start + 1) !== 111 ||
				input.charCodeAt(start + 2) !== 119
			) {
				throw new FiltronParseError(`Expected a date or now ${context}`, start);
			}
			this.pos = start + 3;

			let offset: NowValue["offset"] = null;
			const signCode = this.pos < length ? input.charCodeAt(this.pos) : 0;
			if (signCode === C.Minus || signCode === C.Plus) {
				this.pos++;
				let amount = 0;
				let digits = 0;
				while (this.pos < length) {
					const digit = input.charCodeAt(this.pos);
					if (digit < C.Zero || digit > C.Nine) break;
					amount = amount * 10 + (digit - C.Zero);
					digits++;
					this.pos++;
				}
				if (digits === 0) {
					throw new FiltronParseError("Expected a number after the offset sign", this.pos);
				}
				const unit = this.pos < length ? input[this.pos] : "";
				if (
					unit !== "s" &&
					unit !== "m" &&
					unit !== "h" &&
					unit !== "d" &&
					unit !== "w" &&
					unit !== "M" &&
					unit !== "y"
				) {
					throw new FiltronParseError("Expected a duration unit (s, m, h, d, w, M, y)", this.pos);
				}
				this.pos++;
				offset = { amount: signCode === C.Minus ? -amount : amount, unit };
			}

			this.assertTemporalBoundary();
			return { type: "now", offset };
		}

		// ISO 8601 date: YYYY-MM-DD, optional THH:MM:SS(.mmm)?(Z|+HH:MM|-HH:MM)?
		if (code >= C.Zero && code <= C.Nine) {
			let pos = this.scanDigits(start, 4);
			pos = this.scanChar(pos, C.Minus);
			pos = this.scanDigits(pos, 2);
			pos = this.scanChar(pos, C.Minus);
			pos = this.scanDigits(pos, 2);

			if (pos < length && input.charCodeAt(pos) === 84) {
				pos = this.scanDigits(pos + 1, 2);
				pos = this.scanChar(pos, C.Colon);
				pos = this.scanDigits(pos, 2);
				pos = this.scanChar(pos, C.Colon);
				pos = this.scanDigits(pos, 2);

				if (pos < length && input.charCodeAt(pos) === C.Dot) {
					pos = this.scanDigits(pos + 1, 1);
					for (let i = 0; i < 2 && pos < length; i++) {
						const digit = input.charCodeAt(pos);
						if (digit < C.Zero || digit > C.Nine) break;
						pos++;
					}
				}

				const zone = pos < length ? input.charCodeAt(pos) : 0;
				if (zone === 90) {
					pos++;
				} else if (zone === C.Plus || zone === C.Minus) {
					pos = this.scanDigits(pos + 1, 2);
					pos = this.scanChar(pos, C.Colon);
					pos = this.scanDigits(pos, 2);
				}
			}

			const value = input.slice(start, pos);
			const year = this.digitsValue(start, 4);
			const month = this.digitsValue(start + 5, 2);
			const day = this.digitsValue(start + 8, 2);
			const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
			const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
			let valid = month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
			if (valid && pos > start + 10 && input.charCodeAt(start + 10) === 84) {
				const hour = this.digitsValue(start + 11, 2);
				const minute = this.digitsValue(start + 14, 2);
				const second = this.digitsValue(start + 17, 2);
				valid = hour <= 23 && minute <= 59 && second <= 59;
			}
			if (!valid) {
				throw new FiltronParseError(`Invalid date: ${value}`, start);
			}
			this.pos = pos;
			this.assertTemporalBoundary();
			return { type: "date", value };
		}

		throw new FiltronParseError(`Expected a date or now ${context}`, start);
	}

	/**
	 * Read a temporal literal: '@' followed by a point, optionally
	 * '..' and a second point (no second '@')
	 */
	private readTemporal(): Token {
		const start = this.pos;
		this.pos = start + 1; // consume '@'

		const min = this.readTemporalPoint("after '@'");

		const input = this.input;
		if (
			this.pos + 1 < this.length &&
			input.charCodeAt(this.pos) === C.Dot &&
			input.charCodeAt(this.pos + 1) === C.Dot
		) {
			this.pos += 2;
			const max = this.readTemporalPoint("after '..'");

			// Ordering is only checked where it is timezone-independent:
			// date-only bounds compare lexicographically. Bounds with times
			// or now offsets are left to resolution
			if (
				min.type === "date" &&
				max.type === "date" &&
				min.value.length === 10 &&
				max.value.length === 10 &&
				min.value > max.value
			) {
				throw new FiltronParseError(
					`Range min (${min.value}) must not exceed max (${max.value})`,
					start,
				);
			}

			return {
				type: "TEMPORAL",
				value: { type: "range", kind: "temporal", min, max },
				start,
				end: this.pos,
			};
		}

		return { type: "TEMPORAL", value: min, start, end: this.pos };
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

		switch (code < 128 ? CHAR_CLASS[code] : CLS_INVALID) {
			case CLS_IDENT:
				return this.readIdentifier();
			case CLS_DIGIT:
				return this.readNumber();
			case CLS_QUOTE:
				return this.readString();
			case CLS_LPAREN:
				this.pos = pos + 1;
				return { type: "LPAREN", start: pos, end: pos + 1 };
			case CLS_RPAREN:
				this.pos = pos + 1;
				return { type: "RPAREN", start: pos, end: pos + 1 };
			case CLS_LBRACKET:
				this.pos = pos + 1;
				return { type: "LBRACKET", start: pos, end: pos + 1 };
			case CLS_RBRACKET:
				this.pos = pos + 1;
				return { type: "RBRACKET", start: pos, end: pos + 1 };
			case CLS_COMMA:
				this.pos = pos + 1;
				return { type: "COMMA", start: pos, end: pos + 1 };
			case CLS_QUESTION:
				this.pos = pos + 1;
				return { type: "QUESTION", start: pos, end: pos + 1 };
			case CLS_EQ:
				this.pos = pos + 1;
				return { type: "EQ", start: pos, end: pos + 1 };
			case CLS_TILDE:
				this.pos = pos + 1;
				return { type: "LIKE", start: pos, end: pos + 1 };
			case CLS_COLON:
				this.pos = pos + 1;
				return { type: "COLON", start: pos, end: pos + 1 };
			case CLS_AT:
				return this.readTemporal();
			case CLS_BANG: {
				const nextCode = pos + 1 < length ? input.charCodeAt(pos + 1) : 0;
				if (nextCode === C.Equals) {
					this.pos = pos + 2;
					return { type: "NEQ", start: pos, end: pos + 2 };
				}
				if (nextCode === C.Colon) {
					this.pos = pos + 2;
					return { type: "NOT_COLON", start: pos, end: pos + 2 };
				}
				throw new FiltronParseError(`Unexpected character: '${input[pos]}'`, pos);
			}
			case CLS_GT:
				if (pos + 1 < length && input.charCodeAt(pos + 1) === C.Equals) {
					this.pos = pos + 2;
					return { type: "GTE", start: pos, end: pos + 2 };
				}
				this.pos = pos + 1;
				return { type: "GT", start: pos, end: pos + 1 };
			case CLS_LT:
				if (pos + 1 < length && input.charCodeAt(pos + 1) === C.Equals) {
					this.pos = pos + 2;
					return { type: "LTE", start: pos, end: pos + 2 };
				}
				this.pos = pos + 1;
				return { type: "LT", start: pos, end: pos + 1 };
			case CLS_DOT:
				if (pos + 1 < length && input.charCodeAt(pos + 1) === C.Dot) {
					this.pos = pos + 2;
					return { type: "DOTDOT", start: pos, end: pos + 2 };
				}
				this.pos = pos + 1;
				return { type: "DOT", start: pos, end: pos + 1 };
			case CLS_MINUS: {
				const nextCode = pos + 1 < length ? input.charCodeAt(pos + 1) : 0;
				if (nextCode >= C.Zero && nextCode <= C.Nine) {
					return this.readNumber();
				}
				// Negated exists: '-' directly before a field name
				if (nextCode < 128 && CHAR_CLASS[nextCode] === CLS_IDENT) {
					this.pos = pos + 1;
					return { type: "MINUS", start: pos, end: pos + 1 };
				}
				throw new FiltronParseError(`Unexpected character: '${input[pos]}'`, pos);
			}
			default:
				throw new FiltronParseError(`Unexpected character: '${input[pos]}'`, pos);
		}
	}
}
