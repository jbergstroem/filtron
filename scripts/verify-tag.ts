#!/usr/bin/env bun

/**
 * Verify script for monorepo package publishing
 *
 * This script:
 * 1. Extracts package name and version from git tags (format: package-version)
 * 2. Verifies each tag matches the package.json
 * 3. Outputs package directories for the workflow to use
 *
 * Git tags use format: package-version (e.g., "core-1.0.0", "sql-2.0.0")
 * Package.json uses scoped names (e.g., "@filtron/core", "@filtron/sql")
 *
 * Usage:
 *   bun run scripts/verify-tag.ts <tags...>
 *   Example: bun run scripts/verify-tag.ts core-1.1.0 sql-2.0.0
 *
 * Outputs (via GITHUB_OUTPUT):
 *   - packages: JSON array of {name, version, dir} objects
 */

import { existsSync, statSync } from "bun:fs";
import { join } from "bun:path";

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
 * Git tags use format: package-version (e.g., "core-1.0.0", "sql-2.0.0")
 * Only supports simple semver: X.Y.Z (no v prefix, no prerelease/build metadata)
 */
export function parseTag(tag: string): {
	shortName: string;
	version: string;
} {
	// Simple semver regex: package-X.Y.Z format
	const match = tag.match(/^(.+)-((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*))$/);

	if (!match) {
		throw new Error(`Tag '${tag}' does not match pattern '{package}-{version}'`);
	}

	const [, shortName, version] = match;
	return { shortName, version };
}

/**
 * Map short package name to directory path
 * Short name like "core" or "sql" maps to "packages/core" or "packages/sql"
 */
export function getPackageDirectory(shortName: string): string {
	const packageDir = join("packages", shortName);

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

	const timeout = new Promise<number>((resolve) =>
		setTimeout(() => {
			proc.kill();
			resolve(1);
		}, 5000),
	);

	const exitCode = await Promise.race([proc.exited, timeout]);
	return exitCode === 0;
}

/**
 * Verify tag matches package.json
 * Note: packageJson.name is scoped (e.g., "@filtron/core") for npm publishing
 */
export async function verifyTag(
	shortName: string,
	version: string,
	packageDir: string,
): Promise<string> {
	const packageJson = await readPackageJson(packageDir);

	// Validate that the package.json name matches expected scoped format
	const expectedScopedName = `@filtron/${shortName}`;
	if (packageJson.name !== expectedScopedName) {
		throw new Error(
			`Package name mismatch! Expected: ${expectedScopedName}, package.json has: ${packageJson.name}`,
		);
	}

	if (packageJson.version !== version) {
		throw new Error(
			`Version mismatch! Tag specifies: ${version}, package.json has: ${packageJson.version}`,
		);
	}

	// Check npm using the scoped package name
	const published = await isPublished(packageJson.name, version);
	if (published) {
		throw new Error(`Version ${packageJson.name}@${version} is already published on npm`);
	}

	return packageJson.name;
}

/**
 * Process a single tag and return package info
 * Git tag uses short name (e.g., "core@1.0.0")
 * Returns scoped npm package name (e.g., "@filtron/core")
 */
async function processTag(tag: string): Promise<PackageInfo> {
	const { shortName, version } = parseTag(tag);
	const packageDir = getPackageDirectory(shortName);
	const scopedPackageName = await verifyTag(shortName, version, packageDir);

	return {
		name: scopedPackageName,
		version,
		dir: packageDir,
	};
}

/**
 * Main execution
 */
async function main() {
	try {
		const tags = Bun.argv.slice(2);

		if (tags.length === 0) {
			console.error(`Usage: bun run scripts/verify-tag.ts <tag> [<tag>...]`);
			console.error(`Example: bun run scripts/verify-tag.ts core-1.1.0 sql-2.0.0`);
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
		}
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
