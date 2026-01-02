#!/usr/bin/env bun

/**
 * Verify script for monorepo package publishing
 *
 * This script:
 * 1. Extracts package name and version from git tags (format: package-version)
 * 2. Verifies each tag matches the package.json
 * 3. Outputs package directories for the workflow to use (skipping already published)
 *
 * Git tags use format: package-version (e.g., "core-1.0.0", "sql-2.0.0")
 * Package.json uses scoped names (e.g., "@filtron/core", "@filtron/sql")
 *
 * Usage:
 *   bun run scripts/verify-tag.ts <tags...>
 *   Example: bun run scripts/verify-tag.ts core-1.1.0 sql-2.0.0
 *
 * Outputs (via GITHUB_OUTPUT):
 *   - packages: JSON array of {name, version, dir} objects for unpublished packages
 */

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

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

export type VerifyResult =
	| { status: "ok"; info: PackageInfo }
	| { status: "skip"; tag: string; reason: string }
	| { status: "error"; tag: string; reason: string };

/**
 * Parse a git tag into package name and version
 * Git tags use format: package-version (e.g., "core-1.0.0", "sql-2.0.0")
 * Only supports simple semver: X.Y.Z (no v prefix, no prerelease/build metadata)
 */
export function parseTag(tag: string): { shortName: string; version: string } | null {
	const match = tag.match(/^(.+)-((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*))$/);
	if (!match) return null;
	const [, shortName, version] = match;
	return { shortName, version };
}

/**
 * Map short package name to directory path
 */
export function getPackageDirectory(shortName: string): string | null {
	const packageDir = join("packages", shortName);
	if (!existsSync(packageDir) || !statSync(packageDir).isDirectory()) {
		return null;
	}
	return packageDir;
}

/**
 * Read and parse package.json using dynamic import
 */
export async function readPackageJson(packageDir: string): Promise<PackageJson> {
	const packageJsonPath = join(process.cwd(), packageDir, "package.json");
	const packageJson = await import(packageJsonPath, { with: { type: "json" } });
	return packageJson.default as PackageJson;
}

/**
 * Check if a package version is already published on npm
 */
export async function isPublished(packageName: string, version: string): Promise<boolean> {
	const proc = Bun.spawn(["bun", "info", `${packageName}@${version}`], {
		stdout: "ignore",
		stderr: "ignore",
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
 * Process a single tag and return result with status
 */
export async function processTag(tag: string): Promise<VerifyResult> {
	const parsed = parseTag(tag);
	if (!parsed) {
		return { status: "error", tag, reason: "invalid tag format" };
	}

	const { shortName, version } = parsed;
	const packageDir = getPackageDirectory(shortName);
	if (!packageDir) {
		return { status: "error", tag, reason: `package directory not found` };
	}

	let packageJson: PackageJson;
	try {
		packageJson = await readPackageJson(packageDir);
	} catch {
		return { status: "error", tag, reason: "could not read package.json" };
	}

	const expectedName = `@filtron/${shortName}`;
	if (packageJson.name !== expectedName) {
		return { status: "error", tag, reason: `name mismatch: ${packageJson.name}` };
	}

	if (packageJson.version !== version) {
		return { status: "error", tag, reason: `version mismatch: ${packageJson.version}` };
	}

	if (await isPublished(packageJson.name, version)) {
		return { status: "skip", tag, reason: "already published" };
	}

	return {
		status: "ok",
		info: { name: shortName, version, dir: packageDir },
	};
}

/**
 * Main execution
 */
export async function main() {
	const tags = Bun.argv.slice(2);

	if (tags.length === 0) {
		console.error(`Usage: bun run scripts/verify-tag.ts <tag> [<tag>...]`);
		process.exit(1);
	}

	console.log(`Verifying ${tags.length} tag(s)...\n`);

	const results = await Promise.all(tags.map(processTag));

	const toPublish: PackageInfo[] = [];
	const skipped: { tag: string; reason: string }[] = [];
	const errors: { tag: string; reason: string }[] = [];

	for (const result of results) {
		if (result.status === "ok") {
			toPublish.push(result.info);
		} else if (result.status === "skip") {
			skipped.push({ tag: result.tag, reason: result.reason });
		} else {
			errors.push({ tag: result.tag, reason: result.reason });
		}
	}

	if (toPublish.length > 0) {
		console.log("To publish:");
		console.table(toPublish);
	}

	if (skipped.length > 0) {
		console.log("\nSkipped:");
		console.table(skipped);
	}

	if (errors.length > 0) {
		console.log("\nErrors:");
		console.table(errors);
		process.exit(1);
	}

	// Output for GitHub Actions
	const githubOutput = Bun.env.GITHUB_OUTPUT;
	if (githubOutput) {
		const output = `packages=${JSON.stringify(toPublish)}\n`;
		const file = Bun.file(githubOutput);
		const existingContent = (await file.exists()) ? await file.text() : "";
		await Bun.write(githubOutput, existingContent + output);
	}

	if (toPublish.length === 0) {
		console.log("\nNo packages to publish.");
	} else {
		console.log(`\n${toPublish.length} package(s) ready to publish.`);
	}
}

if (import.meta.main) {
	await main();
}
