import { mkdir, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { file, write } from "bun";
import { format } from "oxfmt";
import { SyntaxKind } from "typescript/ast";
import { getCombinedModifierFlags } from "typescript/ast/utils";
import {
	API,
	type Checker,
	type InterfaceType,
	ModifierFlags,
	SignatureKind,
	SymbolFlags,
	type Symbol as TsSymbol,
} from "typescript/async";
import { buildCss, highlight, minifyHtml } from "./html.ts";

const ROOT = "..";
const BASE_URL = "https://filtron.dev";

type ApiKind = "function" | "class" | "interface" | "type" | "constant";

interface ApiParam {
	name: string;
	description: string;
}

interface ApiEntry {
	name: string;
	kind: ApiKind;
	declaration: string;
	description: string;
	params: ApiParam[];
	returns: string;
	throws: string[];
	deprecated: string | null;
	examples: string[];
}

interface ApiPackage {
	name: string;
	slug: string;
	description: string;
	entries: ApiEntry[];
}

interface Context {
	api: API;
	checker: Checker;
}

function stripLinks(text: string): string {
	return text.replace(/\{@link\s+([^}|\s]+)(?:[|\s]+([^}]+))?\}/g, (_, target, label) =>
		label ? label.trim() : target,
	);
}

// The printer indents with four spaces; the rest of the site uses two
function reindent(text: string): string {
	return text.replace(/^( {4})+/gm, (spaces) => " ".repeat(spaces.length / 2));
}

// The printer spells an optional parameter as `x?: T | undefined`
function dropRedundantUndefined(text: string): string {
	return text.replace(/(\?: )([^,;)]+?) \| undefined/g, "$1$2");
}

function stripExampleFence(text: string): string {
	return text
		.replace(/^```[a-z]*\n/, "")
		.replace(/\n```$/, "")
		.trim();
}

function parseParam(text: string): ApiParam {
	const [name = "", ...rest] = text.trim().split(/\s+/);
	return { name, description: stripLinks(rest.join(" ").replace(/^-\s*/, "")) };
}

async function resolveExport(ctx: Context, symbol: TsSymbol): Promise<TsSymbol> {
	return symbol.flags & SymbolFlags.Alias ? await ctx.checker.getAliasedSymbol(symbol) : symbol;
}

async function print(
	ctx: Context,
	node: Parameters<API["printer"]["printNode"]>[0],
): Promise<string> {
	return dropRedundantUndefined(reindent((await ctx.api.printer.printNode(node)).trim()));
}

async function printSignatures(
	ctx: Context,
	symbol: TsSymbol,
	name: string,
	kind: SyntaxKind.FunctionDeclaration | SyntaxKind.MethodSignature,
): Promise<string[]> {
	const type = await ctx.checker.getTypeOfSymbol(symbol);
	const signatures = await ctx.checker.getSignaturesOfType(type, SignatureKind.Call);
	const lines = await Promise.all(
		signatures.map(async (signature) => {
			const node = await ctx.checker.signatureToSignatureDeclaration(signature, kind);
			if (!node) return null;
			const text = await print(ctx, node);
			return kind === SyntaxKind.FunctionDeclaration
				? text.replace(/^function\s*/, `function ${name}`)
				: `${name}${text}`;
		}),
	);
	return lines.filter((line): line is string => line !== null);
}

async function isPublicMember(symbol: TsSymbol): Promise<boolean> {
	const declaration = await symbol.declarations[0]?.resolve();
	if (!declaration) return true;
	return (
		(getCombinedModifierFlags(declaration) & (ModifierFlags.Private | ModifierFlags.Protected)) ===
		0
	);
}

