import { readdir } from "node:fs/promises";
import { file } from "bun";
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
	let result = "";
	Bun.markdown.render(content, {
		paragraph: (children) => {
			if (!result && children.trim().length > 20) {
				const trimmed = children.trim();
				result = trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 3)}...` : trimmed;
			}
			return "";
		},
		// Filter out badge images
		image: () => "",
	});
	return result;
}

export function extractFirstSection(content: string): string {
	let foundTitle = false;
	const collected: string[] = [];

	Bun.markdown.render(content, {
		heading: (children, meta) => {
			if (meta?.level === 1 && !foundTitle) {
				foundTitle = true;
				return "";
			}
			if (meta?.level === 2 && foundTitle) {
				// Signal to stop collecting by marking we've hit a section
				foundTitle = false; // Reuse flag to stop collection
				return "";
			}
			if (foundTitle && meta?.level && meta.level > 1) {
				collected.push(`${"#".repeat(meta.level)} ${children}\n`);
			}
			return "";
		},
		paragraph: (children) => {
			if (foundTitle) {
				const trimmed = children.trim();
				// Skip empty paragraphs
				if (trimmed.length > 0) {
					collected.push(`${trimmed}\n\n`);
				}
			}
			return "";
		},
		code: (children, meta) => {
			if (foundTitle) {
				const lang = meta?.language ?? "";
				collected.push(`\`\`\`${lang}\n${children}\n\`\`\`\n\n`);
			}
			return "";
		},
		list: (children) => {
			if (foundTitle) {
				collected.push(`${children}\n`);
			}
			return "";
		},
		listItem: (children) => {
			return `- ${children.trim()}\n`;
		},
		blockquote: (children) => {
			if (foundTitle) {
				const quoted = children
					.trim()
					.split("\n")
					.map((line) => `> ${line}`)
					.join("\n");
				collected.push(`${quoted}\n\n`);
			}
			return "";
		},
		// Filter out badge images - return empty string to exclude their alt text
		image: () => "",
	});

	return collected
		.join("")
		.trim()
		.replace(/\n{3,}/g, "\n\n");
}

export function extractSection(content: string, sectionName: string): string | null {
	let inSection = false;
	const collected: string[] = [];
	const sectionHeader = sectionName.toLowerCase();

	Bun.markdown.render(content, {
		heading: (children, meta) => {
			if (meta?.level === 2) {
				if (inSection) {
					// Hit next section, stop collecting
					inSection = false;
					return "";
				}
				if (children.trim().toLowerCase() === sectionHeader) {
					inSection = true;
					return "";
				}
			}
			if (inSection && meta?.level && meta.level > 2) {
				collected.push(`${"#".repeat(meta.level)} ${children}\n\n`);
			}
			return "";
		},
		paragraph: (children) => {
			if (inSection) {
				const trimmed = children.trim();
				if (trimmed.length > 0) {
					collected.push(`${trimmed}\n\n`);
				}
			}
			return "";
		},
		code: (children, meta) => {
			if (inSection) {
				const lang = meta?.language ?? "";
				collected.push(`\`\`\`${lang}\n${children}\n\`\`\`\n\n`);
			}
			return "";
		},
		table: (children) => {
			if (inSection) {
				collected.push(`${children}\n`);
			}
			return "";
		},
		thead: (children) => {
			// Add separator row after header
			const headerRow = children.trim();
			if (headerRow) {
				// Count columns from the header row (number of | minus 1)
				const cols = (headerRow.match(/\|/g) || []).length - 1;
				const separator = "|" + " --- |".repeat(cols);
				return headerRow + "\n" + separator + "\n";
			}
			return children;
		},
		tbody: (children) => children,
		tr: (children) => `|${children}\n`,
		th: (children) => ` ${children.trim()} |`,
		td: (children) => ` ${children.trim()} |`,
		list: (children) => {
			if (inSection) {
				collected.push(`${children}\n`);
			}
			return "";
		},
		listItem: (children) => {
			return `- ${children.trim()}\n`;
		},
		blockquote: (children) => {
			if (inSection) {
				const quoted = children
					.trim()
					.split("\n")
					.map((line) => `> ${line}`)
					.join("\n");
				collected.push(`${quoted}\n\n`);
			}
			return "";
		},
		// Filter out badge images
		image: () => "",
	});

	if (collected.length === 0) {
		return null;
	}

	return collected.join("").trim();
}

