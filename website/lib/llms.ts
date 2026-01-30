import { file, write } from "bun";
import { mkdir, readdir } from "node:fs/promises";
import { format } from "oxfmt";
import pkg from "../../package.json" with { type: "json" };
import {
	type DocFile,
	extractCodeBlock,
	extractDescription,
	extractFirstSection,
	extractSection,
	extractSubsection,
	extractTable,
	findDocs,
} from "./markdown.ts";

const REPO_URL = pkg.repository.url.replace("git+", "").replace(".git", "");

function formatSection(docs: DocFile[]): string {
	return docs.map((doc) => `- [${doc.name}](${doc.url}): ${doc.description}`).join("\n");
}

async function extractOperatorsTable(): Promise<string | null> {
	const coreReadme = await file("../packages/core/README.md").text();
	const operatorsSection = extractSection(coreReadme, "Operators");
	if (!operatorsSection) return null;
	return extractTable(operatorsSection);
}

async function extractAstTable(): Promise<string | null> {
	const coreReadme = await file("../packages/core/README.md").text();
	const astSubsection = extractSubsection(coreReadme, "AST structure");
	if (!astSubsection) return null;
	return extractTable(astSubsection);
}

interface ExampleInfo {
	name: string;
	description: string;
	code: string | null;
	queries: string | null;
}

async function extractExamples(): Promise<ExampleInfo[]> {
	const exampleDirs = await readdir("../examples");

	const results = await Promise.all(
		exampleDirs.sort().map(async (dir) => {
			const readmeFile = file(`../examples/${dir}/README.md`);
			if (!(await readmeFile.exists())) return null;

			const content = await readmeFile.text();

			// Try to get code from src/index.ts
			const indexFile = file(`../examples/${dir}/src/index.ts`);
			let code: string | null = null;
			if (await indexFile.exists()) {
				code = await indexFile.text();
			}

			// Extract example queries section
			const queriesSection = extractSection(content, "Example queries");
			const queries = queriesSection ? extractCodeBlock(queriesSection) : null;

			return {
				name: dir,
				description: extractDescription(content, 200),
				code,
				queries,
			};
		}),
	);

	// Filter out standalone projects (those with source code)
	return results.filter((example): example is ExampleInfo => example !== null && !example.code);
}

function formatExampleCode(example: ExampleInfo): string {
	const parts: string[] = [];

	parts.push(`#### ${example.name}\n`);
	parts.push(`${example.description}\n`);

	if (example.queries) {
		const queryLines = example.queries
			.split("\n")
			.filter((line) => line.trim() && !line.startsWith("#"));
		if (queryLines.length > 0) {
			parts.push("```");
			parts.push(queryLines.join("\n").trim());
			parts.push("```\n");
		}
	}

	return parts.join("\n");
}

export async function generateLlmsTxt(): Promise<void> {
	const { required, optional } = await findDocs();
	const readme = await file("../README.md").text();
	const intro = extractFirstSection(readme);

	const operatorsTable = await extractOperatorsTable();
	const astTable = await extractAstTable();
	const examples = await extractExamples();

	const examplesSection = examples.map(formatExampleCode).join("\n");

	const llmsTxt = `# Filtron

> ${intro}

## Quick reference

Repository: ${REPO_URL}

### Package selection

| Use case | Packages |
| --- | --- |
| Parse only | \`@filtron/core\` |
| SQL databases | \`@filtron/core\` + \`@filtron/sql\` |
| In-memory filtering | \`@filtron/core\` + \`@filtron/js\` |

### Operators

${operatorsTable}

### AST node types

${astTable}

### Code examples

${examplesSection}

### Error handling

\`parse()\` returns a result object:
- On success: \`{ success: true, ast: ASTNode }\`
- On failure: \`{ success: false, error: string, position: number }\`

\`parseOrThrow()\` throws \`FiltronParseError\` with \`message\` and \`position\` properties.

### Security

- SQL output is always parameterized - safe from injection when using the \`params\` array
- Use \`allowedFields\` option in \`@filtron/js\` to restrict queryable fields

## Documentation

${formatSection(required)}

## Optional

${formatSection(optional)}
`;

	const formatted = await format("llms.md", llmsTxt);
	await write("dist/llms.txt", formatted.code);
}

export async function copyLlmsDocs(): Promise<void> {
	await mkdir("dist/llms", { recursive: true });
	await mkdir("dist/llms/packages", { recursive: true });
	await mkdir("dist/llms/examples", { recursive: true });

	const readmeContent = await file("../README.md").text();
	const contributingContent = await file("../CONTRIBUTING.md").text();
	const [formattedReadme, formattedContributing] = await Promise.all([
		format("README.md", readmeContent),
		format("CONTRIBUTING.md", contributingContent),
	]);
	await write("dist/llms/README.txt", formattedReadme.code);
	await write("dist/llms/CONTRIBUTING.txt", formattedContributing.code);

	const packages = await readdir("../packages");
	await Promise.all(
		packages.map(async (pkg) => {
			const readmeFile = file(`../packages/${pkg}/README.md`);
			if (await readmeFile.exists()) {
				await mkdir(`dist/llms/packages/${pkg}`, { recursive: true });
				const content = await readmeFile.text();
				const formatted = await format("README.md", content);
				await write(`dist/llms/packages/${pkg}/README.txt`, formatted.code);
			}
		}),
	);

	const examples = await readdir("../examples");
	await Promise.all(
		examples.map(async (example) => {
			const readmeFile = file(`../examples/${example}/README.md`);
			if (await readmeFile.exists()) {
				await mkdir(`dist/llms/examples/${example}`, { recursive: true });
				const content = await readmeFile.text();
				const formatted = await format("README.md", content);
				await write(`dist/llms/examples/${example}/README.txt`, formatted.code);
			}
		}),
	);
}
