#!/usr/bin/env bun

/**
 * Verify script for monorepo package publishing
 *
 * This script:
 * 1. Extracts package name and version from git tags (format: package@version)
 * 2. Verifies each tag matches the package.json
 * 3. Outputs package directories for the workflow to use
 *
 * Usage:
 *   bun run scripts/verify-tag.ts <tags...>
 *   Example: bun run scripts/verify-tag.ts @filtron/core@1.1.0 @filtron/sql@2.0.0
 *
 * Outputs (via GITHUB_OUTPUT):
 *   - packages: JSON array of {name, version, dir} objects
 */

import { existsSync, statSync } from "fs";
import { join } from "path";
import { parseArgs } from "util";

export interface PackageJson {
	name: string;
	version: string;
	[key: string]: unknown;
}

export interface PackageInfo {
	name: string;
	version: string;
	dir: string;
}

/**
 * Parse a git tag into package name and version
 */
export function parseTag(tag: string): {
	packageName: string;
	version: string;
} {
	// common semver regex without trailer
	const match = tag.match(/^(.+)@v?((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-.+)?(?:\+.+)?)$/);

	if (!match) {
		throw new Error(`Tag '${tag}' does not match pattern '{package}@{version}'`);
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
		const packageJson = await import(packageJsonPath, {
			with: { type: "json" },
		});
		return packageJson.default as PackageJson;
	} catch (error) {
		throw new Error(`Could not read package.json in ${packageDir}: ${error}`);
	}
}

/**
 * Check if a package version is already published on npm
 */
export async function isPublished(packageName: string, version: string): Promise<boolean> {
	const proc = Bun.spawn(["bun", "info", `${packageName}@${version}`], {
		stdout: "pipe",
		stderr: "pipe",
	});

	const exitCode = await proc.exited;
	return exitCode === 0;
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

	const published = await isPublished(packageName, version);
	if (published) {
		throw new Error(`Version ${packageName}@${version} is already published on npm`);
	}
}

/**
 * Process a single tag and return package info
 */
async function processTag(tag: string): Promise<PackageInfo> {
	const { packageName, version } = parseTag(tag);
	const packageDir = getPackageDirectory(packageName);
	await verifyTag(packageName, version, packageDir);

	return {
		name: packageName,
		version,
		dir: packageDir,
	};
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
			console.error(`Usage: bun run scripts/verify-tag.ts <tag> [<tag>...]`);
			console.error(`Example: bun run scripts/verify-tag.ts @filtron/core@1.1.0`);
			process.exit(1);
		}

		const tags = positionals[0].split("\n").filter((tag) => tag.trim().length > 0);

		if (tags.length === 0) {
			console.error(`No valid tags provided`);
			process.exit(1);
		}

		console.log(`\nVerifying ${tags.length} tag(s)...`);

		const packages: PackageInfo[] = [];

		for (const tag of tags) {
			console.log(`\n  Tag: ${tag}`);
			const pkg = await processTag(tag);
			console.log(`    Package: ${pkg.name}`);
			console.log(`    Version: ${pkg.version}`);
			console.log(`    Directory: ${pkg.dir}`);
			packages.push(pkg);
		}

		// Output for GitHub Actions
		const githubOutput = Bun.env.GITHUB_OUTPUT;
		if (githubOutput) {
			const output = `packages=${JSON.stringify(packages)}\n`;
			await Bun.write(githubOutput, output, { append: true });
			console.log(`\nOutputs written to GITHUB_OUTPUT`);
		}

		console.log(`\nVerification complete!\n`);
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