async function describeClass(ctx: Context, name: string, symbol: TsSymbol): Promise<string> {
	const constructType = await ctx.checker.getTypeOfSymbol(symbol);
	const constructors = await ctx.checker.getSignaturesOfType(
		constructType,
		SignatureKind.Construct,
	);
	const constructorLines = await Promise.all(
		constructors.map(async (signature) => {
			const node = await ctx.checker.signatureToSignatureDeclaration(
				signature,
				SyntaxKind.Constructor,
			);
			return node
				? (await print(ctx, node))
						.replace(/\s*\{[\s\S]*$/, ";")
						.replace(/\b(?:public|protected|private|readonly) /g, "")
				: null;
		}),
	);

	const declared = await ctx.checker.getDeclaredTypeOfSymbol(symbol);
	const members = await ctx.checker.getPropertiesOfType(declared);
	const bases = await ctx.checker.getBaseTypes(declared as InterfaceType);
	const baseNames = await Promise.all(bases.map((base) => ctx.checker.typeToString(base)));
	const memberLines = await Promise.all(
		members.map(async (member): Promise<string[]> => {
			// Skip private members and ones inherited from a base class
			if ((await member.getParent())?.id !== symbol.id || !(await isPublicMember(member))) {
				return [];
			}
			if (member.flags & SymbolFlags.Method) {
				return await printSignatures(ctx, member, member.name, SyntaxKind.MethodSignature);
			}
			const type = await ctx.checker.typeToString(await ctx.checker.getTypeOfSymbol(member));
			return [`${member.name}: ${type};`];
		}),
	);

	const lines = [
		...constructorLines.filter((line): line is string => line !== null),
		...memberLines.flat(),
	];
	const heritage = baseNames.length > 0 ? ` extends ${baseNames.join(", ")}` : "";
	return `class ${name}${heritage} {\n${lines.map((line) => `  ${line}`).join("\n")}\n}`;
}

async function describeDeclaration(
	ctx: Context,
	name: string,
	kind: ApiKind,
	symbol: TsSymbol,
): Promise<string> {
	switch (kind) {
		case "function":
			return (await printSignatures(ctx, symbol, name, SyntaxKind.FunctionDeclaration)).join("\n");
		case "class":
			return await describeClass(ctx, name, symbol);
		case "interface":
		case "type": {
			const declaration = await symbol.declarations[0]?.resolve();
			if (!declaration) throw new Error(`No declaration found for ${name}`);
			return (await print(ctx, declaration)).replace(/^export\s+/, "");
		}
		case "constant": {
			const type = await ctx.checker.typeToString(await ctx.checker.getTypeOfSymbol(symbol));
			return `const ${name}: ${type};`;
		}
		default: {
			const _exhaustive: never = kind;
			throw new Error(`Unknown kind: ${_exhaustive as string}`);
		}
	}
}

async function classify(ctx: Context, name: string, symbol: TsSymbol): Promise<ApiKind> {
	if (symbol.flags & SymbolFlags.Class) return "class";
	if (symbol.flags & SymbolFlags.Interface) return "interface";
	if (symbol.flags & SymbolFlags.TypeAlias) return "type";
	if (symbol.flags & SymbolFlags.Function) return "function";
	if (symbol.flags & SymbolFlags.Variable) {
		const type = await ctx.checker.getTypeOfSymbol(symbol);
		const calls = await ctx.checker.getSignaturesOfType(type, SignatureKind.Call);
		return calls.length > 0 ? "function" : "constant";
	}
	throw new Error(`Unsupported export kind for ${name} (symbol flags ${symbol.flags})`);
}

async function describeExport(ctx: Context, exported: TsSymbol): Promise<ApiEntry> {
	const symbol = await resolveExport(ctx, exported);
	const name = exported.name;
	const kind = await classify(ctx, name, symbol);
	const tags = await ctx.checker.getJsDocTagsOfSymbol(symbol);
	const text = (tag: string): string[] =>
		tags.filter((t) => t.name === tag).map((t) => stripLinks(t.text ?? ""));

	return {
		name,
		kind,
		declaration: await describeDeclaration(ctx, name, kind, symbol),
		description: stripLinks(await ctx.checker.getDocumentationCommentOfSymbol(symbol)).trim(),
		params: text("param").map(parseParam),
		returns: text("returns")[0] ?? "",
		throws: text("throws"),
		deprecated: tags.some((t) => t.name === "deprecated") ? (text("deprecated")[0] ?? "") : null,
		examples: tags.filter((t) => t.name === "example").map((t) => stripExampleFence(t.text ?? "")),
	};
}

// Public packages are the non-private ones with an index.ts at their root
async function findPackageDirs(): Promise<string[]> {
	const dirs = await readdir(`${ROOT}/packages`);
	const found = await Promise.all(
		dirs.toSorted().map(async (dir) => {
			const manifest = file(`${ROOT}/packages/${dir}/package.json`);
			if (
				!(await manifest.exists()) ||
				!(await file(`${ROOT}/packages/${dir}/index.ts`).exists())
			) {
				return null;
			}
			const pkg = (await manifest.json()) as { private?: boolean };
			return pkg.private ? null : dir;
		}),
	);
	return found.filter((dir): dir is string => dir !== null);
}

async function extractPackage(
	api: API,
	options: Parameters<API["createProgram"]>[1],
	root: string,
	dir: string,
): Promise<ApiPackage> {
	const entry = `${root}/packages/${dir}/index.ts`;
	await using program = await api.createProgram([entry], options);
	const sourceFile = await program.getSourceFile(entry);
	if (!sourceFile) throw new Error(`Could not load ${entry}`);

	const ctx: Context = { api, checker: program.getProject().checker };
	const moduleSymbol = await ctx.checker.getSymbolAtLocation(sourceFile);
	if (!moduleSymbol) throw new Error(`${entry} is not a module`);
	const exports = await ctx.checker.getExportsOfModule(moduleSymbol);
	const entries = await Promise.all(exports.map((symbol) => describeExport(ctx, symbol)));

	const manifest = (await file(`${ROOT}/packages/${dir}/package.json`).json()) as {
		name: string;
		description: string;
	};
	return { name: manifest.name, slug: dir, description: manifest.description, entries };
}

export async function extractApi(): Promise<ApiPackage[]> {
	const root = resolve(ROOT);
	await using api = new API({ cwd: root });
	const config = await api.parseConfigFile(`${root}/tsconfig.json`);
	const dirs = await findPackageDirs();
	return await Promise.all(dirs.map((dir) => extractPackage(api, config.options, root, dir)));
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineCode(text: string): string {
	return escapeHtml(text).replace(/`([^`]+)`/g, "<code>$1</code>");
}

function renderMarkdown(packages: ApiPackage[]): string {
	const lines: string[] = [
		"# Filtron API reference",
		"",
		"Generated from the exported types and JSDoc of each package.",
		"",
	];

	for (const pkg of packages) {
		lines.push(`## ${pkg.name}`, "", pkg.description, "");
		for (const entry of pkg.entries) {
			lines.push(`### ${entry.name}`, "", `Kind: ${entry.kind}`, "");
			if (entry.deprecated !== null) lines.push(`Deprecated: ${entry.deprecated}`, "");
			lines.push("```typescript", entry.declaration, "```", "");
			if (entry.description) lines.push(entry.description, "");
			if (entry.params.length > 0) {
				lines.push("Parameters:", "");
				for (const param of entry.params) {
					lines.push(`- \`${param.name}\`: ${param.description}`);
				}
				lines.push("");
			}
			if (entry.returns) lines.push(`Returns: ${entry.returns}`, "");
			for (const thrown of entry.throws) lines.push(`Throws: ${thrown}`, "");
			for (const example of entry.examples) {
				lines.push("Example:", "", "```typescript", example, "```", "");
			}
		}
	}

	return lines.join("\n");
}

