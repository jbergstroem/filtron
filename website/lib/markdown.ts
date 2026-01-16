import { file } from "bun";
import { readdir } from "node:fs/promises";
import pkg from "../../package.json" with { type: "json" };

const ROOT = "..";
const BASE_URL = pkg.homepage;

export interface DocFile {
	name: string;
	path: string;
	url: string;
	description: string;
}

export function extractDescription(content: string, maxLength = 150): string {
	const lines = content.split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		if (
			trimmed.startsWith("#") ||
			trimmed.startsWith("[![") ||
			trimmed.startsWith("```") ||
			trimmed === ""
		) {
			continue;
		}
		if (trimmed.length > 20) {
			return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 3)}...` : trimmed;
		}
	}
	return "";
}

export function extractFirstSection(content: string): string {
	const lines = content.split("\n");
	const result: string[] = [];
	let foundTitle = false;
	let inCodeBlock = false;

	for (const line of lines) {
		if (line.startsWith("```")) {
			inCodeBlock = !inCodeBlock;
		}

		if (!inCodeBlock && line.startsWith("# ") && !foundTitle) {
			foundTitle = true;
			continue;
		}

		if (!inCodeBlock && line.startsWith("## ")) {
			break;
		}

		if (foundTitle) {
			result.push(line);
		}
	}

	return result
		.join("\n")
		.trim()
		.replace(/\[!\[.*?\]\(.*?\)\]\(.*?\)/g, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

export function extractSection(content: string, sectionName: string): string | null {
	const lines = content.split("\n");
	const result: string[] = [];
	let inSection = false;
	let inCodeBlock = false;
	const sectionHeader = `## ${sectionName}`;

	for (const line of lines) {
		if (line.startsWith("```")) {
			inCodeBlock = !inCodeBlock;
		}

		if (!inCodeBlock && line.startsWith("## ")) {
			if (inSection) {
				break;
			}
			if (line === sectionHeader) {
				inSection = true;
				continue;
			}
		}

		if (inSection) {
			result.push(line);
		}
	}

	if (result.length === 0) {
		return null;
	}

	return result.join("\n").trim();
}

export function extractTable(content: string): string | null {
	const lines = content.split("\n");
	const tableLines: string[] = [];
	let inTable = false;

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
			inTable = true;
			tableLines.push(trimmed);
		} else if (inTable) {
			break;
		}
	}

	if (tableLines.length === 0) {
		return null;
	}

	return tableLines.join("\n");
}

export function extractCodeBlock(content: string, language?: string): string | null {
	const lines = content.split("\n");
	const result: string[] = [];
	let inBlock = false;
	const startPattern = language ? `\`\`\`${language}` : "```";

	for (const line of lines) {
		if (!inBlock && line.startsWith(startPattern)) {
			inBlock = true;
			continue;
		}
		if (inBlock && line.startsWith("```")) {
			break;
		}
		if (inBlock) {
			result.push(line);
		}
	}

	if (result.length === 0) {
		return null;
	}

	return result.join("\n");
}

export async function findDocs(): Promise<{ required: DocFile[]; optional: DocFile[] }> {
	const required: DocFile[] = [];
	const optional: DocFile[] = [];

	const readme = await file(`${ROOT}/README.md`).text();
	required.push({
		name: "Documentation",
		path: "README.md",
		url: `${BASE_URL}/llms/README.md`,
		description: extractDescription(readme),
	});

	const packages = await readdir(`${ROOT}/packages`);
	const pkgDocs = await Promise.all(
		packages.sort().map(async (pkg) => {
			const readmeFile = file(`${ROOT}/packages/${pkg}/README.md`);
			if (await readmeFile.exists()) {
				const content = await readmeFile.text();
				return {
					name: `@filtron/${pkg}`,
					path: `packages/${pkg}/README.md`,
					url: `${BASE_URL}/llms/packages/${pkg}/README.md`,
					description: extractDescription(content),
				};
			}
			return null;
		}),
	);
	required.push(...pkgDocs.filter((doc): doc is DocFile => doc !== null));

	const contributing = file(`${ROOT}/CONTRIBUTING.md`);
	if (await contributing.exists()) {
		optional.push({
			name: "Contributing",
			path: "CONTRIBUTING.md",
			url: `${BASE_URL}/llms/CONTRIBUTING.md`,
			description: "Guidelines for contributing to Filtron",
		});
	}

	try {
		const examples = await readdir(`${ROOT}/examples`);
		const exampleDocs = await Promise.all(
			examples.sort().map(async (example) => {
				const readmeFile = file(`${ROOT}/examples/${example}/README.md`);
				if (await readmeFile.exists()) {
					const content = await readmeFile.text();
					return {
						name: `Example: ${example}`,
						path: `examples/${example}/README.md`,
						url: `${BASE_URL}/llms/examples/${example}/README.md`,
						description: extractDescription(content),
					};
				}
				return null;
			}),
		);
		optional.push(...exampleDocs.filter((doc): doc is DocFile => doc !== null));
	} catch {
		// No examples directory
	}

	return { required, optional };
}
