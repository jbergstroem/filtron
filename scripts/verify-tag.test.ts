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
	test("parses valid package-version tag", () => {
		const result = parseTag("core-1.1.0");
		expect(result).toEqual({
			shortName: "core",
			version: "1.1.0",
		});
	});

	test("parses tag with multi-part package name", () => {
		const result = parseTag("my-package-1.0.0");
		expect(result).toEqual({
			shortName: "my-package",
			version: "1.0.0",
		});
	});

	test("rejects tag with prerelease version", () => {
		expect(() => parseTag("sql-2.0.0-beta.1")).toThrow(
			"Tag 'sql-2.0.0-beta.1' does not match pattern '{package}-{version}'",
		);
	});

	test("rejects tag with build metadata", () => {
		expect(() => parseTag("js-1.0.0+build.123")).toThrow(
			"Tag 'js-1.0.0+build.123' does not match pattern '{package}-{version}'",
		);
	});

	test("throws error for invalid tag format", () => {
		expect(() => parseTag("invalidtag")).toThrow(
			"Tag 'invalidtag' does not match pattern '{package}-{version}'",
		);
	});

	test("throws error for tag with invalid version", () => {
		expect(() => parseTag("core-invalid")).toThrow(
			"Tag 'core-invalid' does not match pattern '{package}-{version}'",
		);
	});
});

describe("getPackageDirectory", () => {
	test("maps short package name to correct directory", () => {
		const result = getPackageDirectory("core");
		expect(result).toBe("packages/core");
	});

	test("throws error for non-existent package directory", () => {
		expect(() => getPackageDirectory("nonexistent")).toThrow(
			"Package directory 'packages/nonexistent' does not exist",
		);
	});

	test("throws error when path exists but is not a directory", async () => {
		// Create a temporary file to test the isDirectory check
		const testFile = "/tmp/test-filtron-file";
		await Bun.write(testFile, "test");

		// Mock join to return our test file path
		const pathModule = await import("bun:path");
		const joinSpy = spyOn(pathModule, "join").mockReturnValue(testFile);

		try {
			expect(() => getPackageDirectory("core")).toThrow(`'${testFile}' is not a directory`);
		} finally {
			joinSpy.mockRestore();
			await Bun.write(testFile, "").catch(() => {});
		}
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
			kill: () => {},
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
			kill: () => {},
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
			kill: () => {},
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
		await expect(verifyTag("wrongname", packageJson.version, "packages/core")).rejects.toThrow(
			"Package name mismatch",
		);
	});

	test("throws error for version mismatch", async () => {
		await expect(verifyTag("core", "9.9.9", "packages/core")).rejects.toThrow("Version mismatch");
	});

	test("throws error for already published version", async () => {
		spyOn(Bun, "spawn").mockReturnValue({
			exited: Promise.resolve(0),
			kill: () => {},
		} as any);

		const packageJson = await readPackageJson("packages/core");
		await expect(verifyTag("core", packageJson.version, "packages/core")).rejects.toThrow(
			"already published on npm",
		);
	});

	test("succeeds when all checks pass", async () => {
		spyOn(Bun, "spawn").mockReturnValue({
			exited: Promise.resolve(1),
			kill: () => {},
		} as any);

		const packageJson = await readPackageJson("packages/core");
		const result = await verifyTag("core", packageJson.version, "packages/core");
		expect(result).toBe("@filtron/core");
	});
});

describe("end-to-end tag verification", () => {
	test("rejects if current version is already published", async () => {
		spyOn(Bun, "spawn").mockReturnValue({
			exited: Promise.resolve(0),
			kill: () => {},
		} as any);

		const packageJson = await readPackageJson("packages/core");
		const tag = `core-${packageJson.version}`;

		const { shortName, version } = parseTag(tag);
		const packageDir = getPackageDirectory(shortName);

		await expect(verifyTag(shortName, version, packageDir)).rejects.toThrow(
			"already published on npm",
		);
	});

	test("verifies unpublished version successfully", async () => {
		spyOn(Bun, "spawn").mockReturnValue({
			exited: Promise.resolve(1),
			kill: () => {},
		} as any);

		const { shortName } = parseTag("core-1.0.0");

		const published = await isPublished(`@filtron/${shortName}`, "1.0.0");
		expect(published).toBe(false);
	});
});

describe("multiple tags processing", () => {
	test("processes multiple tags from newline-separated string", async () => {
		const tags = ["core-1.0.0", "sql-2.0.0"];

		const packages: PackageInfo[] = [];

		for (const tag of tags) {
			const { shortName, version } = parseTag(tag);
			const packageDir = getPackageDirectory(shortName);
			packages.push({
				name: `@filtron/${shortName}`,
				version,
				dir: packageDir,
			});
		}

		expect(packages).toHaveLength(2);
		expect(packages[0]).toEqual({
			name: "@filtron/core",
			version: "1.0.0",
			dir: "packages/core",
		});
		expect(packages[1]).toEqual({
			name: "@filtron/sql",
			version: "2.0.0",
			dir: "packages/sql",
		});
	});

	test("filters empty tags from input", () => {
		const input = "core-1.1.0\n\nsql-2.0.0\n";
		const tags = input.split("\n").filter((tag) => tag.trim().length > 0);

		expect(tags).toHaveLength(2);
		expect(tags[0]).toBe("core-1.1.0");
		expect(tags[1]).toBe("sql-2.0.0");
	});

	test("handles single tag input", () => {
		const input = "core-1.1.0";
		const tags = input.split("\n").filter((tag) => tag.trim().length > 0);

		expect(tags).toHaveLength(1);
		expect(tags[0]).toBe("core-1.1.0");
	});
});