function renderEntry(pkg: ApiPackage, entry: ApiEntry): string {
	const id = `${pkg.slug}-${entry.name}`;
	const parts: string[] = [
		`<article class="api-entry" id="${id}">`,
		`<h3><a href="#${id}"><code>${escapeHtml(entry.name)}</code></a> <span class="api-kind">${entry.kind}</span></h3>`,
		`<div class="code-block">${highlight(entry.declaration, "typescript")}</div>`,
	];

	if (entry.deprecated !== null) {
		parts.push(`<p>Deprecated. ${inlineCode(entry.deprecated)}</p>`);
	}
	for (const paragraph of entry.description.split(/\n{2,}/)) {
		if (paragraph.trim()) parts.push(`<p>${inlineCode(paragraph.replace(/\n/g, " "))}</p>`);
	}
	if (entry.params.length > 0) {
		const rows = entry.params
			.map(
				(param) =>
					`<tr><td><code>${escapeHtml(param.name)}</code></td><td>${inlineCode(param.description)}</td></tr>`,
			)
			.join("");
		parts.push(
			`<table class="api-params"><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>`,
		);
	}
	if (entry.returns)
		parts.push(`<p><span class="api-label">Returns</span> ${inlineCode(entry.returns)}</p>`);
	for (const thrown of entry.throws) {
		parts.push(`<p><span class="api-label">Throws</span> ${inlineCode(thrown)}</p>`);
	}
	for (const example of entry.examples) {
		parts.push(`<div class="code-block">${highlight(example, "typescript")}</div>`);
	}

	parts.push("</article>");
	return parts.join("");
}

