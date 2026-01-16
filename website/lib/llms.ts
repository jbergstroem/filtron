import { file, write } from "bun";
import { mkdir, readdir } from "node:fs/promises";
import pkg from "../../package.json" with { type: "json" };
import {
	type DocFile,
	extractCodeBlock,
	extractFirstSection,
	extractSection,
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
	const typesSection = extractSection(coreReadme, "Types");
	if (!typesSection) return null;

	const astSubsection = typesSection.split("### AST structure")[1];
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
	try {
		const exampleDirs = await readdir("../examples");

		const results = await Promise.all(
			exampleDirs.sort().map(async (dir) => {
				const readmeFile = file(`../examples/${dir}/README.md`);
				if (!(await readmeFile.exists())) return null;

				const content = await readmeFile.text();
				const firstParagraph = content
					.split("\n")
					.find((line) => line.trim() && !line.startsWith("#"));

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
					description: firstParagraph?.trim() ?? "",
					code,
					queries,
				};
			}),
		);

		// Filter out standalone projects (those with source code)
		return results.filter((example): example is ExampleInfo => example !== null && !example.code);
	} catch {
		// No examples directory
		return [];
	}
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

	const examplesSection =
		examples.length > 0
			? examples.map(formatExampleCode).join("\n")
			: `Parse a filter expression:

\`\`\`typescript
import { parse } from "@filtron/core";

const result = parse('age > 18 AND status = "active"');
if (result.success) {
  console.log(result.ast);
} else {
  console.error(result.error, result.position);
}
\`\`\``;

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

${operatorsTable ?? "See @filtron/core documentation"}

### AST node types

${astTable ?? "See @filtron/core documentation"}

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
