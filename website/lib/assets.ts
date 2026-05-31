import { rm } from "node:fs/promises";
import { file, write } from "bun";

export async function cleanDist(): Promise<void> {
	await rm("dist", { recursive: true, force: true });
}

export async function copyStaticAssets(): Promise<void> {
	const staticFiles = [
		"source-code-pro-v31-latin_latin-ext-regular.woff2",
		"_headers",
		"robots.txt",
		"sitemap.xml",
		"favicon.svg",
		"404.html",
		".well-known/security.txt",
	];
	await Promise.all(staticFiles.map((name) => write(`dist/${name}`, file(name))));
}

export async function cleanBuildArtifacts(): Promise<void> {
	await Promise.all([file("dist/main.js").unlink(), file("dist/styles.css").unlink()]);
}