async function renderPage(packages: ApiPackage[]): Promise<string> {
	const css = await buildCss();
	const description =
		"Reference for every exported function, type and class in the Filtron packages, generated from the source.";

	const sections = packages
		.map((pkg) => {
			const index = pkg.entries
				.map(
					(entry) =>
						`<li><a href="#${pkg.slug}-${entry.name}"><code>${escapeHtml(entry.name)}</code></a></li>`,
				)
				.join("");
			return [
				`<section class="content-section${packages.indexOf(pkg) % 2 === 0 ? " alt" : ""}" id="${pkg.slug}">`,
				'<div class="section-inner">',
				`<h2>${escapeHtml(pkg.name)}</h2>`,
				`<p>${inlineCode(pkg.description)}</p>`,
				`<ul class="api-index">${index}</ul>`,
				pkg.entries.map((entry) => renderEntry(pkg, entry)).join(""),
				"</div></section>",
			].join("");
		})
		.join("");

	const nav = packages.map((pkg) => `<a href="#${pkg.slug}">${escapeHtml(pkg.name)}</a>`).join("");

	return [
		'<!doctype html><html lang="en"><head><meta charset="UTF-8" />',
		'<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
		`<meta name="description" content="${description}" />`,
		"<title>API reference - Filtron</title>",
		`<link rel="canonical" href="${BASE_URL}/api/" />`,
		'<meta property="og:type" content="website" />',
		`<meta property="og:url" content="${BASE_URL}/api/" />`,
		'<meta property="og:title" content="API reference - Filtron" />',
		`<meta property="og:description" content="${description}" />`,
		`<style>${css}</style></head><body><main>`,
		`<nav class="api-nav font-mono"><a href="/">Filtron</a>${nav}</nav>`,
		'<section class="content-section"><div class="section-inner"><h1>API reference</h1>',
		"<p>Every exported function, type and class in the Filtron packages. This page is generated from the source and its JSDoc comments when the site is built.</p>",
		'<p>A plain-text version for tools and LLMs is available at <a href="/llms/api.txt">llms/api.txt</a>.</p></div></section>',
		sections,
		'<footer><nav class="links"><a href="/">Home</a>',
		'<a href="https://github.com/jbergstroem/filtron">GitHub</a></nav>',
		'<p class="copyright">Generated from the source with the TypeScript compiler API</p></footer>',
		"</main></body></html>",
	].join("");
}

export async function generateApiDocs(): Promise<void> {
	const packages = await extractApi();

	await mkdir("dist/api", { recursive: true });
	await mkdir("dist/llms", { recursive: true });

	await write("dist/api/index.html", minifyHtml(await renderPage(packages)));

	const markdown = await format("api.md", renderMarkdown(packages));
	await write("dist/llms/api.txt", markdown.code);
}
