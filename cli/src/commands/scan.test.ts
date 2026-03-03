import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("scanCommand", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => "/fake/install"),
    }));
    vi.doMock("../utils/scanner.js", () => ({
      scanSkillContent: vi.fn(() => []),
      formatScanResults: vi.fn(() => ""),
    }));
    vi.doMock("../utils/ui.js", () => ({
      ui: {
        bold: (s: string) => s,
        dim: (s: string) => s,
        error: (s: string) => s,
        success: (s: string) => s,
        warn: (s: string) => s,
      },
      banner: vi.fn(),
    }));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.resetModules();
  });

  it("returns empty JSON results when installDir doesn't exist", async () => {
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => false),
      readdirSync: vi.fn(() => []),
      readFileSync: vi.fn(),
      statSync: vi.fn(),
    }));

    const { scanCommand } = await import("./scan.js");
    await scanCommand(undefined, { all: true, json: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ results: [] }));
  });

  it("exits with error when no skill and not --all in JSON mode", async () => {
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => []),
      readFileSync: vi.fn(),
      statSync: vi.fn(),
    }));

    const { scanCommand } = await import("./scan.js");
    await expect(scanCommand(undefined, { json: true })).rejects.toThrow("process.exit");

    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ error: "Specify a skill name or use --all" }));
  });

  it("reports clean scan with no issues in JSON mode", async () => {
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => ["skill1"]),
      readFileSync: vi.fn(() => "# SKILL content"),
      statSync: vi.fn(() => ({ isDirectory: () => true })),
    }));

    const { scanCommand } = await import("./scan.js");
    await scanCommand(undefined, { all: true, json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.summary).toMatchObject({
      total: 1,
      clean: 1,
      issues: 0,
      critical: 0,
    });
    expect(output.results).toHaveLength(1);
  });

  it("counts critical issues and exits with code 1", async () => {
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => []),
      readFileSync: vi.fn(() => "content"),
      statSync: vi.fn(),
    }));

    const scanner = await import("../utils/scanner.js");
    vi.mocked(scanner.scanSkillContent).mockReturnValue([
      { level: "critical", category: "Injection", detail: "Command injection", line: 5 },
    ] as any);

    const { scanCommand } = await import("./scan.js");
    await expect(scanCommand("bad-skill", { json: true })).rejects.toThrow("process.exit");

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.summary.critical).toBe(1);
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("handles missing SKILL.md in JSON mode", async () => {
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn((p: string) => !p.includes("SKILL.md")),
      readdirSync: vi.fn(() => ["no-skill-md"]),
      readFileSync: vi.fn(),
      statSync: vi.fn(() => ({ isDirectory: () => true })),
    }));

    const { scanCommand } = await import("./scan.js");
    await scanCommand(undefined, { all: true, json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.results[0]).toMatchObject({ skill: "no-skill-md", error: "Missing SKILL.md" });
  });
});
