import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("search command", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let mockProviders: Array<{ search: ReturnType<typeof vi.fn>; clearCache: ReturnType<typeof vi.fn> }>;

  beforeEach(() => {
    vi.resetModules();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    mockProviders = [{ search: vi.fn(() => Promise.resolve([])), clearCache: vi.fn() }];

    vi.doMock("../utils/ui.js", () => ({
      ui: { bold: (s: string) => s, dim: (s: string) => s, error: (s: string) => s, success: (s: string) => s },
      banner: vi.fn(),
      spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), fail: vi.fn() })),
      noopSpinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), fail: vi.fn() })),
      table: vi.fn(),
      printErrorWithHint: vi.fn(),
    }));
    vi.doMock("../utils/fs.js", () => ({
      isSkillInstalled: vi.fn(() => false),
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

  it("JSON search with results returns proper structure", async () => {
    mockProviders[0].search.mockResolvedValue([{ name: "test-skill", description: "A test skill", source: "arcana" }]);

    const { searchCommand } = await import("./search.js");
    await searchCommand("test", { json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.query).toBe("test");
    expect(output.results).toHaveLength(1);
    expect(output.results[0]).toMatchObject({ name: "test-skill", installed: false });
  });

  it("JSON search with no results returns empty array", async () => {
    const { searchCommand } = await import("./search.js");
    await searchCommand("nonexistent", { json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.query).toBe("nonexistent");
    expect(output.results).toEqual([]);
  });

  it("provider error in JSON mode exits 1", async () => {
    mockProviders[0].search.mockRejectedValue(new Error("Network error"));

    const { searchCommand } = await import("./search.js");
    await expect(searchCommand("test", { json: true })).rejects.toThrow("process.exit");

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.error).toBe("Network error");
  });

  it("clears provider cache when cache option is false", async () => {
    mockProviders[0].search.mockResolvedValue([{ name: "cached-skill", description: "A skill", source: "arcana" }]);

    const { searchCommand } = await import("./search.js");
    await searchCommand("test", { json: true, cache: false });

    expect(mockProviders[0].clearCache).toHaveBeenCalled();
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.results).toHaveLength(1);
  });

  it("filters results by tag", async () => {
    mockProviders[0].search.mockResolvedValue([
      { name: "ts-skill", description: "TS skill", source: "arcana", tags: ["typescript", "cli"] },
      { name: "go-skill", description: "Go skill", source: "arcana", tags: ["golang"] },
      { name: "no-tags", description: "No tags skill", source: "arcana" },
    ]);

    const { searchCommand } = await import("./search.js");
    await searchCommand("test", { json: true, tag: "typescript" });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.results).toHaveLength(1);
    expect(output.results[0].name).toBe("ts-skill");
  });

  it("smart ranking sorts by project context match", async () => {
    vi.resetModules();

    const smartProviders = [{ search: vi.fn(), clearCache: vi.fn() }];
    smartProviders[0].search.mockResolvedValue([
      { name: "go-skill", description: "Go skill", source: "arcana", tags: ["golang"] },
      { name: "ts-skill", description: "TS skill", source: "arcana", tags: ["typescript", "cli"] },
      { name: "plain-skill", description: "Plain skill", source: "arcana", tags: [] },
    ]);

    vi.doMock("../utils/ui.js", () => ({
      ui: { bold: (s: string) => s, dim: (s: string) => s, error: (s: string) => s, success: (s: string) => s },
      banner: vi.fn(),
      spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), fail: vi.fn() })),
      noopSpinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), fail: vi.fn() })),
      table: vi.fn(),
      printErrorWithHint: vi.fn(),
    }));
    vi.doMock("../utils/fs.js", () => ({
      isSkillInstalled: vi.fn(() => false),
    }));
    vi.doMock("../registry.js", () => ({
      getProviders: vi.fn(() => smartProviders),
    }));
    vi.doMock("../utils/project-context.js", () => ({
      detectProjectContext: vi.fn(() => ({ tags: ["typescript"] })),
    }));

    const { searchCommand } = await import("./search.js");
    await searchCommand("test", { json: true, smart: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.results).toHaveLength(3);
    // typescript skill should be first (1 overlap with context), others have 0
    expect(output.results[0].name).toBe("ts-skill");
    expect(output.results[2].name).not.toBe("ts-skill");
  });
});
