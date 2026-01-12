import { Lexer, type TokenType } from "@filtron/core";

interface HtmlHighlightOptions {
	classPrefix?: string;
}

function escapeHtml(str: string): string {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type HighlightClass = "keyword" | "field" | "operator" | "string" | "number" | "punctuation";

function tokenTypeToClass(type: TokenType): HighlightClass | null {
	switch (type) {
		case "AND":
		case "OR":
		case "NOT":
		case "EXISTS":
		case "TRUE":
		case "FALSE":
			return "keyword";
		case "IDENT":
			return "field";
		case "EQ":
		case "NEQ":
		case "GT":
		case "GTE":
		case "LT":
		case "LTE":
		case "LIKE":
		case "COLON":
		case "NOT_COLON":
		case "QUESTION":
		case "DOTDOT":
			return "operator";
		case "STRING":
			return "string";
		case "NUMBER":
			return "number";
		case "LPAREN":
		case "RPAREN":
		case "LBRACKET":
		case "RBRACKET":
		case "COMMA":
			return "punctuation";
		case "DOT":
		case "EOF":
			return null;
	}
}

export function toHtml(input: string, options: HtmlHighlightOptions = {}): string {
	const prefix = options.classPrefix ?? "fl-";
	const lexer = new Lexer(input);

	let html = "";
	let pos = 0;

	while (true) {
		const token = lexer.next();

		// Add any whitespace between tokens
		if (token.start > pos) {
			html += escapeHtml(input.slice(pos, token.start));
		}

		if (token.type === "EOF") break;

		const cls = tokenTypeToClass(token.type);
		const text = input.slice(token.start, token.end);

		if (cls) {
			html += `<span class="${prefix}${cls}">${escapeHtml(text)}</span>`;
		} else {
			html += escapeHtml(text);
		}

		pos = token.end;
	}

	return html;
}

export function toHtmlWithError(
	input: string,
	errorPosition: number,
	options: HtmlHighlightOptions = {},
): string {
	const prefix = options.classPrefix ?? "fl-";

	let html = "";
	let pos = 0;

	while (pos < input.length) {
		if (pos === errorPosition) {
			const char = input[pos];
			html += `<span class="${prefix}error">${escapeHtml(char)}</span>`;
			pos++;
		} else {
			html += escapeHtml(input[pos]);
			pos++;
		}
	}

	if (errorPosition >= input.length) {
		html += `<span class="${prefix}error ${prefix}error-eol"></span>`;
	}

	return html;
}