export function extractSubsection(content: string, subsectionName: string): string | null {
	let inSubsection = false;
	const collected: string[] = [];
	const subsectionHeader = subsectionName.toLowerCase();

	Bun.markdown.render(content, {
		heading: (children, meta) => {
			if (meta?.level === 3) {
				if (inSubsection) {
					// Hit next subsection, stop collecting
					inSubsection = false;
					return "";
				}
				if (children.trim().toLowerCase() === subsectionHeader) {
					inSubsection = true;
					return "";
				}
			}
			// Stop at next section (level 2)
			if (meta?.level === 2 && inSubsection) {
				inSubsection = false;
				return "";
			}
			if (inSubsection && meta?.level && meta.level > 3) {
				collected.push(`${"#".repeat(meta.level)} ${children}\n\n`);
			}
			return "";
		},
		paragraph: (children) => {
			if (inSubsection) {
				const trimmed = children.trim();
				if (trimmed.length > 0) {
					collected.push(`${trimmed}\n\n`);
				}
			}
			return "";
		},
		code: (children, meta) => {
			if (inSubsection) {
				const lang = meta?.language ?? "";
				collected.push(`\`\`\`${lang}\n${children}\n\`\`\`\n\n`);
			}
			return "";
		},
		table: (children) => {
			if (inSubsection) {
				collected.push(`${children}\n`);
			}
			return "";
		},
		thead: (children) => {
			const headerRow = children.trim();
			if (headerRow) {
				const cols = (headerRow.match(/\|/g) || []).length - 1;
				const separator = "|" + " --- |".repeat(cols);
				return headerRow + "\n" + separator + "\n";
			}
			return children;
		},
		tbody: (children) => children,
		tr: (children) => `|${children}\n`,
		th: (children) => ` ${children.trim()} |`,
		td: (children) => ` ${children.trim()} |`,
		list: (children) => {
			if (inSubsection) {
				collected.push(`${children}\n`);
			}
			return "";
		},
		listItem: (children) => {
			return `- ${children.trim()}\n`;
		},
		image: () => "",
	});

	if (collected.length === 0) {
		return null;
	}

	return collected.join("").trim();
}

export function extractTable(content: string): string | null {
	const rows: string[][] = [];
	let currentRow: string[] = [];

	Bun.markdown.render(content, {
		tr: () => {
			if (currentRow.length > 0) {
				rows.push([...currentRow]);
			}
			currentRow = [];
			return "";
		},
		th: (children) => {
			currentRow.push(children.trim());
			return "";
		},
		td: (children) => {
			currentRow.push(children.trim());
			return "";
		},
	});

	// Push last row if exists
	if (currentRow.length > 0) {
		rows.push([...currentRow]);
	}

	if (rows.length < 2) {
		return null;
	}

	// Reconstruct markdown table
	const header = rows[0];
	const separator = header.map(() => "---");
	const dataRows = rows.slice(1);

	const formatRow = (cells: string[]) => `| ${cells.join(" | ")} |`;

	const tableLines = [formatRow(header), formatRow(separator), ...dataRows.map(formatRow)];

	return tableLines.join("\n");
}

export function extractCodeBlock(content: string, language?: string): string | null {
	let result: string | null = null;

	Bun.markdown.render(content, {
		code: (children, meta) => {
			if (result === null) {
				if (!language || meta?.language === language) {
					result = children;
				}
			}
			return "";
		},
	});

	return result;
}

export async function findDocs(): Promise<{ required: DocFile[]; optional: DocFile[] }> {
	const required: DocFile[] = [];
	const optional: DocFile[] = [];

	const readme = await file(`${ROOT}/README.md`).text();
	required.push({
		name: "Documentation",
		path: "README.txt",
		url: `${BASE_URL}/llms/README.txt`,
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
					path: `packages/${pkg}/README.txt`,
					url: `${BASE_URL}/llms/packages/${pkg}/README.txt`,
					description: extractDescription(content),
					isOptional: pkg === "benchmark",
				};
			}
			return null;
		}),
	);
	const validPkgDocs = pkgDocs.filter(
		(doc): doc is DocFile & { isOptional: boolean } => doc !== null,
	);
	required.push(...validPkgDocs.filter((doc) => !doc.isOptional));
	optional.push(...validPkgDocs.filter((doc) => doc.isOptional));

	const contributing = file(`${ROOT}/CONTRIBUTING.md`);
	if (await contributing.exists()) {
		optional.push({
			name: "Contributing",
			path: "CONTRIBUTING.txt",
			url: `${BASE_URL}/llms/CONTRIBUTING.txt`,
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
						path: `examples/${example}/README.txt`,
						url: `${BASE_URL}/llms/examples/${example}/README.txt`,
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
