import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("uninstallCommand - JSON mode", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let mockRmSync: ReturnType<typeof vi.fn>;
  let mockGetSkillDir: ReturnType<typeof vi.fn>;
  let mockListSymlinks: ReturnType<typeof vi.fn>;
  let mockReadSkillMeta: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    mockRmSync = vi.fn();
    mockGetSkillDir = vi.fn((name: string) => `/fake/skills/${name}`);
    mockListSymlinks = vi.fn(() => []);
    mockReadSkillMeta = vi.fn(() => null);

    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => false),
      rmSync: mockRmSync,
    }));
    vi.doMock("node:path", async () => {
      const actual = await vi.importActual<typeof import("node:path")>("node:path");
      return actual;
    });
    vi.doMock("@clack/prompts", () => ({
      intro: vi.fn(),
      cancel: vi.fn(),
      confirm: vi.fn(),
      isCancel: vi.fn(),
      spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
      log: { info: vi.fn(), warn: vi.fn() },
    }));
    vi.doMock("chalk", () => ({
      default: Object.assign((s: string) => s, {
        bold: (s: string) => s,
        cyan: (s: string) => s,
        hex: () => (s: string) => s,
      }),
    }));
    vi.doMock("../utils/fs.js", () => ({
      getSkillDir: mockGetSkillDir,
      listSymlinks: mockListSymlinks,
      readSkillMeta: mockReadSkillMeta,
    }));
    vi.doMock("../utils/help.js", () => ({
      renderBanner: vi.fn(() => ""),
    }));
    vi.doMock("../utils/validate.js", () => ({
      validateSlug: vi.fn(),
    }));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.resetModules();
  });

  it("exits with error when no skills provided", async () => {
    const { uninstallCommand } = await import("./uninstall.js");
    await expect(uninstallCommand([], { json: true })).rejects.toThrow("process.exit");

    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ error: "No skill specified" }));
  });

  it("returns error for non-existent skill", async () => {
    const fs = await import("node:fs");
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const { uninstallCommand } = await import("./uninstall.js");
    await expect(uninstallCommand(["nonexistent"], { json: true })).rejects.toThrow("process.exit");

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output).toMatchObject({ uninstalled: "nonexistent", success: false, error: "Not installed" });
  });

  it("returns success with version on successful uninstall", async () => {
    const fs = await import("node:fs");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    mockReadSkillMeta.mockReturnValue({ version: "1.0.0" });

    const { uninstallCommand } = await import("./uninstall.js");
    await uninstallCommand(["test-skill"], { json: true });

    expect(mockRmSync).toHaveBeenCalled();
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output).toMatchObject({ uninstalled: "test-skill", success: true, version: "1.0.0" });
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("returns results array for multiple skills", async () => {
    const fs = await import("node:fs");
    // First skill exists, second doesn't
    vi.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false);
    mockReadSkillMeta.mockReturnValue({ version: "1.0.0" });

    const { uninstallCommand } = await import("./uninstall.js");
    await expect(uninstallCommand(["skill-one", "skill-two"], { json: true })).rejects.toThrow("process.exit");

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.results).toHaveLength(2);
    expect(output.results[0]).toMatchObject({ name: "skill-one", success: true });
    expect(output.results[1]).toMatchObject({ name: "skill-two", success: false, error: "Not installed" });
  });
});

describe("removeSymlinksFor", () => {
  let mockRmSync: ReturnType<typeof vi.fn>;
  let mockGetSkillDir: ReturnType<typeof vi.fn>;
  let mockListSymlinks: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    mockRmSync = vi.fn();
    mockGetSkillDir = vi.fn(() => "/fake/skills/test-skill");
    mockListSymlinks = vi.fn(() => []);

    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(),
      rmSync: mockRmSync,
    }));
    vi.doMock("node:path", async () => {
      const actual = await vi.importActual<typeof import("node:path")>("node:path");
      return actual;
    });
    vi.doMock("@clack/prompts", () => ({
      intro: vi.fn(),
      cancel: vi.fn(),
      confirm: vi.fn(),
      isCancel: vi.fn(),
      spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
      log: { info: vi.fn(), warn: vi.fn() },
    }));
    vi.doMock("chalk", () => ({
      default: Object.assign((s: string) => s, {
        bold: (s: string) => s,
        cyan: (s: string) => s,
        hex: () => (s: string) => s,
      }),
    }));
    vi.doMock("../utils/fs.js", () => ({
      getSkillDir: mockGetSkillDir,
      listSymlinks: mockListSymlinks,
      readSkillMeta: vi.fn(),
    }));
    vi.doMock("../utils/help.js", () => ({
      renderBanner: vi.fn(() => ""),
    }));
    vi.doMock("../utils/validate.js", () => ({
      validateSlug: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("removes matching symlinks", async () => {
    const skillDir = "/fake/skills/test-skill";
    const { resolve } = await import("node:path");
    const resolvedSkillDir = resolve(skillDir);

    mockListSymlinks.mockReturnValue([
      { name: "link1", fullPath: "/some/path/link1", target: skillDir },
      { name: "link2", fullPath: "/some/path/link2", target: "/fake/skills/other-skill" },
    ]);

    const { removeSymlinksFor } = await import("./uninstall.js");
    const removed = removeSymlinksFor("test-skill");

    expect(removed).toBe(1);
    expect(mockRmSync).toHaveBeenCalledWith("/some/path/link1");
    expect(mockRmSync).toHaveBeenCalledTimes(1);
  });
});
