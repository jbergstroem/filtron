import { file, write } from "bun";
import { mkdir, readdir } from "node:fs/promises";
import { type DocFile, extractFirstSection, findDocs } from "./markdown.ts";

function formatSection(docs: DocFile[]): string {
	return docs.map((doc) => `- [${doc.name}](${doc.url}): ${doc.description}`).join("\n");
}

export async function generateLlmsTxt(): Promise<void> {
	const { required, optional } = await findDocs();
	const readme = await file("../README.md").text();
	const intro = extractFirstSection(readme);

	const llmsTxt = `# Filtron

> ${intro}

## Documentation

${formatSection(required)}

## Optional

${formatSection(optional)}
`;

	await write("dist/llms.txt", llmsTxt);
}

export async function copyLlmsDocs(): Promise<void> {

	await mkdir("dist/llms", { recursive: true });
	await mkdir("dist/llms/packages", { recursive: true });
	await mkdir("dist/llms/examples", { recursive: true });

	await write("dist/llms/README.md", file("../README.md"));
	await write("dist/llms/CONTRIBUTING.md", file("../CONTRIBUTING.md"));

	const packages = await readdir("../packages");
	await Promise.all(
		packages.map(async (pkg) => {
			const readme = file(`../packages/${pkg}/README.md`);
			if (await readme.exists()) {
				await mkdir(`dist/llms/packages/${pkg}`, { recursive: true });
				await write(`dist/llms/packages/${pkg}/README.md`, readme);
			}
		}),
	);

	const examples = await readdir("../examples");
	await Promise.all(
		examples.map(async (example) => {
			const readme = file(`../examples/${example}/README.md`);
			if (await readme.exists()) {
				await mkdir(`dist/llms/examples/${example}`, { recursive: true });
				await write(`dist/llms/examples/${example}/README.md`, readme);
			}
		}),
	);
}
