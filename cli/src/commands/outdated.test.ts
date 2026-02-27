import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("outdatedCommand", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("reports no skills installed", async () => {
    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => "/fake/skills"),
      readSkillMeta: vi.fn(() => null),
    }));
    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({ defaultProvider: "arcana" })),
    }));
    vi.doMock("../registry.js", () => ({
      getProvider: vi.fn(),
      getProviders: vi.fn(() => []),
    }));
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => false),
      readdirSync: vi.fn(() => []),
      statSync: vi.fn(),
    }));

    const { outdatedCommand } = await import("./outdated.js");
    await outdatedCommand({});

    expect(consoleLogSpy).toHaveBeenCalledWith("No skills installed.");
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it("reports all skills up to date", async () => {
    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => "/fake/skills"),
      readSkillMeta: vi.fn(() => ({
        version: "2.0.0",
        source: "test-provider",
      })),
    }));
    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({ defaultProvider: "test-provider" })),
    }));
    vi.doMock("../registry.js", () => ({
      getProvider: vi.fn(() => ({
        name: "test-provider",
        info: vi.fn(async () => ({ version: "2.0.0" })),
      })),
      getProviders: vi.fn(() => [
        {
          name: "test-provider",
          info: vi.fn(async () => ({ version: "2.0.0" })),
        },
      ]),
    }));
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn((p: string) => {
        if (p === "/fake/skills") return true;
        // SKILL.md check
        if (p.endsWith("SKILL.md")) return true;
        return false;
      }),
      readdirSync: vi.fn(() => ["my-skill"]),
      statSync: vi.fn(() => ({ isDirectory: () => true })),
    }));

    const { outdatedCommand } = await import("./outdated.js");
    await outdatedCommand({});

    expect(consoleLogSpy).toHaveBeenCalledWith("All skills are up to date.");
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it("reports outdated skills with semver comparison", async () => {
    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => "/fake/skills"),
      readSkillMeta: vi.fn((name: string) => {
        if (name === "skill-a") return { version: "1.0.0", source: "prov" };
        if (name === "skill-b") return { version: "2.0.0", source: "prov" };
        return null;
      }),
    }));
    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({ defaultProvider: "prov" })),
    }));
    vi.doMock("../registry.js", () => ({
      getProvider: vi.fn(),
      getProviders: vi.fn(() => [
        {
          name: "prov",
          info: vi.fn(async (skill: string) => {
            if (skill === "skill-a") return { version: "2.0.0" };
            if (skill === "skill-b") return { version: "2.0.0" };
            return null;
          }),
        },
      ]),
    }));
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn((p: string) => {
        if (p === "/fake/skills") return true;
        if (p.endsWith("SKILL.md")) return true;
        return false;
      }),
      readdirSync: vi.fn(() => ["skill-a", "skill-b"]),
      statSync: vi.fn(() => ({ isDirectory: () => true })),
    }));

    const { outdatedCommand } = await import("./outdated.js");
    await outdatedCommand({});

    // skill-a should be outdated (1.0.0 -> 2.0.0), skill-b should be up to date
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("1 outdated"),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("1 up to date"),
    );
  });

  it("outputs JSON when --json flag is set", async () => {
    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => "/fake/skills"),
      readSkillMeta: vi.fn(() => ({ version: "1.0.0", source: "prov" })),
    }));
    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({ defaultProvider: "prov" })),
    }));
    vi.doMock("../registry.js", () => ({
      getProvider: vi.fn(),
      getProviders: vi.fn(() => [
        {
          name: "prov",
          info: vi.fn(async () => ({ version: "3.0.0" })),
        },
      ]),
    }));
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn((p: string) => {
        if (p === "/fake/skills") return true;
        if (p.endsWith("SKILL.md")) return true;
        return false;
      }),
      readdirSync: vi.fn(() => ["my-skill"]),
      statSync: vi.fn(() => ({ isDirectory: () => true })),
    }));

    const { outdatedCommand } = await import("./outdated.js");
    await outdatedCommand({ json: true });

    const output = consoleLogSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("outdated");
    expect(parsed).toHaveProperty("upToDate");
    expect(parsed).toHaveProperty("total");
    expect(parsed.outdated).toHaveLength(1);
    expect(parsed.outdated[0].name).toBe("my-skill");
    expect(parsed.outdated[0].current).toBe("1.0.0");
    expect(parsed.outdated[0].available).toBe("3.0.0");
  });

  it("handles provider errors gracefully", async () => {
    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => "/fake/skills"),
      readSkillMeta: vi.fn(() => ({ version: "1.0.0", source: "prov" })),
    }));
    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({ defaultProvider: "prov" })),
    }));
    vi.doMock("../registry.js", () => ({
      getProvider: vi.fn(),
      getProviders: vi.fn(() => [
        {
          name: "prov",
          info: vi.fn(async () => {
            throw new Error("Network error");
          }),
        },
      ]),
    }));
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn((p: string) => {
        if (p === "/fake/skills") return true;
        if (p.endsWith("SKILL.md")) return true;
        return false;
      }),
      readdirSync: vi.fn(() => ["my-skill"]),
      statSync: vi.fn(() => ({ isDirectory: () => true })),
    }));

    const { outdatedCommand } = await import("./outdated.js");
    await outdatedCommand({});

    // When provider throws, skill is counted as up-to-date (not found)
    expect(consoleLogSpy).toHaveBeenCalledWith("All skills are up to date.");
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });
});
