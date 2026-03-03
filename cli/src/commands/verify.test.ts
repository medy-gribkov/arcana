import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("verifyCommand", () => {
  let consoleLogSpy: any;
  let processExitSpy: any;

  function setupMocks(
    overrides: {
      installDirContents?: string[];
      isSkillInstalled?: (name: string) => boolean;
      verifySkillIntegrity?: (skill: string, dir: string) => "ok" | "modified" | "missing";
      validateSlug?: (slug: string, label: string) => void;
    } = {},
  ) {
    vi.doMock("chalk", () => ({
      default: Object.assign((s: string) => s, {
        bold: (s: string) => s,
        cyan: (s: string) => s,
        dim: (s: string) => s,
        green: (s: string) => s,
        yellow: (s: string) => s,
        hex: () => (s: string) => s,
      }),
    }));

    vi.doMock("@clack/prompts", () => ({
      log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      intro: vi.fn(),
      cancel: vi.fn(),
      outro: vi.fn(),
      spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() })),
    }));

    vi.doMock("../utils/ui.js", () => ({
      printErrorWithHint: vi.fn(),
    }));

    const dirContents = overrides.installDirContents ?? [];
    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => "/fake/install"),
      isSkillInstalled: vi.fn(overrides.isSkillInstalled ?? (() => true)),
    }));

    vi.doMock("../utils/integrity.js", () => ({
      verifySkillIntegrity: vi.fn(overrides.verifySkillIntegrity ?? (() => "ok")),
      readLockfile: vi.fn(() => []),
    }));

    vi.doMock("../utils/validate.js", () => ({
      validateSlug: vi.fn(overrides.validateSlug ?? (() => {})),
    }));

    vi.doMock("../utils/help.js", () => ({
      renderBanner: vi.fn(() => "Banner"),
    }));

    // Mock readdirSync and statSync at module level via node:fs
    vi.doMock("node:fs", () => ({
      readdirSync: vi.fn(() => dirContents),
      statSync: vi.fn(() => ({ isDirectory: () => true })),
    }));
  }

  beforeEach(() => {
    vi.resetModules();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as any);
  });

  afterEach(() => {
    vi.resetModules();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("shows error when no skill and no --all", async () => {
    setupMocks();
    const { verifyCommand } = await import("./verify.js");

    await expect(verifyCommand([], {})).rejects.toThrow("process.exit");
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("--all with empty install dir shows nothing to verify", async () => {
    setupMocks({ installDirContents: [] });
    const { verifyCommand } = await import("./verify.js");

    await verifyCommand([], { all: true });

    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("--all with verified skills reports OK", async () => {
    setupMocks({
      installDirContents: ["skill-a", "skill-b"],
      verifySkillIntegrity: () => "ok",
    });
    const { verifyCommand } = await import("./verify.js");

    await verifyCommand([], { all: true });

    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("single skill not installed exits with error", async () => {
    setupMocks({
      isSkillInstalled: () => false,
    });
    const { verifyCommand } = await import("./verify.js");

    await expect(verifyCommand(["missing-skill"], {})).rejects.toThrow("process.exit");
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("single skill passes verification", async () => {
    setupMocks({
      isSkillInstalled: () => true,
      verifySkillIntegrity: () => "ok",
    });
    const { verifyCommand } = await import("./verify.js");

    await verifyCommand(["my-skill"], {});

    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("JSON output format matches spec", async () => {
    vi.resetModules();

    vi.doMock("chalk", () => ({
      default: Object.assign((s: string) => s, {
        bold: (s: string) => s,
        cyan: (s: string) => s,
        dim: (s: string) => s,
        green: (s: string) => s,
        yellow: (s: string) => s,
        hex: () => (s: string) => s,
      }),
    }));

    vi.doMock("@clack/prompts", () => ({
      log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      intro: vi.fn(),
      cancel: vi.fn(),
      outro: vi.fn(),
      spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() })),
    }));

    vi.doMock("../utils/ui.js", () => ({
      printErrorWithHint: vi.fn(),
    }));

    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => "/fake/install"),
      isSkillInstalled: vi.fn(() => true),
    }));

    let callCount = 0;
    vi.doMock("../utils/integrity.js", () => ({
      verifySkillIntegrity: vi.fn(() => {
        callCount++;
        if (callCount === 1) return "ok";
        if (callCount === 2) return "modified";
        return "missing";
      }),
      readLockfile: vi.fn(() => []),
    }));

    vi.doMock("../utils/validate.js", () => ({
      validateSlug: vi.fn(),
    }));

    vi.doMock("../utils/help.js", () => ({
      renderBanner: vi.fn(() => "Banner"),
    }));

    vi.doMock("node:fs", () => ({
      readdirSync: vi.fn(() => ["alpha", "beta", "gamma"]),
      statSync: vi.fn(() => ({ isDirectory: () => true })),
    }));

    const { verifyCommand } = await import("./verify.js");

    await expect(verifyCommand([], { all: true, json: true })).rejects.toThrow("process.exit");

    const jsonCall = consoleLogSpy.mock.calls.find((call: any[]) => {
      try {
        JSON.parse(call[0]);
        return true;
      } catch {
        return false;
      }
    });

    expect(jsonCall).toBeDefined();
    const output = JSON.parse(jsonCall[0]);

    expect(output).toHaveProperty("results");
    expect(output).toHaveProperty("summary");
    expect(output.results).toHaveLength(3);
    expect(output.results[0]).toEqual({ skill: "alpha", status: "ok" });
    expect(output.results[1]).toEqual({ skill: "beta", status: "modified" });
    expect(output.results[2]).toEqual({ skill: "gamma", status: "missing" });
    expect(output.summary).toEqual({ total: 3, ok: 1, modified: 1, missing: 1 });

    // Should exit 1 because there's a modified skill
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
