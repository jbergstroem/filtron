#!/usr/bin/env bun

/**
 * Verify script for monorepo package publishing
 *
 * This script:
 * 1. Extracts package name and version from a git tag (format: package@version)
 * 2. Verifies the tag matches the package.json
 * 3. Outputs package directory for the workflow to use
 *
 * Usage:
 *   bun run scripts/verify-tag.ts <tag>
 *   Example: bun run scripts/verify-tag.ts @filtron/core@1.1.0
 *
 * Outputs (via GITHUB_OUTPUT):
 *   - package_name: The package name from the tag
 *   - version: The version from the tag
 *   - package_dir: The directory containing the package
 */

import { existsSync, statSync } from "fs";
import { join } from "path";
import { parseArgs } from "util";

export interface PackageJson {
	name: string;
	version: string;
	[key: string]: unknown;
}

/**
 * Parse a git tag into package name and version
 */
export function parseTag(tag: string): { packageName: string; version: string } {
	const match = tag.match(/^(.+)@([0-9]+\.[0-9]+\.[0-9]+.*)$/);

	if (!match) {
		throw new Error(`Tag '${tag}' does not match pattern '@filtron/{package}@{version}'`);
	}

	const [, packageName, version] = match;
	return { packageName, version };
}

/**
 * Map package name to directory path
 */
export function getPackageDirectory(packageName: string): string {
	// Handle scoped packages like @filtron/core -> packages/core
	const scopedMatch = packageName.match(/^@filtron\/(.+)$/);

	if (!scopedMatch) {
		throw new Error(`Unknown package name pattern: ${packageName}`);
	}

	const packageDir = join("packages", scopedMatch[1]);

	// Verify directory exists
	if (!existsSync(packageDir)) {
		throw new Error(`Package directory '${packageDir}' does not exist`);
	}

	if (!statSync(packageDir).isDirectory()) {
		throw new Error(`'${packageDir}' is not a directory`);
	}

	return packageDir;
}

/**
 * Read and parse package.json using dynamic import
 */
export async function readPackageJson(packageDir: string): Promise<PackageJson> {
	const packageJsonPath = join(process.cwd(), packageDir, "package.json");

	try {
		const packageJson = await import(packageJsonPath, { with: { type: "json" } });
		return packageJson.default as PackageJson;
	} catch (error) {
		throw new Error(`Could not read package.json in ${packageDir}: ${error}`);
	}
}

/**
 * Verify tag matches package.json
 */
export async function verifyTag(
	packageName: string,
	version: string,
	packageDir: string,
): Promise<void> {
	const packageJson = await readPackageJson(packageDir);

	if (packageJson.name !== packageName) {
		throw new Error(
			`Package name mismatch! Tag specifies: ${packageName}, package.json has: ${packageJson.name}`,
		);
	}

	if (packageJson.version !== version) {
		throw new Error(
			`Version mismatch! Tag specifies: ${version}, package.json has: ${packageJson.version}`,
		);
	}
}

/**
 * Verify tag matches package.json and output results
 */
async function verifyAndOutput(
	packageName: string,
	version: string,
	packageDir: string,
	githubOutput?: string,
): Promise<void> {
	await verifyTag(packageName, version, packageDir);

	// Output for GitHub Actions
	if (githubOutput) {
		const output = `package_name=${packageName}\nversion=${version}\npackage_dir=${packageDir}\n`;
		await Bun.write(githubOutput, output, { append: true });
		console.log(`\nOutputs written to GITHUB_OUTPUT`);
	}
}

/**
 * Main execution
 */
async function main() {
	try {
		const { positionals } = parseArgs({
			args: Bun.argv.slice(2),
			allowPositionals: true,
			strict: true,
		});

		if (positionals.length === 0) {
			console.error(`Usage: bun run scripts/verify-tag.ts <tag>`);
			console.error(`Example: bun run scripts/verify-tag.ts @filtron/core@1.1.0`);
			process.exit(1);
		}

		const tag = positionals[0];
		const githubOutput = Bun.env.GITHUB_OUTPUT;

		console.log(`\nVerifying tag: ${tag}`);

		// Parse tag
		const { packageName, version } = parseTag(tag);
		console.log(`   Package: ${packageName}`);
		console.log(`   Version: ${version}`);

		// Get package directory
		const packageDir = getPackageDirectory(packageName);
		console.log(`   Directory: ${packageDir}`);

		// Verify package.json matches tag and output results
		await verifyAndOutput(packageName, version, packageDir, githubOutput);
	} catch (error) {
		if (error instanceof Error) {
			console.error(`\nError: ${error.message}`);
		} else {
			console.error(`\nError:`, error);
		}
		process.exit(1);
	}
}

// Only run main if this is the main module
if (import.meta.main) {
	await main();
}
