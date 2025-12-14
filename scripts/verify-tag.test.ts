import { describe, expect, test, spyOn, afterEach } from "bun:test";
import {
	parseTag,
	getPackageDirectory,
	readPackageJson,
	verifyTag,
	isPublished,
	type PackageInfo,
} from "./verify-tag";

afterEach(() => {
	// Clean up spies after each test
	spyOn.restoreAll?.();
});

describe("parseTag", () => {
	test("parses valid scoped package tag", () => {
		const result = parseTag("@filtron/core@1.1.0");
		expect(result).toEqual({
			packageName: "@filtron/core",
			version: "1.1.0",
		});
	});

	test("parses tag with prerelease version", () => {
		const result = parseTag("@filtron/sql@2.0.0-beta.1");
		expect(result).toEqual({
			packageName: "@filtron/sql",
			version: "2.0.0-beta.1",
		});
	});

	test("parses tag with build metadata", () => {
		const result = parseTag("@filtron/js@1.0.0+build.123");
		expect(result).toEqual({
			packageName: "@filtron/js",
			version: "1.0.0+build.123",
		});
	});

	test("throws error for invalid tag format", () => {
		expect(() => parseTag("invalid-tag")).toThrow(
			"Tag 'invalid-tag' does not match pattern '@filtron/{package}@{version}'",
		);
	});

	test("throws error for tag without version", () => {
		expect(() => parseTag("@filtron/core")).toThrow(
			"Tag '@filtron/core' does not match pattern '@filtron/{package}@{version}'",
		);
	});

	test("throws error for tag with invalid version", () => {
		expect(() => parseTag("@filtron/core@invalid")).toThrow(
			"Tag '@filtron/core@invalid' does not match pattern '@filtron/{package}@{version}'",
		);
	});
});

describe("getPackageDirectory", () => {
	test("maps scoped package to correct directory", () => {
		const result = getPackageDirectory("@filtron/core");
		expect(result).toBe("packages/core");
	});

	test("throws error for non-filtron scoped package", () => {
		expect(() => getPackageDirectory("@other/package")).toThrow(
			"Unknown package name pattern: @other/package",
		);
	});

	test("throws error for unscoped package", () => {
		expect(() => getPackageDirectory("package")).toThrow("Unknown package name pattern: package");
	});

	test("throws error for non-existent package directory", () => {
		expect(() => getPackageDirectory("@filtron/nonexistent")).toThrow(
			"Package directory 'packages/nonexistent' does not exist",
		);
	});
});

describe("readPackageJson", () => {
	test("reads valid package.json", async () => {
		const packageJson = await readPackageJson("packages/core");
		expect(packageJson).toHaveProperty("name");
		expect(packageJson).toHaveProperty("version");
		expect(packageJson.name).toBe("@filtron/core");
	});

	test("throws error for non-existent directory", async () => {
		await expect(readPackageJson("packages/nonexistent")).rejects.toThrow(
			"Could not read package.json",
		);
	});
});

describe("isPublished", () => {
	test("returns true for published package version", async () => {
		const mockSpawn = spyOn(Bun, "spawn").mockReturnValue({
			exited: Promise.resolve(0),
		} as any);

		const result = await isPublished("@filtron/core", "1.1.0");
		expect(result).toBe(true);
		expect(mockSpawn).toHaveBeenCalledWith(["bun", "info", "@filtron/core@1.1.0"], {
			stdout: "pipe",
			stderr: "pipe",
		});
	});

	test("returns false for non-existent version", async () => {
		const mockSpawn = spyOn(Bun, "spawn").mockReturnValue({
			exited: Promise.resolve(1),
		} as any);

		const result = await isPublished("@filtron/core", "1.0.0-nonexistent-test-version");
		expect(result).toBe(false);
		expect(mockSpawn).toHaveBeenCalledWith(
			["bun", "info", "@filtron/core@1.0.0-nonexistent-test-version"],
			{
				stdout: "pipe",
				stderr: "pipe",
			},
		);
	});

	test("returns false for obscure prerelease version", async () => {
		const mockSpawn = spyOn(Bun, "spawn").mockReturnValue({
			exited: Promise.resolve(1),
		} as any);

		const result = await isPublished("@filtron/core", "999.999.999-alpha.nonexistent");
		expect(result).toBe(false);
		expect(mockSpawn).toHaveBeenCalledWith(
			["bun", "info", "@filtron/core@999.999.999-alpha.nonexistent"],
			{
				stdout: "pipe",
				stderr: "pipe",
			},
		);
	});
});

