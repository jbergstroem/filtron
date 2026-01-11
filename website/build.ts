import filtronGrammar from "@filtron/core/filtron.tmLanguage.json";
import { build, file, write } from "bun";
import { createHighlighter } from "shiki";

const ICONS_DIR = "node_modules/@iconscout/unicons/svg/line";

async function getIcon(name: string): Promise<string> {
	const svg = await file(`${ICONS_DIR}/${name}.svg`).text();
	return svg.replace("<svg", '<svg class="icon" aria-hidden="true"');
}

const highlighter = await createHighlighter({
	themes: ["github-dark", "github-light"],
	langs: ["typescript", "bash", Object.assign({}, filtronGrammar, { name: "filtron" })],
});

function highlight(code: string, lang: string): string {
	return highlighter.codeToHtml(code.trim(), {
		lang,
		themes: { dark: "github-dark", light: "github-light" },
	});
}

let html = await file("index.html").text();

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
		return `<div class="code-block">${highlight(code, lang)}</div>`;
	},
);

// Decode HTML entities for syntax highlighting
function decodeHtmlEntities(text: string): string {
	return text.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
}

// Process Filtron syntax examples (handles formatter splitting tags across lines)
html = html.replace(/<code class="syntax-example"\s*>([\s\S]*?)<\/code\s*>/g, (_, code) => {
	// Highlight each line separately for inline examples
	const lines = code.trim().split("\n");
	const highlighted = lines
		.map((line: string) => {
			const trimmed = line.trim();
			if (!trimmed) return "";
			// Decode HTML entities before highlighting
			const decoded = decodeHtmlEntities(trimmed);
			// Extract spans from shiki output, preserving structure
			const result = highlight(decoded, "filtron");
			// Get content between <code> tags
			const match = result.match(/<code[^>]*>([\s\S]*?)<\/code>/);
			return match ? match[1] : trimmed;
		})
		.join("\n");
	return `<code class="syntax-example">${highlighted}</code>`;
});

// Build and minify JS
const jsResult = await build({
	entrypoints: ["src/main.ts"],
	target: "browser",
	minify: true,
	outdir: "dist",
});
const js = await jsResult.outputs[0].text();

// Build and minify CSS
const cssResult = await build({
	entrypoints: ["styles.css"],
	minify: true,
	outdir: "dist",
});
const css = await cssResult.outputs[0].text();

// Minify HTML before inlining CSS/JS (preserve whitespace in pre/code blocks)
html = html
	.replace(/(<pre[^>]*>[\s\S]*?<\/pre>)/g, (match) => match.replace(/\n/g, "&#10;"))
	.replace(/>\s+</g, "><")
	.replace(/\s{2,}/g, " ")
	.replace(/<!--(?!\[).*?-->/g, "")
	.replace(/^\s+/gm, "")
	.replace(/&#10;/g, "\n")
	.trim();

// Inline CSS and JS
html = html.replace(/<link rel="stylesheet" href="styles.css" ?\/>/, `<style>${css}</style>`);
html = html.replace(
	/<script type="module" src="\.\/main\.js"><\/script>/,
	`<script type="module">${js}</script>`,
);

await write("dist/index.html", html);

// Copy font file
await write("dist/geist-mono-v4-latin-regular.woff2", file("geist-mono-v4-latin-regular.woff2"));

// Clean up intermediate files
await Promise.all([file("dist/main.js").unlink(), file("dist/styles.css").unlink()]);

console.log("Build complete: dist/index.html");
