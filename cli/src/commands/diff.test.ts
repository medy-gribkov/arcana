import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";

class ExitError extends Error {
  code: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.code = code;
  }
}

describe("diffCommand", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  const INSTALL_DIR = "/fake/skills";
  const SKILL_DIR = join(INSTALL_DIR, "my-skill");

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((code?: number | string | null | undefined) => {
        throw new ExitError(Number(code ?? 0));
      });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("reports no differences when local and remote match", async () => {
    vi.doMock("../utils/validate.js", () => ({
      validateSlug: vi.fn(),
    }));
    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => INSTALL_DIR),
      readSkillMeta: vi.fn(() => ({ version: "1.0.0" })),
    }));
    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({ defaultProvider: "arcana" })),
    }));
    vi.doMock("../registry.js", () => ({
      getProvider: vi.fn(() => ({
        fetch: vi.fn(async () => [
          { path: "SKILL.md", content: "# Hello" },
        ]),
        info: vi.fn(async () => ({ version: "1.0.0" })),
      })),
    }));
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn(() => "# Hello"),
      readdirSync: vi.fn((dir: string) => {
        if (dir === SKILL_DIR) return ["SKILL.md"];
        return [];
      }),
      lstatSync: vi.fn(() => ({
        isDirectory: () => false,
        isSymbolicLink: () => false,
      })),
    }));

    const { diffCommand } = await import("./diff.js");
    await diffCommand("my-skill", {});

    expect(consoleLogSpy).toHaveBeenCalledWith("  No differences found.");
  });

  it("reports added, removed, and modified files", async () => {
    vi.doMock("../utils/validate.js", () => ({
      validateSlug: vi.fn(),
    }));
    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => INSTALL_DIR),
      readSkillMeta: vi.fn(() => ({ version: "1.0.0" })),
    }));
    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({ defaultProvider: "arcana" })),
    }));
    vi.doMock("../registry.js", () => ({
      getProvider: vi.fn(() => ({
        fetch: vi.fn(async () => [
          { path: "SKILL.md", content: "# Updated" },
          { path: "new-file.md", content: "new content" },
        ]),
        info: vi.fn(async () => ({ version: "2.0.0" })),
      })),
    }));
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn(() => "# Original"),
      readdirSync: vi.fn((dir: string) => {
        if (dir === SKILL_DIR) return ["SKILL.md", "old-file.md"];
        return [];
      }),
      lstatSync: vi.fn(() => ({
        isDirectory: () => false,
        isSymbolicLink: () => false,
      })),
    }));

    const { diffCommand } = await import("./diff.js");
    await diffCommand("my-skill", {});

    // added: new-file.md (in remote, not local)
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Added (1)"),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("+ new-file.md"),
    );
    // removed: old-file.md (in local, not remote)
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Removed (1)"),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("- old-file.md"),
    );
    // modified: SKILL.md (content differs)
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Modified (1)"),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("~ SKILL.md"),
    );
  });

  it("outputs JSON when --json flag is set", async () => {
    vi.doMock("../utils/validate.js", () => ({
      validateSlug: vi.fn(),
    }));
    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => INSTALL_DIR),
      readSkillMeta: vi.fn(() => ({ version: "1.0.0" })),
    }));
    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({ defaultProvider: "arcana" })),
    }));
    vi.doMock("../registry.js", () => ({
      getProvider: vi.fn(() => ({
        fetch: vi.fn(async () => [
          { path: "SKILL.md", content: "# Hello" },
        ]),
        info: vi.fn(async () => ({ version: "1.0.0" })),
      })),
    }));
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn(() => "# Hello"),
      readdirSync: vi.fn((dir: string) => {
        if (dir === SKILL_DIR) return ["SKILL.md"];
        return [];
      }),
      lstatSync: vi.fn(() => ({
        isDirectory: () => false,
        isSymbolicLink: () => false,
      })),
    }));

    const { diffCommand } = await import("./diff.js");
    await diffCommand("my-skill", { json: true });

    const output = consoleLogSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("skill", "my-skill");
    expect(parsed).toHaveProperty("localVersion", "1.0.0");
    expect(parsed).toHaveProperty("remoteVersion", "1.0.0");
    expect(parsed).toHaveProperty("added");
    expect(parsed).toHaveProperty("removed");
    expect(parsed).toHaveProperty("modified");
  });

  it("exits with error when skill is not installed", async () => {
    vi.doMock("../utils/validate.js", () => ({
      validateSlug: vi.fn(),
    }));
    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => INSTALL_DIR),
      readSkillMeta: vi.fn(() => null),
    }));
    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({ defaultProvider: "arcana" })),
    }));
    vi.doMock("../registry.js", () => ({
      getProvider: vi.fn(),
    }));
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => false),
      readFileSync: vi.fn(),
      readdirSync: vi.fn(() => []),
      lstatSync: vi.fn(),
    }));

    const { diffCommand } = await import("./diff.js");

    await expect(diffCommand("not-installed", {})).rejects.toThrow(ExitError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("not installed"),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with error for invalid skill name", async () => {
    vi.doMock("../utils/validate.js", () => ({
      validateSlug: vi.fn(() => {
        throw new Error("Invalid skill name: bad@name");
      }),
    }));
    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => INSTALL_DIR),
      readSkillMeta: vi.fn(() => null),
    }));
    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({ defaultProvider: "arcana" })),
    }));
    vi.doMock("../registry.js", () => ({
      getProvider: vi.fn(),
    }));
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
      readdirSync: vi.fn(() => []),
      lstatSync: vi.fn(),
    }));

    const { diffCommand } = await import("./diff.js");

    await expect(diffCommand("bad@name", {})).rejects.toThrow(ExitError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid skill name"),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
