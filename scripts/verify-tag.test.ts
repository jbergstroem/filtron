import { describe, expect, test } from "bun:test";
import { parseTag, getPackageDirectory, readPackageJson, verifyTag } from "./verify-tag";

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

describe("verifyTag", () => {
	test("verifies matching tag and package.json", async () => {
		const packageJson = await readPackageJson("packages/core");
		await expect(
			verifyTag(packageJson.name, packageJson.version, "packages/core"),
		).resolves.toBeUndefined();
	});

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
});

describe("end-to-end tag verification", () => {
	test("successfully verifies valid tag for @filtron/core", async () => {
		const packageJson = await readPackageJson("packages/core");
		const tag = `${packageJson.name}@${packageJson.version}`;

		const { packageName, version } = parseTag(tag);
		const packageDir = getPackageDirectory(packageName);

		await expect(verifyTag(packageName, version, packageDir)).resolves.toBeUndefined();
	});

	test("successfully verifies valid tag for @filtron/sql", async () => {
		const packageJson = await readPackageJson("packages/sql");
		const tag = `${packageJson.name}@${packageJson.version}`;

		const { packageName, version } = parseTag(tag);
		const packageDir = getPackageDirectory(packageName);

		await expect(verifyTag(packageName, version, packageDir)).resolves.toBeUndefined();
	});
});
