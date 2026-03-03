import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("importCommand", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  let mockExistsSync: ReturnType<typeof vi.fn>;
  let mockReadFileSync: ReturnType<typeof vi.fn>;
  let mockInstallSkill: ReturnType<typeof vi.fn>;
  let mockWriteSkillMeta: ReturnType<typeof vi.fn>;
  let mockIsSkillInstalled: ReturnType<typeof vi.fn>;
  let mockGetProvider: ReturnType<typeof vi.fn>;
  let mockLoadConfig: ReturnType<typeof vi.fn>;
  let mockUpdateLockEntry: ReturnType<typeof vi.fn>;
  let mockValidateSlug: ReturnType<typeof vi.fn>;

  function setupMocks(
    overrides: {
      existsSync?: (path: string) => boolean;
      readFileSync?: (path: string) => string;
      isSkillInstalled?: (name: string) => boolean;
      validateSlug?: (slug: string, label: string) => void;
      providerFetch?: (name: string) => Promise<Array<{ path: string; content: string }>>;
      providerInfo?: (name: string) => Promise<Record<string, unknown> | null>;
    } = {},
  ) {
    mockExistsSync = vi.fn(overrides.existsSync ?? (() => true));
    mockReadFileSync = vi.fn(overrides.readFileSync ?? (() => '{"skills": []}'));
    mockInstallSkill = vi.fn();
    mockWriteSkillMeta = vi.fn();
    mockIsSkillInstalled = vi.fn(overrides.isSkillInstalled ?? (() => false));
    mockUpdateLockEntry = vi.fn();
    mockValidateSlug = vi.fn(overrides.validateSlug ?? (() => {}));

    const mockFetch = overrides.providerFetch ?? (async () => [{ path: "SKILL.md", content: "# test" }]);
    const mockInfo = overrides.providerInfo ?? (async () => ({ version: "1.0.0", description: "Test skill" }));

    mockGetProvider = vi.fn(() => ({
      name: "test-provider",
      fetch: mockFetch,
      info: mockInfo,
    }));

    mockLoadConfig = vi.fn(() => ({ defaultProvider: "github" }));

    vi.doMock("node:fs", () => ({
      existsSync: mockExistsSync,
      readFileSync: mockReadFileSync,
    }));

    vi.doMock("../registry.js", () => ({
      getProvider: mockGetProvider,
    }));

    vi.doMock("../utils/fs.js", () => ({
      installSkill: mockInstallSkill,
      writeSkillMeta: mockWriteSkillMeta,
      isSkillInstalled: mockIsSkillInstalled,
    }));

    vi.doMock("../utils/config.js", () => ({
      loadConfig: mockLoadConfig,
    }));

    vi.doMock("../utils/integrity.js", () => ({
      updateLockEntry: mockUpdateLockEntry,
    }));

    vi.doMock("../utils/validate.js", () => ({
      validateSlug: mockValidateSlug,
    }));
  }

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);
  });

  afterEach(() => {
    vi.resetModules();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("imports from valid manifest file", async () => {
    const manifest = {
      skills: [{ name: "alpha", source: "test-provider" }, { name: "beta" }],
    };

    setupMocks({
      readFileSync: () => JSON.stringify(manifest),
      isSkillInstalled: () => false,
    });
    const { importCommand } = await import("./import-cmd.js");

    await importCommand("manifest.json", {});

    expect(mockInstallSkill).toHaveBeenCalledTimes(2);
    expect(mockWriteSkillMeta).toHaveBeenCalledTimes(2);
    expect(mockUpdateLockEntry).toHaveBeenCalledTimes(2);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Installed alpha"));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Installed beta"));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("2 installed"));
  });

  it("--force reinstalls existing skills", async () => {
    const manifest = {
      skills: [{ name: "existing-skill" }],
    };

    setupMocks({
      readFileSync: () => JSON.stringify(manifest),
      isSkillInstalled: () => true, // skill already installed
    });
    const { importCommand } = await import("./import-cmd.js");

    await importCommand("manifest.json", { force: true });

    // With --force, it should install even though isSkillInstalled returns true
    expect(mockInstallSkill).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("1 installed"));
  });

  it("file not found exits with error", async () => {
    setupMocks({ existsSync: () => false });
    const { importCommand } = await import("./import-cmd.js");

    await expect(importCommand("missing.json", {})).rejects.toThrow("process.exit");
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("File not found"));
  });

  it("invalid manifest format exits with error", async () => {
    setupMocks({
      readFileSync: () => '{"not_skills": true}',
    });
    const { importCommand } = await import("./import-cmd.js");

    await expect(importCommand("bad.json", {})).rejects.toThrow("process.exit");
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid manifest"));
  });

  it("--json outputs structured JSON result", async () => {
    const manifest = {
      skills: [{ name: "installed-skill" }, { name: "already-here" }],
    };

    let callCount = 0;
    setupMocks({
      readFileSync: () => JSON.stringify(manifest),
      isSkillInstalled: () => {
        callCount++;
        return callCount > 1; // first = not installed, second = installed
      },
    });
    const { importCommand } = await import("./import-cmd.js");

    await importCommand("manifest.json", { json: true });

    const jsonCall = consoleLogSpy.mock.calls.find((call: unknown[]) => {
      try {
        const parsed = JSON.parse(call[0] as string);
        return parsed.installed !== undefined;
      } catch {
        return false;
      }
    });

    expect(jsonCall).toBeDefined();
    const output = JSON.parse(jsonCall![0] as string);
    expect(output.installed).toEqual(["installed-skill"]);
    expect(output.skipped).toEqual(["already-here"]);
    expect(output.failed).toEqual([]);
  });
});
