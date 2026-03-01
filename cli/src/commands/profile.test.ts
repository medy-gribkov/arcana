import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("profileCommand", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  let storedProfiles: Record<string, string[]>;
  let mockAtomicWriteSync: ReturnType<typeof vi.fn>;
  let mockExistsSync: ReturnType<typeof vi.fn>;
  let mockReadFileSync: ReturnType<typeof vi.fn>;

  function setupMocks(profiles: Record<string, string[]> = {}) {
    storedProfiles = { ...profiles };

    mockAtomicWriteSync = vi.fn((path: string, content: string) => {
      storedProfiles = JSON.parse(content);
    });

    mockExistsSync = vi.fn((path: string) => {
      if (typeof path === "string" && path.endsWith("profiles.json")) {
        return Object.keys(storedProfiles).length > 0;
      }
      return true;
    });

    mockReadFileSync = vi.fn((path: string) => {
      if (typeof path === "string" && path.endsWith("profiles.json")) {
        return JSON.stringify(storedProfiles);
      }
      return "";
    });

    vi.doMock("node:fs", () => ({
      existsSync: mockExistsSync,
      readFileSync: mockReadFileSync,
      mkdirSync: vi.fn(),
    }));

    vi.doMock("node:os", () => ({
      homedir: vi.fn(() => "/fake/home"),
    }));

    vi.doMock("../utils/atomic.js", () => ({
      atomicWriteSync: mockAtomicWriteSync,
    }));

    vi.doMock("../utils/validate.js", () => ({
      validateSlug: vi.fn((value: string, label: string) => {
        if (!/^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/.test(value)) {
          throw new Error(`Invalid ${label}: "${value}". Only letters, numbers, hyphens, dots, underscores allowed.`);
        }
      }),
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
    vi.restoreAllMocks();
  });

  it("list profiles when empty", async () => {
    setupMocks({});
    const { profileCommand } = await import("./profile.js");

    await profileCommand("list", undefined, [], {});

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("No profiles defined");
  });

  it("list profiles when profiles exist", async () => {
    setupMocks({ frontend: ["react", "tailwind"], backend: ["golang"] });
    const { profileCommand } = await import("./profile.js");

    await profileCommand("list", undefined, [], {});

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("2 profile(s)");
    expect(output).toContain("frontend");
    expect(output).toContain("backend");
  });

  it("create profile writes to storage", async () => {
    setupMocks({});
    const { profileCommand } = await import("./profile.js");

    await profileCommand("create", "webdev", ["react", "typescript"], {});

    expect(mockAtomicWriteSync).toHaveBeenCalledTimes(1);
    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain('Created profile "webdev"');
    expect(output).toContain("react");
    expect(output).toContain("typescript");
  });

  it("show profile displays skills", async () => {
    setupMocks({ devops: ["docker", "kubernetes", "terraform"] });
    const { profileCommand } = await import("./profile.js");

    await profileCommand("show", "devops", [], {});

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain('"devops"');
    expect(output).toContain("3 skill(s)");
    expect(output).toContain("docker");
    expect(output).toContain("kubernetes");
    expect(output).toContain("terraform");
  });

  it("show profile not found exits with error", async () => {
    setupMocks({});
    const { profileCommand } = await import("./profile.js");

    await expect(profileCommand("show", "missing", [], {})).rejects.toThrow("process.exit");
    expect(processExitSpy).toHaveBeenCalledWith(1);
    const errorOutput = consoleErrorSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(errorOutput).toContain("not found");
  });

  it("delete profile removes from storage", async () => {
    setupMocks({ temp: ["skill-a"] });
    const { profileCommand } = await import("./profile.js");

    await profileCommand("delete", "temp", [], {});

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain('Deleted profile "temp"');
    expect(mockAtomicWriteSync).toHaveBeenCalledTimes(1);
    // The written content should not contain "temp"
    expect(storedProfiles).not.toHaveProperty("temp");
  });

  it("create profile --json returns JSON", async () => {
    setupMocks({});
    const { profileCommand } = await import("./profile.js");

    await profileCommand("create", "data", ["pandas", "numpy"], { json: true });

    const jsonCall = consoleLogSpy.mock.calls.find((call) => {
      try {
        JSON.parse(call[0] as string);
        return true;
      } catch {
        return false;
      }
    });
    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall![0] as string);
    expect(parsed).toHaveProperty("created", "data");
    expect(parsed).toHaveProperty("skills");
    expect(parsed.skills).toEqual(["pandas", "numpy"]);
  });

  it("apply profile installs missing skills", async () => {
    setupMocks({ myprofile: ["skill-a", "skill-b"] });

    const mockFetch = vi.fn().mockResolvedValue([{ path: "SKILL.md", content: "# Skill" }]);
    const mockInfo = vi.fn().mockResolvedValue({ version: "1.0.0", description: "A skill" });
    const mockInstallSkill = vi.fn();
    const mockWriteSkillMeta = vi.fn();
    const mockIsSkillInstalled = vi
      .fn()
      .mockReturnValueOnce(true) // skill-a already installed
      .mockReturnValueOnce(false); // skill-b needs install

    vi.doMock("../registry.js", () => ({
      getProvider: vi.fn(() => ({
        name: "test-provider",
        fetch: mockFetch,
        info: mockInfo,
      })),
    }));

    vi.doMock("../utils/fs.js", () => ({
      installSkill: mockInstallSkill,
      writeSkillMeta: mockWriteSkillMeta,
      isSkillInstalled: mockIsSkillInstalled,
    }));

    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({ defaultProvider: "github" })),
    }));

    const { profileCommand } = await import("./profile.js");

    await profileCommand("apply", "myprofile", [], { json: true });

    const jsonCall = consoleLogSpy.mock.calls.find((call) => {
      try {
        JSON.parse(call[0] as string);
        return true;
      } catch {
        return false;
      }
    });
    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall![0] as string);
    expect(parsed).toHaveProperty("applied", "myprofile");
    expect(parsed.skipped).toContain("skill-a");
    expect(parsed.installed).toContain("skill-b");
    expect(parsed.failed).toEqual([]);
    expect(mockFetch).toHaveBeenCalledWith("skill-b");
    expect(mockInstallSkill).toHaveBeenCalledTimes(1);
  });
});
