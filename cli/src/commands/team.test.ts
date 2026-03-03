import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("teamCommand", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  let mockExistsSync: ReturnType<typeof vi.fn>;
  let mockReadFileSync: ReturnType<typeof vi.fn>;
  let mockMkdirSync: ReturnType<typeof vi.fn>;
  let mockAtomicWriteSync: ReturnType<typeof vi.fn>;
  let mockIsSkillInstalled: ReturnType<typeof vi.fn>;
  let mockReadSkillMeta: ReturnType<typeof vi.fn>;
  let mockValidateSlug: ReturnType<typeof vi.fn>;

  function setupMocks(
    overrides: {
      existsSync?: (path: string) => boolean;
      readFileSync?: (path: string) => string;
      isSkillInstalled?: (name: string) => boolean;
      readSkillMeta?: (name: string) => Record<string, unknown> | null;
      validateSlug?: (slug: string, label: string) => void;
    } = {},
  ) {
    mockExistsSync = vi.fn(overrides.existsSync ?? (() => false));
    mockReadFileSync = vi.fn(overrides.readFileSync ?? (() => "{}"));
    mockMkdirSync = vi.fn();
    mockAtomicWriteSync = vi.fn();
    mockIsSkillInstalled = vi.fn(overrides.isSkillInstalled ?? (() => false));
    mockReadSkillMeta = vi.fn(overrides.readSkillMeta ?? (() => null));
    mockValidateSlug = vi.fn(overrides.validateSlug ?? (() => {}));

    vi.doMock("node:fs", () => ({
      existsSync: mockExistsSync,
      readFileSync: mockReadFileSync,
      mkdirSync: mockMkdirSync,
    }));

    vi.doMock("../utils/atomic.js", () => ({
      atomicWriteSync: mockAtomicWriteSync,
    }));

    vi.doMock("../utils/fs.js", () => ({
      isSkillInstalled: mockIsSkillInstalled,
      readSkillMeta: mockReadSkillMeta,
      installSkill: vi.fn(),
      writeSkillMeta: vi.fn(),
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

  it("init creates team.json", async () => {
    setupMocks({ existsSync: () => false });
    const { teamCommand } = await import("./team.js");

    await teamCommand("init", undefined, {});

    expect(mockAtomicWriteSync).toHaveBeenCalledTimes(1);
    const writtenContent = JSON.parse(mockAtomicWriteSync.mock.calls[0][1]);
    expect(writtenContent).toHaveProperty("skills");
    expect(writtenContent.skills).toEqual([]);
    expect(writtenContent).toHaveProperty("updatedAt");
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Created"));
  });

  it("list when no team.json exists exits with error", async () => {
    setupMocks({ existsSync: () => false });
    const { teamCommand } = await import("./team.js");

    await expect(teamCommand(undefined, undefined, {})).rejects.toThrow("process.exit");
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("No team config found"));
  });

  it("add skill to team config", async () => {
    const teamConfig = {
      skills: [],
      updatedAt: "2025-01-01T00:00:00.000Z",
    };

    // existsSync: true for team config read, true for dir check
    setupMocks({
      existsSync: () => true,
      readFileSync: () => JSON.stringify(teamConfig),
      readSkillMeta: () => ({ version: "1.2.0", source: "github" }),
    });
    const { teamCommand } = await import("./team.js");

    await teamCommand("add", "my-skill", {});

    expect(mockValidateSlug).toHaveBeenCalledWith("my-skill", "skill name");
    expect(mockAtomicWriteSync).toHaveBeenCalledTimes(1);
    const written = JSON.parse(mockAtomicWriteSync.mock.calls[0][1]);
    expect(written.skills).toHaveLength(1);
    expect(written.skills[0].name).toBe("my-skill");
    expect(written.skills[0].version).toBe("1.2.0");
    expect(written.skills[0].source).toBe("github");
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Added my-skill"));
  });

  it("remove skill from team config", async () => {
    const teamConfig = {
      skills: [{ name: "old-skill" }, { name: "keep-skill" }],
      updatedAt: "2025-01-01T00:00:00.000Z",
    };

    setupMocks({
      existsSync: () => true,
      readFileSync: () => JSON.stringify(teamConfig),
    });
    const { teamCommand } = await import("./team.js");

    await teamCommand("remove", "old-skill", {});

    expect(mockAtomicWriteSync).toHaveBeenCalledTimes(1);
    const written = JSON.parse(mockAtomicWriteSync.mock.calls[0][1]);
    expect(written.skills).toHaveLength(1);
    expect(written.skills[0].name).toBe("keep-skill");
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Removed old-skill"));
  });

  it("sync installs missing skills", async () => {
    const teamConfig = {
      skills: [{ name: "new-skill", source: "test-provider" }, { name: "existing-skill" }],
      updatedAt: "2025-01-01T00:00:00.000Z",
    };

    const mockFetch = vi.fn().mockResolvedValue([{ path: "SKILL.md", content: "# skill content" }]);
    const mockInfo = vi.fn().mockResolvedValue({ version: "2.0.0", description: "A skill" });
    const mockInstallSkill = vi.fn();
    const mockWriteSkillMeta = vi.fn();
    const mockUpdateLockEntry = vi.fn();

    // isSkillInstalled: false for new-skill, true for existing-skill
    let isInstalledCallCount = 0;
    setupMocks({
      existsSync: () => true,
      readFileSync: () => JSON.stringify(teamConfig),
      isSkillInstalled: () => {
        isInstalledCallCount++;
        return isInstalledCallCount > 1; // first call = false, second = true
      },
    });

    // Override the lazy imports that teamSync uses
    vi.doMock("../registry.js", () => ({
      getProvider: vi.fn(() => ({
        name: "test-provider",
        fetch: mockFetch,
        info: mockInfo,
      })),
    }));

    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({ defaultProvider: "github" })),
    }));

    vi.doMock("../utils/integrity.js", () => ({
      updateLockEntry: mockUpdateLockEntry,
    }));

    // Re-mock fs.js with installSkill and writeSkillMeta
    vi.doMock("../utils/fs.js", () => ({
      isSkillInstalled: vi.fn(() => {
        isInstalledCallCount++;
        return isInstalledCallCount > 1;
      }),
      readSkillMeta: vi.fn(() => null),
      installSkill: mockInstallSkill,
      writeSkillMeta: mockWriteSkillMeta,
    }));

    const { teamCommand } = await import("./team.js");

    await teamCommand("sync", undefined, {});

    expect(mockFetch).toHaveBeenCalledWith("new-skill");
    expect(mockInstallSkill).toHaveBeenCalledTimes(1);
    expect(mockWriteSkillMeta).toHaveBeenCalledTimes(1);
    expect(mockUpdateLockEntry).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("1 installed"));
  });

  it("list --json outputs JSON with skills array", async () => {
    const teamConfig = {
      skills: [{ name: "skill-a", version: "1.0.0" }, { name: "skill-b" }],
      updatedAt: "2025-06-01T00:00:00.000Z",
    };

    setupMocks({
      existsSync: () => true,
      readFileSync: () => JSON.stringify(teamConfig),
    });
    const { teamCommand } = await import("./team.js");

    await teamCommand(undefined, undefined, { json: true });

    const jsonCall = consoleLogSpy.mock.calls.find((call: unknown[]) => {
      try {
        JSON.parse(call[0] as string);
        return true;
      } catch {
        return false;
      }
    });

    expect(jsonCall).toBeDefined();
    const output = JSON.parse(jsonCall![0] as string);
    expect(output).toHaveProperty("skills");
    expect(output.skills).toHaveLength(2);
    expect(output.skills[0].name).toBe("skill-a");
    expect(output.skills[1].name).toBe("skill-b");
    expect(output).toHaveProperty("updatedAt", "2025-06-01T00:00:00.000Z");
  });
});