describe("verifyTag", () => {
	test("throws error for package name mismatch", async () => {
		const packageJson = await readPackageJson("packages/core");
		await expect(verifyTag("@wrong/name", packageJson.version, "packages/core")).rejects.toThrow(
			"Package name mismatch",
		);
	});

	test("throws error for version mismatch", async () => {
		const packageJson = await readPackageJson("packages/core");
		await expect(verifyTag(packageJson.name, "9.9.9", "packages/core")).rejects.toThrow(
			"Version mismatch",
		);
	});

	test("throws error for already published version", async () => {
		spyOn(Bun, "spawn").mockReturnValue({
			exited: Promise.resolve(0),
		} as any);

		const packageJson = await readPackageJson("packages/core");
		await expect(verifyTag(packageJson.name, packageJson.version, "packages/core")).rejects.toThrow(
			"already published on npm",
		);
	});
});

describe("end-to-end tag verification", () => {
	test("rejects if current version is already published", async () => {
		spyOn(Bun, "spawn").mockReturnValue({
			exited: Promise.resolve(0),
		} as any);

		const packageJson = await readPackageJson("packages/core");
		const tag = `${packageJson.name}@${packageJson.version}`;

		const { packageName, version } = parseTag(tag);
		const packageDir = getPackageDirectory(packageName);

		await expect(verifyTag(packageName, version, packageDir)).rejects.toThrow(
			"already published on npm",
		);
	});

	test("verifies unpublished version successfully", async () => {
		spyOn(Bun, "spawn").mockReturnValue({
			exited: Promise.resolve(1),
		} as any);

		const { packageName } = parseTag("@filtron/core@1.0.0-nonexistent-test");

		const published = await isPublished(packageName, "1.0.0-nonexistent-test");
		expect(published).toBe(false);
	});
});

describe("multiple tags processing", () => {
	test("processes multiple tags from newline-separated string", async () => {
		const tags = ["@filtron/core@1.0.0-nonexistent-test", "@filtron/sql@2.0.0-nonexistent-test"];

		const packages: PackageInfo[] = [];

		for (const tag of tags) {
			const { packageName, version } = parseTag(tag);
			const packageDir = getPackageDirectory(packageName);
			packages.push({ name: packageName, version, dir: packageDir });
		}

		expect(packages).toHaveLength(2);
		expect(packages[0]).toEqual({
			name: "@filtron/core",
			version: "1.0.0-nonexistent-test",
			dir: "packages/core",
		});
		expect(packages[1]).toEqual({
			name: "@filtron/sql",
			version: "2.0.0-nonexistent-test",
			dir: "packages/sql",
		});
	});

	test("filters empty tags from input", () => {
		const input = "@filtron/core@1.1.0\n\n@filtron/sql@2.0.0\n";
		const tags = input.split("\n").filter((tag) => tag.trim().length > 0);

		expect(tags).toHaveLength(2);
		expect(tags[0]).toBe("@filtron/core@1.1.0");
		expect(tags[1]).toBe("@filtron/sql@2.0.0");
	});

	test("handles single tag input", () => {
		const input = "@filtron/core@1.1.0";
		const tags = input.split("\n").filter((tag) => tag.trim().length > 0);

		expect(tags).toHaveLength(1);
		expect(tags[0]).toBe("@filtron/core@1.1.0");
	});
});
