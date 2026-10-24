import { codeToHtml, isSupportedLanguage } from "@pierre/highlights";
import { cssVariables } from "@pierre/highlights/themes";
import { build, file } from "bun";
import { toHtml } from "../src/highlight.ts";

const ICONS_DIR = "node_modules/@iconscout/unicons/svg/line";
const decoder = new TextDecoder();

async function getIcon(name: string): Promise<string> {
	const svg = await file(`${ICONS_DIR}/${name}.svg`).text();
	return svg.replace("<svg", '<svg class="icon" aria-hidden="true"');
}

function decodeHtmlEntities(text: string): string {
	return text.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
}

function highlight(code: string, lang: string): string {
	if (!isSupportedLanguage(lang)) {
		throw new Error(`Unsupported code block language: ${lang}`);
	}
	// The highlighter returns bytes in shared memory; decode before the next call
	return decoder.decode(codeToHtml(code.trim(), { lang, theme: cssVariables }));
}

export async function processHtml(html: string): Promise<string> {
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
			return `<div class="code-block">${highlight(decoded, lang)}</div>`;
		},
	);

	// Process Filtron syntax examples
	html = html.replace(/<code class="syntax-example"\s*>([\s\S]*?)<\/code\s*>/g, (_, code) => {
		const lines = code.trim().split("\n");
		const highlighted = lines
			.map((line: string) => {
				const trimmed = line.trim();
				if (!trimmed) return "";
				return toHtml(decodeHtmlEntities(trimmed));
			})
			.join("\n");
		return `<code class="syntax-example">${highlighted}</code>`;
	});

	return html;
}

export function minifyHtml(html: string): string {
	// Whitespace is significant in code; set those blocks aside while minifying
	const blocks: string[] = [];
	return html
		.replace(
			/<pre[^>]*>[\s\S]*?<\/pre>|<code class="syntax-example">[\s\S]*?<\/code>/g,
			(match) => `__CODE_${blocks.push(match) - 1}__`,
		)
		.replace(/>\s+</g, "><")
		.replace(/\s{2,}/g, " ")
		.replace(/<!--(?!\[).*?-->/g, "")
		.replace(/^\s+/gm, "")
		.replace(/__CODE_(\d+)__/g, (_, i) => blocks[Number(i)])
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
