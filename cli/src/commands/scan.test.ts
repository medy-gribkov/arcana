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
      scanSkillContentFull: vi.fn(() => ({ issues: [], suppressed: [] })),
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

    vi.doMock("../utils/scanner.js", () => ({
      scanSkillContentFull: vi.fn(() => ({
        issues: [{ level: "critical", category: "Injection", detail: "Command injection", line: 5, context: "bad" }],
        suppressed: [],
      })),
      formatScanResults: vi.fn(() => ""),
    }));

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

  // === New tests: --strict, --verbose, scope-aware ===

  it("passes strict option through to scanner", async () => {
    let capturedOptions: unknown;
    vi.doMock("../utils/scanner.js", () => ({
      scanSkillContentFull: vi.fn((_content: string, opts: unknown) => {
        capturedOptions = opts;
        return { issues: [], suppressed: [] };
      }),
      formatScanResults: vi.fn(() => ""),
    }));
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => []),
      readFileSync: vi.fn(() => "content"),
      statSync: vi.fn(),
    }));

    const { scanCommand } = await import("./scan.js");
    await scanCommand("test", { json: true, strict: true });

    expect(capturedOptions).toMatchObject({ strict: true });
  });

  it("shows strict mode indicator in output", async () => {
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => []),
      readFileSync: vi.fn(() => "content"),
      statSync: vi.fn(),
    }));

    const { scanCommand } = await import("./scan.js");
    await scanCommand("test", { strict: true });

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("strict mode");
  });

  it("--verbose includes suppressed findings in JSON output", async () => {
    vi.doMock("../utils/scanner.js", () => ({
      scanSkillContentFull: vi.fn(() => ({
        issues: [],
        suppressed: [{ level: "high", category: "Prompt injection", detail: "In BAD block", line: 10, context: "bad" }],
      })),
      formatScanResults: vi.fn(() => "  [OK] test"),
    }));
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => []),
      readFileSync: vi.fn(() => "content"),
      statSync: vi.fn(),
    }));

    const { scanCommand } = await import("./scan.js");
    await scanCommand("test", { json: true, verbose: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.summary).toHaveProperty("suppressed", 1);
    expect(output.results[0].suppressed).toHaveLength(1);
    expect(output.results[0].suppressed[0]).toMatchObject({ level: "high", category: "Prompt injection" });
  });

  it("--verbose without --strict shows [SKIP] prefixed suppressed findings", async () => {
    vi.doMock("../utils/scanner.js", () => ({
      scanSkillContentFull: vi.fn(() => ({
        issues: [],
        suppressed: [
          { level: "medium", category: "System modification", detail: "In example", line: 5, context: "bad" },
        ],
      })),
      formatScanResults: vi.fn(() => "  [OK] test"),
    }));
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => []),
      readFileSync: vi.fn(() => "content"),
      statSync: vi.fn(),
    }));

    const { scanCommand } = await import("./scan.js");
    await scanCommand("test", { verbose: true });

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("[SKIP]");
    expect(output).toContain("System modification");
  });

  it("summary includes suppressed count when not strict", async () => {
    vi.doMock("../utils/scanner.js", () => ({
      scanSkillContentFull: vi.fn(() => ({
        issues: [{ level: "medium", category: "Test", detail: "Test issue", line: 1, context: "x" }],
        suppressed: [
          { level: "high", category: "Skip1", detail: "Skipped", line: 10, context: "x" },
          { level: "medium", category: "Skip2", detail: "Skipped", line: 20, context: "x" },
        ],
      })),
      formatScanResults: vi.fn(() => "  [i] test (1 issue)"),
    }));
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => []),
      readFileSync: vi.fn(() => "content"),
      statSync: vi.fn(),
    }));

    const { scanCommand } = await import("./scan.js");
    await scanCommand("test", {});

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("2 suppressed");
  });

  it("JSON output omits suppressed when --verbose is not set", async () => {
    vi.doMock("../utils/scanner.js", () => ({
      scanSkillContentFull: vi.fn(() => ({
        issues: [],
        suppressed: [{ level: "high", category: "Test", detail: "Hidden", line: 1, context: "x" }],
      })),
      formatScanResults: vi.fn(() => ""),
    }));
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => []),
      readFileSync: vi.fn(() => "content"),
      statSync: vi.fn(),
    }));

    const { scanCommand } = await import("./scan.js");
    await scanCommand("test", { json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.summary).not.toHaveProperty("suppressed");
    expect(output.results[0]).not.toHaveProperty("suppressed");
  });
});
