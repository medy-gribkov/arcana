import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("list command", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let mockProviders: Array<{ list: ReturnType<typeof vi.fn>; clearCache: ReturnType<typeof vi.fn> }>;

  beforeEach(() => {
    vi.resetModules();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    mockProviders = [{ list: vi.fn(() => Promise.resolve([])), clearCache: vi.fn() }];

    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => false),
      readdirSync: vi.fn(() => []),
      statSync: vi.fn(() => ({ isDirectory: () => true })),
    }));
    vi.doMock("../utils/ui.js", () => ({
      ui: { bold: (s: string) => s, dim: (s: string) => s, success: (s: string) => s },
      banner: vi.fn(),
      spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), fail: vi.fn() })),
      noopSpinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), fail: vi.fn() })),
      table: vi.fn(),
      printErrorWithHint: vi.fn(),
    }));
    vi.doMock("../utils/fs.js", () => ({
      isSkillInstalled: vi.fn(() => false),
      getInstallDir: vi.fn(() => "/fake/install"),
      readSkillMeta: vi.fn(() => null),
    }));
    vi.doMock("../registry.js", () => ({
      getProviders: vi.fn(() => mockProviders),
    }));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.resetModules();
  });

  it("--installed with no installDir returns empty skills JSON", async () => {
    const { listCommand } = await import("./list.js");
    await listCommand({ installed: true, json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output).toEqual({ skills: [] });
  });

  it("--installed with skills returns skill metadata JSON", async () => {
    const fs = await import("node:fs");
    const fsUtils = await import("../utils/fs.js");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(["skill-a"] as never);
    vi.mocked(fsUtils.readSkillMeta).mockReturnValue({
      version: "1.0.0",
      source: "github",
      installedAt: "2026-02-27T00:00:00.000Z",
    } as never);

    const { listCommand } = await import("./list.js");
    await listCommand({ installed: true, json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.skills).toHaveLength(1);
    expect(output.skills[0]).toMatchObject({ name: "skill-a", version: "1.0.0", source: "github" });
  });

  it("provider list in JSON mode returns skills array", async () => {
    mockProviders[0].list.mockResolvedValue([
      { name: "skill-x", version: "2.0.0", description: "Test skill X", source: "marketplace" },
    ]);

    const { listCommand } = await import("./list.js");
    await listCommand({ json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.skills).toHaveLength(1);
    expect(output.skills[0]).toMatchObject({ name: "skill-x", version: "2.0.0", installed: false });
  });

  it("provider error in JSON mode returns error and exits", async () => {
    mockProviders[0].list.mockRejectedValue(new Error("Network failure"));

    const { listCommand } = await import("./list.js");
    await expect(listCommand({ json: true })).rejects.toThrow("process.exit");

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.error).toBe("Network failure");
  });

  it("--cache=false calls clearCache on providers", async () => {
    const { listCommand } = await import("./list.js");
    await listCommand({ json: true, cache: false });

    expect(mockProviders[0].clearCache).toHaveBeenCalled();
  });
});
