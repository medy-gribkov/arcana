import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("updateCommand", () => {
  let updateCommand: typeof import("./update.js").updateCommand;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let mockProvider: {
    name: string;
    fetch: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.resetModules();

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    mockProvider = {
      name: "test-provider",
      fetch: vi.fn(async () => [{ path: "SKILL.md", content: "---\nname: test\n---\nBody" }]),
      info: vi.fn(async () => ({ name: "test", version: "2.0.0", description: "Test skill" })),
      list: vi.fn(async () => [
        { name: "skill-a", version: "2.0.0", description: "Skill A" },
        { name: "skill-b", version: "1.0.0", description: "Skill B" },
      ]),
      search: vi.fn(async () => []),
    };

    vi.doMock("../utils/ui.js", () => ({
      ui: {
        bold: (s: string) => s,
        dim: (s: string) => s,
        error: (s: string) => s,
        success: (s: string) => s,
      },
      banner: vi.fn(),
      spinner: vi.fn(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        succeed: vi.fn(),
        fail: vi.fn(),
        info: vi.fn(),
        set text(_: string) {},
      })),
      noopSpinner: vi.fn(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        succeed: vi.fn(),
        fail: vi.fn(),
        info: vi.fn(),
        set text(_: string) {},
      })),
    }));

    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => "/fake/skills"),
      installSkill: vi.fn(),
      readSkillMeta: vi.fn(() => ({ version: "1.0.0", source: "test-provider" })),
      writeSkillMeta: vi.fn(),
    }));

    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => ["skill-a", "skill-b"]),
      statSync: vi.fn(() => ({ isDirectory: () => true })),
    }));

    vi.doMock("../registry.js", () => ({
      getProvider: vi.fn(() => mockProvider),
      getProviders: vi.fn(() => [mockProvider]),
    }));

    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({ defaultProvider: "test-provider" })),
    }));

    vi.doMock("../utils/validate.js", () => ({
      validateSlug: vi.fn(),
    }));

    vi.doMock("../utils/integrity.js", () => ({
      updateLockEntry: vi.fn(),
    }));

    const mod = await import("./update.js");
    updateCommand = mod.updateCommand;
  });

  afterEach(() => {
    vi.resetModules();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("exits with error when no skills specified and not --all", async () => {
    await updateCommand([], { json: true });
    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ error: "Specify a skill name or use --all" }));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("returns empty result when install dir missing (JSON)", async () => {
    vi.resetModules();

    vi.doMock("../utils/ui.js", () => ({
      ui: { bold: (s: string) => s, dim: (s: string) => s, error: (s: string) => s },
      banner: vi.fn(),
      spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), succeed: vi.fn(), fail: vi.fn(), info: vi.fn() })),
      noopSpinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), succeed: vi.fn(), fail: vi.fn(), info: vi.fn() })),
    }));

    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => "/nonexistent"),
      installSkill: vi.fn(),
      readSkillMeta: vi.fn(() => null),
      writeSkillMeta: vi.fn(),
    }));

    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => false),
      readdirSync: vi.fn(() => []),
      statSync: vi.fn(() => ({ isDirectory: () => true })),
    }));

    vi.doMock("../registry.js", () => ({
      getProvider: vi.fn(() => mockProvider),
      getProviders: vi.fn(() => [mockProvider]),
    }));

    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({ defaultProvider: "test-provider" })),
    }));

    vi.doMock("../utils/validate.js", () => ({ validateSlug: vi.fn() }));
    vi.doMock("../utils/integrity.js", () => ({ updateLockEntry: vi.fn() }));

    const mod = await import("./update.js");
    await mod.updateCommand([], { all: true, json: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ updated: [], upToDate: [], failed: [] }));
  });

  it("--all --dry-run reports available updates (JSON)", async () => {
    await updateCommand([], { all: true, dryRun: true, json: true });

    const output = consoleLogSpy.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("wouldUpdate"),
    );
    expect(output).toBeDefined();
    const parsed = JSON.parse(output![0] as string);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.wouldUpdate).toBeInstanceOf(Array);
    // skill-a has remote 2.0.0 vs local 1.0.0
    expect(parsed.wouldUpdate.some((u: { name: string }) => u.name === "skill-a")).toBe(true);
  });

  it("updates a single skill (JSON)", async () => {
    await updateCommand(["skill-a"], { json: true });

    expect(mockProvider.info).toHaveBeenCalledWith("skill-a");
    const output = consoleLogSpy.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("updated"),
    );
    expect(output).toBeDefined();
  });

  it("reports up-to-date for current skill (JSON)", async () => {
    mockProvider.info.mockResolvedValueOnce({ name: "test", version: "1.0.0", description: "Test" });

    await updateCommand(["test"], { json: true });

    const output = consoleLogSpy.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("upToDate"),
    );
    expect(output).toBeDefined();
    const parsed = JSON.parse(output![0] as string);
    expect(parsed.upToDate).toContain("test");
  });

  it("single skill dry-run shows would-update (JSON)", async () => {
    await updateCommand(["skill-a"], { dryRun: true, json: true });

    const output = consoleLogSpy.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("wouldUpdate"),
    );
    expect(output).toBeDefined();
    const parsed = JSON.parse(output![0] as string);
    expect(parsed.dryRun).toBe(true);
  });
});
