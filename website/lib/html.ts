import filtronGrammar from "@filtron/core/filtron.tmLanguage.json";
import { build, file } from "bun";
import { createHighlighter, type Highlighter } from "shiki";
import { createCssVariablesTheme } from "shiki/core";

const ICONS_DIR = "node_modules/@iconscout/unicons/svg/line";

const cssVarsTheme = createCssVariablesTheme({
	name: "css-variables",
	variablePrefix: "--shiki-",
	variableDefaults: {},
	fontStyle: true,
});

let highlighter: Highlighter;

async function getHighlighter(): Promise<Highlighter> {
	if (!highlighter) {
		highlighter = await createHighlighter({
			themes: [cssVarsTheme],
			langs: ["typescript", "bash", Object.assign({}, filtronGrammar, { name: "filtron" })],
		});
	}
	return highlighter;
}

async function getIcon(name: string): Promise<string> {
	const svg = await file(`${ICONS_DIR}/${name}.svg`).text();
	return svg.replace("<svg", '<svg class="icon" aria-hidden="true"');
}

function decodeHtmlEntities(text: string): string {
	return text.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
}

function highlight(hl: Highlighter, code: string, lang: string): string {
	return hl.codeToHtml(code.trim(), {
		lang,
		theme: "css-variables",
	});
}

export async function processHtml(html: string): Promise<string> {
	const hl = await getHighlighter();

	// Inline icons
	const iconMatches = [...html.matchAll(/<i data-icon="([^"]+)"><\/i>/g)];
	const iconReplacements = await Promise.all(
		iconMatches.map(async ([full, name]) => [full, await getIcon(name)] as const),
	);
	for (const [full, svg] of iconReplacements) {
		html = html.replace(full, svg);
	}

	// Process code blocks with language class
	html = html.replace(
		/<div class="code-block">\s*<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>\s*<\/div>/g,
		(_, lang, code) => {
			const decoded = decodeHtmlEntities(code);
			return `<div class="code-block">${highlight(hl, decoded, lang)}</div>`;
		},
	);

	// Process Filtron syntax examples
	html = html.replace(/<code class="syntax-example"\s*>([\s\S]*?)<\/code\s*>/g, (_, code) => {
		const lines = code.trim().split("\n");
		const highlighted = lines
			.map((line: string) => {
				const trimmed = line.trim();
				if (!trimmed) return "";
				const decoded = decodeHtmlEntities(trimmed);
				const result = highlight(hl, decoded, "filtron");
				const match = result.match(/<code[^>]*>([\s\S]*?)<\/code>/);
				return match ? match[1] : trimmed;
			})
			.join("\n");
		return `<code class="syntax-example">${highlighted}</code>`;
	});

	return html;
}

export function minifyHtml(html: string): string {
	return html
		.replace(/(<pre[^>]*>[\s\S]*?<\/pre>)/g, (match) => match.replace(/\n/g, "&#10;"))
		.replace(/>\s+</g, "><")
		.replace(/\s{2,}/g, " ")
		.replace(/<!--(?!\[).*?-->/g, "")
		.replace(/^\s+/gm, "")
		.replace(/&#10;/g, "\n")
		.trim();
}

export async function inlineAssets(html: string): Promise<string> {
	const jsResult = await build({
		entrypoints: ["src/main.ts"],
		target: "browser",
		minify: true,
		outdir: "dist",
	});
	const js = await jsResult.outputs[0].text();

	const cssResult = await build({
		entrypoints: ["styles.css"],
		minify: true,
		outdir: "dist",
	});
	const css = await cssResult.outputs[0].text();

	html = html.replace(/<link rel="stylesheet" href="styles.css" ?\/>/, `<style>${css}</style>`);
	html = html.replace(
		/<script type="module" src="\.\/main\.js"><\/script>/,
		`<script type="module">${js}</script>`,
	);

	return html;
}
