import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";

describe("validateCommand", () => {
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
    vi.doMock("../utils/ui.js", () => ({
      ui: {
        error: (s: string) => s,
        dim: (s: string) => s,
        success: (s: string) => s,
        warn: (s: string) => s,
        bold: (s: string) => s,
        cyan: (s: string) => s,
      },
      banner: vi.fn(),
    }));
    vi.doMock("../utils/frontmatter.js", () => ({
      validateSkillDir: vi.fn(),
      fixSkillFrontmatter: vi.fn(),
    }));
    vi.doMock("../utils/atomic.js", () => ({
      atomicWriteSync: vi.fn(),
    }));
    vi.doMock("../utils/scanner.js", () => ({
      scanSkillContent: vi.fn(() => []),
    }));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.resetModules();
  });

  it("shows empty results JSON when installDir doesn't exist", async () => {
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => false),
      readdirSync: vi.fn(() => []),
      readFileSync: vi.fn(),
      statSync: vi.fn(),
    }));

    const { validateCommand } = await import("./validate.js");
    await validateCommand(undefined, { all: true, json: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ results: [] }));
  });

  it("exits with error when no skill specified and not --all", async () => {
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => []),
      readFileSync: vi.fn(),
      statSync: vi.fn(),
    }));

    const { validateCommand } = await import("./validate.js");
    await expect(validateCommand(undefined, { json: true })).rejects.toThrow("process.exit");

    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ error: "Specify a skill name or use --all" }));
  });

  it("reports 'Not installed' for missing skill directory", async () => {
    const installDir = "/fake/install";
    const skillDir = join(installDir, "missing-skill");
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn((p: string) => p === installDir),
      readdirSync: vi.fn(() => []),
      readFileSync: vi.fn(),
      statSync: vi.fn(),
    }));

    const { validateCommand } = await import("./validate.js");
    // Result has valid: false, so process.exit(1) is called
    await expect(validateCommand("missing-skill", { json: true })).rejects.toThrow("process.exit");

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.results[0]).toMatchObject({
      skill: "missing-skill",
      valid: false,
      errors: ["Not installed"],
    });
  });

  it("calls validateSkillDir and returns result in JSON mode", async () => {
    const installDir = "/fake/install";
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => ["test-skill"]),
      readFileSync: vi.fn(() => "content"),
      statSync: vi.fn(() => ({ isDirectory: () => true })),
    }));

    const frontmatter = await import("../utils/frontmatter.js");
    vi.mocked(frontmatter.validateSkillDir).mockReturnValue({
      skill: "test-skill",
      valid: true,
      errors: [],
      warnings: [],
      infos: [],
    });

    const { validateCommand } = await import("./validate.js");
    await validateCommand(undefined, { all: true, json: true });

    expect(frontmatter.validateSkillDir).toHaveBeenCalledWith(join(installDir, "test-skill"), "test-skill");
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.results[0]).toMatchObject({ skill: "test-skill", valid: true });
  });

  it("runs security scan and adds critical issues as errors", async () => {
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => []),
      readFileSync: vi.fn(() => "skill content"),
      statSync: vi.fn(),
    }));

    const frontmatter = await import("../utils/frontmatter.js");
    vi.mocked(frontmatter.validateSkillDir).mockReturnValue({
      skill: "test-skill",
      valid: true,
      errors: [],
      warnings: [],
      infos: [],
    });

    const scanner = await import("../utils/scanner.js");
    vi.mocked(scanner.scanSkillContent).mockReturnValue([
      { level: "critical", category: "Path Leak", detail: "Personal path detected", line: 42 },
    ] as never);

    const { validateCommand } = await import("./validate.js");
    // Critical issue makes valid: false, triggering process.exit(1)
    await expect(validateCommand("test-skill", { json: true })).rejects.toThrow("process.exit");

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.results[0].valid).toBe(false);
    expect(output.results[0].errors[0]).toContain("Path Leak");
  });

  it("quality scoring marks skill invalid when score below threshold", async () => {
    const installDir = "/fake/install";
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => []),
      readFileSync: vi.fn(() => "content"),
      statSync: vi.fn(() => ({ isDirectory: () => true })),
    }));

    const frontmatter = await import("../utils/frontmatter.js");
    vi.mocked(frontmatter.validateSkillDir).mockReturnValue({
      skill: "test-skill",
      valid: true,
      errors: [],
      warnings: [],
      infos: [],
    });

    const scanner = await import("../utils/scanner.js");
    vi.mocked(scanner.scanSkillContent).mockReturnValue([]);

    vi.doMock("./audit.js", () => ({
      auditSkill: vi.fn(() => ({ score: 50, rating: "Poor", skill: "test-skill", checks: [] })),
    }));

    const { validateCommand } = await import("./validate.js");
    await expect(validateCommand("test-skill", { json: true, minScore: 80 })).rejects.toThrow("process.exit");

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.results[0].qualityScore).toBe(50);
    expect(output.results[0].qualityRating).toBe("Poor");
    expect(output.results[0].valid).toBe(false);
  });

  it("quality scoring passes when score meets threshold", async () => {
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => []),
      readFileSync: vi.fn(() => "content"),
      statSync: vi.fn(() => ({ isDirectory: () => true })),
    }));

    const frontmatter = await import("../utils/frontmatter.js");
    vi.mocked(frontmatter.validateSkillDir).mockReturnValue({
      skill: "test-skill",
      valid: true,
      errors: [],
      warnings: [],
      infos: [],
    });

    const scanner = await import("../utils/scanner.js");
    vi.mocked(scanner.scanSkillContent).mockReturnValue([]);

    vi.doMock("./audit.js", () => ({
      auditSkill: vi.fn(() => ({ score: 90, rating: "Good", skill: "test-skill", checks: [] })),
    }));

    const { validateCommand } = await import("./validate.js");
    await validateCommand("test-skill", { json: true, minScore: 80 });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.results[0].qualityScore).toBe(90);
    expect(output.results[0].qualityRating).toBe("Good");
    expect(output.results[0].valid).toBe(true);
  });

  it("cross-validation includes issues in JSON output", async () => {
    const installDir = "/fake/install";
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn((p: string) => {
        // Return true for install dir, skill dirs, and marketplace.json path
        if (p === installDir) return true;
        if (p.includes("marketplace.json")) return true;
        if (p.includes("SKILL.md")) return true;
        return true;
      }),
      readdirSync: vi.fn(() => ["skill-x"]),
      readFileSync: vi.fn(() => "content"),
      statSync: vi.fn(() => ({ isDirectory: () => true })),
    }));

    const frontmatter = await import("../utils/frontmatter.js");
    vi.mocked(frontmatter.validateSkillDir).mockReturnValue({
      skill: "skill-x",
      valid: true,
      errors: [],
      warnings: [],
      infos: [],
    });

    const scanner = await import("../utils/scanner.js");
    vi.mocked(scanner.scanSkillContent).mockReturnValue([]);

    vi.doMock("../utils/quality.js", () => ({
      crossValidate: vi.fn(() => [{ skill: "x", level: "error", category: "orphan", detail: "Missing" }]),
    }));

    const { validateCommand } = await import("./validate.js");
    await expect(validateCommand(undefined, { json: true, cross: true, all: true })).rejects.toThrow("process.exit");

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.crossValidation).toBeDefined();
    expect(output.crossValidation).toHaveLength(1);
    expect(output.crossValidation[0]).toMatchObject({ skill: "x", level: "error", detail: "Missing" });
  });

  it("--all mode lists directories from baseDir", async () => {
    const installDir = "/fake/install";
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => ["a", "b"]),
      readFileSync: vi.fn(() => "content"),
      statSync: vi.fn(() => ({ isDirectory: () => true })),
    }));

    const frontmatter = await import("../utils/frontmatter.js");
    vi.mocked(frontmatter.validateSkillDir).mockImplementation((_dir: string, name: string) => ({
      skill: name,
      valid: true,
      errors: [],
      warnings: [],
      infos: [],
    }));

    const scanner = await import("../utils/scanner.js");
    vi.mocked(scanner.scanSkillContent).mockReturnValue([]);

    const { validateCommand } = await import("./validate.js");
    await validateCommand(undefined, { all: true, json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.results).toHaveLength(2);
    expect(output.results[0].skill).toBe("a");
    expect(output.results[1].skill).toBe("b");
  });

  it("uses --fix to call fixSkillFrontmatter and atomicWriteSync", async () => {
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => []),
      readFileSync: vi.fn(() => "old content"),
      statSync: vi.fn(),
    }));

    const frontmatter = await import("../utils/frontmatter.js");
    vi.mocked(frontmatter.validateSkillDir)
      .mockReturnValueOnce({
        skill: "test-skill",
        valid: false,
        errors: ["Bad"],
        warnings: ["Warn"],
        infos: [],
      })
      .mockReturnValueOnce({
        skill: "test-skill",
        valid: true,
        errors: [],
        warnings: [],
        infos: [],
        fixed: true,
      });
    vi.mocked(frontmatter.fixSkillFrontmatter).mockReturnValue("fixed content");

    const scanner = await import("../utils/scanner.js");
    vi.mocked(scanner.scanSkillContent).mockReturnValue([]);

    const atomic = await import("../utils/atomic.js");

    const { validateCommand } = await import("./validate.js");
    await validateCommand("test-skill", { fix: true, json: true });

    expect(frontmatter.fixSkillFrontmatter).toHaveBeenCalledWith("old content");
    expect(atomic.atomicWriteSync).toHaveBeenCalled();
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.results[0].fixed).toBe(true);
  });
});
