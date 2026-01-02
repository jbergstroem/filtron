import { describe, expect, test, spyOn } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import {
	parseTag,
	getPackageDirectory,
	readPackageJson,
	isPublished,
	processTag,
	main,
	type PackageInfo,
	type VerifyResult,
} from "./verify-tag";

describe("Verify tag", () => {
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

		test("returns null for tag with prerelease version", () => {
			expect(parseTag("sql-2.0.0-beta.1")).toBeNull();
		});

		test("returns null for tag with build metadata", () => {
			expect(parseTag("js-1.0.0+build.123")).toBeNull();
		});

		test("returns null for invalid tag format", () => {
			expect(parseTag("invalidtag")).toBeNull();
		});

		test("returns null for tag with invalid version", () => {
			expect(parseTag("core-invalid")).toBeNull();
		});
	});

	describe("getPackageDirectory", () => {
		test("maps short package name to correct directory", () => {
			const result = getPackageDirectory("core");
			expect(result).toBe("packages/core");
		});

		test("returns null for non-existent package directory", () => {
			expect(getPackageDirectory("nonexistent")).toBeNull();
		});

		test("returns null when path exists but is not a directory", async () => {
			const tmpDir = mkdtempSync(path.join(tmpdir(), "filtron-test-"));
			const testFile = path.join(tmpDir, "test-file");
			await Bun.write(testFile, "test");

			const joinSpy = spyOn(path, "join").mockReturnValue(testFile);

			try {
				expect(getPackageDirectory("core")).toBeNull();
			} finally {
				joinSpy.mockRestore();
				rmSync(tmpDir, { recursive: true, force: true });
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
			expect(() => readPackageJson("packages/nonexistent")).toThrow();
		});
	});

	describe("isPublished", () => {
		test("returns true for published package version", async () => {
			const mockSpawn = spyOn(Bun, "spawn").mockReturnValue({
				exited: Promise.resolve(0),
				kill: () => {},
			} as ReturnType<typeof Bun.spawn>);

			const result = await isPublished("@filtron/core", "1.1.0");
			expect(result).toBe(true);
			expect(mockSpawn).toHaveBeenCalledWith(["bun", "info", "@filtron/core@1.1.0"], {
				stdout: "ignore",
				stderr: "ignore",
			});
		});

		test("returns false for non-existent version", async () => {
			const mockSpawn = spyOn(Bun, "spawn").mockReturnValue({
				exited: Promise.resolve(1),
				kill: () => {},
			} as ReturnType<typeof Bun.spawn>);

			const result = await isPublished("@filtron/core", "1.0.0-nonexistent-test-version");
			expect(result).toBe(false);
			expect(mockSpawn).toHaveBeenCalledWith(
				["bun", "info", "@filtron/core@1.0.0-nonexistent-test-version"],
				{
					stdout: "ignore",
					stderr: "ignore",
				},
			);
		});

		test("returns false for obscure prerelease version", async () => {
			const mockSpawn = spyOn(Bun, "spawn").mockReturnValue({
				exited: Promise.resolve(1),
				kill: () => {},
			} as ReturnType<typeof Bun.spawn>);

			const result = await isPublished("@filtron/core", "999.999.999-alpha.nonexistent");
			expect(result).toBe(false);
			expect(mockSpawn).toHaveBeenCalledWith(
				["bun", "info", "@filtron/core@999.999.999-alpha.nonexistent"],
				{
					stdout: "ignore",
					stderr: "ignore",
				},
			);
		});

		test("returns false and kills process on timeout", async () => {
			let killCalled = false;
			const mockSpawn = spyOn(Bun, "spawn").mockReturnValue({
				exited: new Promise(() => {}), // Never resolves
				kill: () => {
					killCalled = true;
				},
			} as ReturnType<typeof Bun.spawn>);

			// Use a short timeout by mocking setTimeout
			const originalSetTimeout = globalThis.setTimeout;
			globalThis.setTimeout = ((fn: () => void, _ms: number) => {
				fn(); // Execute immediately
				return 0 as unknown as ReturnType<typeof setTimeout>;
			}) as typeof setTimeout;

			try {
				const result = await isPublished("@filtron/core", "1.0.0");
				expect(result).toBe(false);
				expect(killCalled).toBe(true);
			} finally {
				globalThis.setTimeout = originalSetTimeout;
				mockSpawn.mockRestore();
			}
		});
	});

	describe("processTag", () => {
		test("returns error for invalid tag format", async () => {
			const result = await processTag("invalid");
			expect(result).toEqual({
				status: "error",
				tag: "invalid",
				reason: "invalid tag format",
			});
		});

		test("returns error when package directory not found", async () => {
			const result = await processTag("nonexistent-1.0.0");
			expect(result).toEqual({
				status: "error",
				tag: "nonexistent-1.0.0",
				reason: "package directory not found",
			});
		});

		test("returns error when package.json cannot be read", async () => {
			// Mock getPackageDirectory to return a valid-looking path
			const pathJoin = path.join.bind(path);

			// Return a temp directory that exists but has no package.json
			const tmpDir = mkdtempSync(pathJoin(tmpdir(), "filtron-test-"));
			const joinSpy = spyOn(path, "join");

			joinSpy.mockImplementation((...args: string[]) => {
				if (args[0] === "packages" && args[1] === "testpkg") {
					return tmpDir;
				}
				return pathJoin(...args);
			});

			try {
				const result = await processTag("testpkg-1.0.0");
				expect(result.status).toBe("error");
				if (result.status === "error") {
					expect(result.reason).toBe("could not read package.json");
				}
			} finally {
				joinSpy.mockRestore();
				rmSync(tmpDir, { recursive: true, force: true });
			}
		});

		test("returns error for package name mismatch", async () => {
			const pathJoin = path.join.bind(path);
			const tmpDir = mkdtempSync(pathJoin(tmpdir(), "filtron-test-"));

			// Create a package.json with wrong name
			await Bun.write(
				pathJoin(tmpDir, "package.json"),
				JSON.stringify({ name: "@other/wrongpkg", version: "1.0.0" }),
			);

			const joinSpy = spyOn(path, "join").mockImplementation((...args: string[]) => {
				// For getPackageDirectory: join("packages", "wrongpkg")
				if (args[0] === "packages" && args[1] === "wrongpkg") {
					return tmpDir;
				}
				// For readPackageJson: join(process.cwd(), packageDir, "package.json")
				if (args[1] === tmpDir && args[2] === "package.json") {
					return pathJoin(tmpDir, "package.json");
				}
				return pathJoin(...args);
			});

			try {
				const result = await processTag("wrongpkg-1.0.0");
				expect(result.status).toBe("error");
				if (result.status === "error") {
					expect(result.reason).toBe("name mismatch: @other/wrongpkg");
				}
			} finally {
				joinSpy.mockRestore();
				rmSync(tmpDir, { recursive: true, force: true });
			}
		});

		test("returns error for version mismatch", async () => {
			const result = await processTag("core-99.99.99");
			expect(result.status).toBe("error");
			if (result.status === "error") {
				expect(result.reason).toContain("version mismatch");
			}
		});

		test("returns skip when package is already published", async () => {
			const packageJson = await readPackageJson("packages/core");

			const mockSpawn = spyOn(Bun, "spawn").mockReturnValue({
				exited: Promise.resolve(0),
				kill: () => {},
			} as ReturnType<typeof Bun.spawn>);

			const result = await processTag(`core-${packageJson.version}`);
			expect(result).toEqual({
				status: "skip",
				tag: `core-${packageJson.version}`,
				reason: "already published",
			});

			mockSpawn.mockRestore();
		});

		test("returns ok when package is not published", async () => {
			const packageJson = await readPackageJson("packages/core");

			const mockSpawn = spyOn(Bun, "spawn").mockReturnValue({
				exited: Promise.resolve(1),
				kill: () => {},
			} as ReturnType<typeof Bun.spawn>);

			const result = await processTag(`core-${packageJson.version}`);
			expect(result).toEqual({
				status: "ok",
				info: {
					name: "core",
					version: packageJson.version,
					dir: "packages/core",
				},
			});

			mockSpawn.mockRestore();
		});
	});

	describe("CI workflow: two tags on same commit, one already published", () => {
		// Scenario: Create two releases on the same commit (two Github releases)
		// 1. First release: core-X.Y.Z - triggers workflow, publishes core
		// 2. Second release: js-A.B.C - triggers workflow, should skip core, publish js
		test("second workflow run skips already-published tag and publishes new one", async () => {
			const corePackageJson = await readPackageJson("packages/core");
			const jsPackageJson = await readPackageJson("packages/js");

			// Simulate: core is already published, js is not
			const coreVersion = `@filtron/core@${corePackageJson.version}`;
			const mockSpawn = spyOn(Bun, "spawn").mockImplementation(
				(args) =>
					({
						exited: Promise.resolve((args as string[])[2] === coreVersion ? 0 : 1),
						kill: () => {},
					}) as ReturnType<typeof Bun.spawn>,
			);

			// This is what the CI sees: both tags point to HEAD
			const tagsAtHead = [`core-${corePackageJson.version}`, `js-${jsPackageJson.version}`];

			const results = await Promise.all(tagsAtHead.map(processTag));

			const toPublish = results.filter(
				(r): r is Extract<VerifyResult, { status: "ok" }> => r.status === "ok",
			);
			const skipped = results.filter(
				(r): r is Extract<VerifyResult, { status: "skip" }> => r.status === "skip",
			);

			expect(skipped).toHaveLength(1);
			expect(skipped[0].tag).toBe(`core-${corePackageJson.version}`);
			expect(skipped[0].reason).toBe("already published");

			expect(toPublish).toHaveLength(1);
			expect(toPublish[0].info.name).toBe("js");
			expect(toPublish[0].info.version).toBe(jsPackageJson.version);

			mockSpawn.mockRestore();
		});
	});

	describe("release flow scenarios", () => {
		test("skips already published package when processing multiple tags", async () => {
			// Simulate: core-1.3.1 already published, js-1.1.0 not published
			const mockSpawn = spyOn(Bun, "spawn").mockImplementation(
				(args) =>
					({
						exited: Promise.resolve((args as string[])[2] === "@filtron/core@1.3.1" ? 0 : 1),
						kill: () => {},
					}) as ReturnType<typeof Bun.spawn>,
			);

			const corePublished = await isPublished("@filtron/core", "1.3.1");
			const jsPublished = await isPublished("@filtron/js", "1.1.0");

			expect(corePublished).toBe(true);
			expect(jsPublished).toBe(false);

			mockSpawn.mockRestore();
		});

		test("handles sequential release flow where earlier tags get skipped", async () => {
			// Simulate release flow:
			// 1. First run: core-1.3.1 tag created, nothing published yet
			// 2. Second run: js-1.1.0 tag created, core-1.3.1 already published

			const tags = ["core-1.3.1", "js-1.1.0"];
			const alreadyPublished = new Set(["@filtron/core@1.3.1"]);

			const mockSpawn = spyOn(Bun, "spawn").mockImplementation(
				(args) =>
					({
						exited: Promise.resolve(alreadyPublished.has((args as string[])[2]) ? 0 : 1),
						kill: () => {},
					}) as ReturnType<typeof Bun.spawn>,
			);

			const results = await Promise.all(
				tags
					.map((tag) => {
						const parsed = parseTag(tag);
						if (!parsed) return null;
						return { tag, shortName: parsed.shortName, version: parsed.version };
					})
					.filter((t): t is NonNullable<typeof t> => t !== null)
					.map(async ({ tag, shortName, version }) => ({
						tag,
						status: (await isPublished(`@filtron/${shortName}`, version)) ? "skip" : "publish",
					})),
			);

			expect(results).toEqual([
				{ tag: "core-1.3.1", status: "skip" },
				{ tag: "js-1.1.0", status: "publish" },
			]);

			mockSpawn.mockRestore();
		});

		test("all tags skipped when everything is already published", async () => {
			const tags = ["core-1.3.1", "js-1.1.0", "sql-1.2.0"];

			const mockSpawn = spyOn(Bun, "spawn").mockReturnValue({
				exited: Promise.resolve(0), // All published
				kill: () => {},
			} as ReturnType<typeof Bun.spawn>);

			const toPublish = (
				await Promise.all(
					tags
						.map((tag) => {
							const parsed = parseTag(tag);
							if (!parsed) return null;
							const dir = getPackageDirectory(parsed.shortName);
							if (!dir) return null;
							return { shortName: parsed.shortName, version: parsed.version, dir };
						})
						.filter((t): t is NonNullable<typeof t> => t !== null)
						.map(async ({ shortName, version, dir }) => {
							const published = await isPublished(`@filtron/${shortName}`, version);
							return published ? null : { name: shortName, version, dir };
						}),
				)
			).filter((p): p is PackageInfo => p !== null);

			expect(toPublish).toEqual([]);

			mockSpawn.mockRestore();
		});

		test("first release run publishes all new tags", async () => {
			const tags = ["core-1.3.1", "js-1.1.0"];

			const mockSpawn = spyOn(Bun, "spawn").mockReturnValue({
				exited: Promise.resolve(1), // Nothing published yet
				kill: () => {},
			} as ReturnType<typeof Bun.spawn>);

			const toPublish = (
				await Promise.all(
					tags
						.map((tag) => {
							const parsed = parseTag(tag);
							if (!parsed) return null;
							const dir = getPackageDirectory(parsed.shortName);
							if (!dir) return null;
							return { shortName: parsed.shortName, version: parsed.version, dir };
						})
						.filter((t): t is NonNullable<typeof t> => t !== null)
						.map(async ({ shortName, version, dir }) => {
							const published = await isPublished(`@filtron/${shortName}`, version);
							return published ? null : { name: shortName, version, dir };
						}),
				)
			).filter((p): p is PackageInfo => p !== null);

			expect(toPublish).toEqual([
				{ name: "core", version: "1.3.1", dir: "packages/core" },
				{ name: "js", version: "1.1.0", dir: "packages/js" },
			]);

			mockSpawn.mockRestore();
		});
	});

	describe("main", () => {
		test("exits with error when no tags provided", async () => {
			const originalArgv = Bun.argv;
			const exitSpy = spyOn(process, "exit").mockImplementation(() => {
				throw new Error("process.exit called");
			});
			const errorSpy = spyOn(console, "error").mockImplementation(() => {});

			// @ts-expect-error - Bun.argv is readonly but we need to mock it
			Bun.argv = ["bun", "verify-tag.ts"];

			try {
				let error: Error | undefined;
				try {
					await main();
				} catch (e) {
					error = e as Error;
				}
				expect(error?.message).toBe("process.exit called");
				expect(errorSpy).toHaveBeenCalledWith(
					"Usage: bun run scripts/verify-tag.ts <tag> [<tag>...]",
				);
			} finally {
				// @ts-expect-error - restoring argv
				Bun.argv = originalArgv;
				exitSpy.mockRestore();
				errorSpy.mockRestore();
			}
		});

		test("processes valid tags and outputs results", async () => {
			const packageJson = await readPackageJson("packages/core");
			const originalArgv = Bun.argv;
			const logSpy = spyOn(console, "log").mockImplementation(() => {});
			const tableSpy = spyOn(console, "table").mockImplementation(() => {});

			const mockSpawn = spyOn(Bun, "spawn").mockReturnValue({
				exited: Promise.resolve(1), // Not published
				kill: () => {},
			} as ReturnType<typeof Bun.spawn>);

			// @ts-expect-error - Bun.argv is readonly
			Bun.argv = ["bun", "verify-tag.ts", `core-${packageJson.version}`];

			try {
				await main();
				expect(logSpy).toHaveBeenCalledWith("Verifying 1 tag(s)...\n");
				expect(logSpy).toHaveBeenCalledWith("To publish:");
				expect(logSpy).toHaveBeenCalledWith("\n1 package(s) ready to publish.");
			} finally {
				// @ts-expect-error - restoring argv
				Bun.argv = originalArgv;
				logSpy.mockRestore();
				tableSpy.mockRestore();
				mockSpawn.mockRestore();
			}
		});

		test("exits with error when tags have errors", async () => {
			const originalArgv = Bun.argv;
			const exitSpy = spyOn(process, "exit").mockImplementation(() => {
				throw new Error("process.exit called");
			});
			const logSpy = spyOn(console, "log").mockImplementation(() => {});
			const tableSpy = spyOn(console, "table").mockImplementation(() => {});

			// @ts-expect-error - Bun.argv is readonly
			Bun.argv = ["bun", "verify-tag.ts", "invalid-tag"];

			try {
				let error: Error | undefined;
				try {
					await main();
				} catch (e) {
					error = e as Error;
				}
				expect(error?.message).toBe("process.exit called");
				expect(logSpy).toHaveBeenCalledWith("\nErrors:");
			} finally {
				// @ts-expect-error - restoring argv
				Bun.argv = originalArgv;
				exitSpy.mockRestore();
				logSpy.mockRestore();
				tableSpy.mockRestore();
			}
		});

		test("handles skipped packages", async () => {
			const packageJson = await readPackageJson("packages/core");
			const originalArgv = Bun.argv;
			const logSpy = spyOn(console, "log").mockImplementation(() => {});
			const tableSpy = spyOn(console, "table").mockImplementation(() => {});

			const mockSpawn = spyOn(Bun, "spawn").mockReturnValue({
				exited: Promise.resolve(0), // Already published
				kill: () => {},
			} as ReturnType<typeof Bun.spawn>);

			// @ts-expect-error - Bun.argv is readonly
			Bun.argv = ["bun", "verify-tag.ts", `core-${packageJson.version}`];

			try {
				await main();
				expect(logSpy).toHaveBeenCalledWith("\nSkipped:");
				expect(logSpy).toHaveBeenCalledWith("\nNo packages to publish.");
			} finally {
				// @ts-expect-error - restoring argv
				Bun.argv = originalArgv;
				logSpy.mockRestore();
				tableSpy.mockRestore();
				mockSpawn.mockRestore();
			}
		});

		test("writes to GITHUB_OUTPUT when available", async () => {
			const packageJson = await readPackageJson("packages/core");
			const originalArgv = Bun.argv;
			const originalEnv = Bun.env.GITHUB_OUTPUT;
			const pathJoin = path.join.bind(path);
			const tmpDir = mkdtempSync(pathJoin(tmpdir(), "filtron-test-"));
			const outputFile = pathJoin(tmpDir, "github-output");

			const logSpy = spyOn(console, "log").mockImplementation(() => {});
			const tableSpy = spyOn(console, "table").mockImplementation(() => {});

			const mockSpawn = spyOn(Bun, "spawn").mockReturnValue({
				exited: Promise.resolve(1), // Not published
				kill: () => {},
			} as ReturnType<typeof Bun.spawn>);

			// @ts-expect-error - Bun.argv is readonly
			Bun.argv = ["bun", "verify-tag.ts", `core-${packageJson.version}`];
			Bun.env.GITHUB_OUTPUT = outputFile;

			try {
				await main();
				const content = await Bun.file(outputFile).text();
				expect(content).toContain("packages=");
				expect(content).toContain(`"name":"core"`);
				expect(content).toContain(`"version":"${packageJson.version}"`);
			} finally {
				// @ts-expect-error - restoring argv
				Bun.argv = originalArgv;
				Bun.env.GITHUB_OUTPUT = originalEnv;
				logSpy.mockRestore();
				tableSpy.mockRestore();
				mockSpawn.mockRestore();
				rmSync(tmpDir, { recursive: true, force: true });
			}
		});
	});

	describe("multiple tags processing", () => {
		test("processes multiple tags and builds package info", () => {
			const tags = ["core-1.0.0", "sql-2.0.0"];

			const packages: PackageInfo[] = [];

			for (const tag of tags) {
				const parsed = parseTag(tag);
				if (!parsed) continue;

				const { shortName, version } = parsed;
				const dir = getPackageDirectory(shortName);
				if (!dir) continue;

				packages.push({ name: shortName, version, dir });
			}

			expect(packages).toHaveLength(2);
			expect(packages[0]).toEqual({
				name: "core",
				version: "1.0.0",
				dir: "packages/core",
			});
			expect(packages[1]).toEqual({
				name: "sql",
				version: "2.0.0",
				dir: "packages/sql",
			});
		});

		test("handles single tag", () => {
			const tag = "core-1.1.0";
			const parsed = parseTag(tag);

			expect(parsed).toEqual({
				shortName: "core",
				version: "1.1.0",
			});
		});

		test("skips invalid tags in a list", () => {
			const tags = ["core-1.0.0", "invalid", "sql-2.0.0"];

			const packages: PackageInfo[] = [];

			for (const tag of tags) {
				const parsed = parseTag(tag);
				if (!parsed) continue;

				const { shortName, version } = parsed;
				const dir = getPackageDirectory(shortName);
				if (!dir) continue;

				packages.push({ name: shortName, version, dir });
			}

			expect(packages).toHaveLength(2);
		});
	});
});
