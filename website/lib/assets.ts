import { rm } from "node:fs/promises";
import { file, write } from "bun";

export async function cleanDist(): Promise<void> {
	await rm("dist", { recursive: true, force: true });
}

export async function copyStaticAssets(): Promise<void> {
	const font = "source-code-pro-v31-latin_latin-ext-regular.woff2";
	await write(`dist/${font}`, file(font));
	await write("dist/_headers", file("_headers"));
}

export async function cleanBuildArtifacts(): Promise<void> {
	await Promise.all([file("dist/main.js").unlink(), file("dist/styles.css").unlink()]);
}
