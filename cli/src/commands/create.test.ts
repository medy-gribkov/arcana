import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("createCommand", () => {
  let createCommand: typeof import("./create.js").createCommand;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let mockMkdirSync: ReturnType<typeof vi.fn>;
  let mockAtomicWriteSync: ReturnType<typeof vi.fn>;
  let mockExistsSync: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    mockMkdirSync = vi.fn();
    mockExistsSync = vi.fn(() => false);

    vi.doMock("node:fs", () => ({
      existsSync: mockExistsSync,
      mkdirSync: mockMkdirSync,
    }));

    mockAtomicWriteSync = vi.fn();
    vi.doMock("../utils/atomic.js", () => ({
      atomicWriteSync: mockAtomicWriteSync,
    }));

    vi.doMock("chalk", () => ({
      default: Object.assign((s: string) => s, {
        bold: (s: string) => s,
        cyan: (s: string) => s,
        dim: (s: string) => s,
        hex: () => (s: string) => s,
      }),
    }));

    vi.doMock("@clack/prompts", () => ({
      intro: vi.fn(),
      cancel: vi.fn(),
      outro: vi.fn(),
      log: { info: vi.fn(), warn: vi.fn(), success: vi.fn(), error: vi.fn() },
      text: vi.fn(async () => "A test skill that helps with testing workflows"),
      isCancel: vi.fn(() => false),
    }));

    vi.doMock("../utils/fs.js", () => ({
      getSkillDir: vi.fn((name: string) => `/fake/skills/${name}`),
    }));

    vi.doMock("../utils/help.js", () => ({
      renderBanner: vi.fn(() => "Banner"),
    }));

    const mod = await import("./create.js");
    createCommand = mod.createCommand;
  });

  afterEach(() => {
    vi.resetModules();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("rejects invalid skill names", async () => {
    await createCommand("INVALID_NAME!");
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("rejects names that already exist", async () => {
    mockExistsSync.mockReturnValue(true);
    await createCommand("existing-skill");
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("creates skill directory and files for valid name", async () => {
    await createCommand("my-test-skill");

    // Should create the skill dir + scripts + references dirs
    expect(mockMkdirSync).toHaveBeenCalledTimes(3);
    // Should write SKILL.md + 2 .gitkeep files
    expect(mockAtomicWriteSync).toHaveBeenCalledTimes(3);
    // SKILL.md should contain the skill name
    const skillMdCall = mockAtomicWriteSync.mock.calls.find(
      (call: string[]) => typeof call[0] === "string" && call[0].includes("SKILL.md"),
    );
    expect(skillMdCall).toBeDefined();
    expect(skillMdCall![1]).toContain("my-test-skill");
  });

  it("exits cleanly when user cancels description prompt", async () => {
    vi.resetModules();

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitError = new Error("process.exit called");
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw exitError;
    }) as never);

    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => false),
      mkdirSync: vi.fn(),
    }));

    vi.doMock("../utils/atomic.js", () => ({ atomicWriteSync: vi.fn() }));

    vi.doMock("chalk", () => ({
      default: Object.assign((s: string) => s, {
        bold: (s: string) => s,
        cyan: (s: string) => s,
        dim: (s: string) => s,
        hex: () => (s: string) => s,
      }),
    }));

    vi.doMock("@clack/prompts", () => ({
      intro: vi.fn(),
      cancel: vi.fn(),
      outro: vi.fn(),
      log: { info: vi.fn(), warn: vi.fn(), success: vi.fn(), error: vi.fn() },
      text: vi.fn(async () => Symbol("cancel")),
      isCancel: vi.fn(() => true),
    }));

    vi.doMock("../utils/fs.js", () => ({
      getSkillDir: vi.fn((name: string) => `/fake/skills/${name}`),
    }));

    vi.doMock("../utils/help.js", () => ({
      renderBanner: vi.fn(() => "Banner"),
    }));

    const mod = await import("./create.js");
    await mod.createCommand("valid-skill").catch(() => {});
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it("handles file creation errors", async () => {
    mockMkdirSync.mockImplementation(() => {
      throw new Error("Permission denied");
    });

    await createCommand("error-skill");
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
