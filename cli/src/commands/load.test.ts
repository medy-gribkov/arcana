import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("loadCommand", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;
  let testInstallDir: string;

  beforeEach(() => {
    vi.resetModules();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    testInstallDir = mkdtempSync(join(tmpdir(), "arcana-load-test-"));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    stdoutWriteSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.resetModules();
  });

  function createSkill(name: string, content: string, refs?: Record<string, string>, rules?: Record<string, string>): void {
    const skillDir = join(testInstallDir, name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), content, "utf-8");

    if (refs) {
      const refsDir = join(skillDir, "references");
      mkdirSync(refsDir, { recursive: true });
      for (const [fname, fcontent] of Object.entries(refs)) {
        writeFileSync(join(refsDir, fname), fcontent, "utf-8");
      }
    }

    if (rules) {
      const rulesDir = join(skillDir, "rules");
      mkdirSync(rulesDir, { recursive: true });
      for (const [fname, fcontent] of Object.entries(rules)) {
        writeFileSync(join(rulesDir, fname), fcontent, "utf-8");
      }
    }
  }

  function setupMocks(): void {
    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => testInstallDir),
    }));
    vi.doMock("../utils/ui.js", () => ({
      ui: {
        bold: (s: string) => s,
        dim: (s: string) => s,
        success: (s: string) => s,
        warn: (s: string) => s,
      },
      banner: vi.fn(),
    }));
    vi.doMock("../utils/atomic.js", () => ({
      atomicWriteSync: vi.fn((path: string, content: string) => {
        writeFileSync(path, content, "utf-8");
      }),
    }));
  }

  it("exits with error when no skills specified", async () => {
    setupMocks();
    const { loadCommand } = await import("./load.js");
    await expect(loadCommand([], {})).rejects.toThrow("process.exit");
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("shows error in JSON when no skills specified", async () => {
    setupMocks();
    const { loadCommand } = await import("./load.js");
    await expect(loadCommand([], { json: true })).rejects.toThrow("process.exit");

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output).toHaveProperty("error");
  });

  it("shows usage hint when no skills specified (non-JSON)", async () => {
    setupMocks();
    const { loadCommand } = await import("./load.js");
    await expect(loadCommand([], {})).rejects.toThrow("process.exit");

    const output = consoleErrorSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Specify one or more skill names");
  });

  it("loads single skill to stdout", async () => {
    createSkill("my-skill", "# My Skill\nContent here.");
    setupMocks();

    const { loadCommand } = await import("./load.js");
    await loadCommand(["my-skill"], {});

    const written = stdoutWriteSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("# My Skill");
    expect(written).toContain("Content here.");
  });

  it("loads skill with references", async () => {
    createSkill("ref-skill", "# Main", { "advanced.md": "# Advanced\nExtra content." });
    setupMocks();

    const { loadCommand } = await import("./load.js");
    await loadCommand(["ref-skill"], {});

    const written = stdoutWriteSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("# Main");
    expect(written).toContain("Reference: advanced.md");
    expect(written).toContain("Extra content.");
  });

  it("loads skill with rules", async () => {
    createSkill("rule-skill", "# Main", undefined, { "coding.md": "# Coding Rules\nAlways test." });
    setupMocks();

    const { loadCommand } = await import("./load.js");
    await loadCommand(["rule-skill"], {});

    const written = stdoutWriteSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("# Main");
    expect(written).toContain("Rule: coding.md");
    expect(written).toContain("Always test.");
  });

  it("loads multiple skills", async () => {
    createSkill("skill-one", "# Skill One");
    createSkill("skill-two", "# Skill Two");
    setupMocks();

    const { loadCommand } = await import("./load.js");
    await loadCommand(["skill-one", "skill-two"], {});

    const written = stdoutWriteSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("# Skill One");
    expect(written).toContain("# Skill Two");
  });

  it("handles skill not found", async () => {
    setupMocks();
    const { loadCommand } = await import("./load.js");
    await loadCommand(["nonexistent"], {});

    const errors = consoleErrorSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(errors).toContain("not found");
  });

  it("writes to _loaded.md with --append", async () => {
    createSkill("append-skill", "# Append Test");
    setupMocks();

    const { loadCommand } = await import("./load.js");
    await loadCommand(["append-skill"], { append: true });

    const loadedPath = join(testInstallDir, "_loaded.md");
    const content = readFileSync(loadedPath, "utf-8");
    expect(content).toContain("# Append Test");
  });

  it("shows success in append mode output", async () => {
    createSkill("ok-skill", "# OK Skill");
    setupMocks();

    const { loadCommand } = await import("./load.js");
    await loadCommand(["ok-skill"], { append: true });

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("[OK]");
    expect(output).toContain("ok-skill");
  });

  it("shows errors in append mode for missing skills", async () => {
    createSkill("real-skill", "# Real");
    setupMocks();

    const { loadCommand } = await import("./load.js");
    await loadCommand(["real-skill", "fake-skill"], { append: true });

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("[OK]");
    expect(output).toContain("[!!]");
    expect(output).toContain("fake-skill");
    expect(output).toContain("not found");
  });

  it("returns JSON output with --json", async () => {
    createSkill("json-skill", "# JSON Skill\nBody content.");
    setupMocks();

    const { loadCommand } = await import("./load.js");
    await loadCommand(["json-skill"], { json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.loaded).toHaveLength(1);
    expect(output.loaded[0]).toHaveProperty("name", "json-skill");
    expect(output.loaded[0]).toHaveProperty("files");
    expect(output.loaded[0]).toHaveProperty("bytes");
    expect(output.failed).toHaveLength(0);
  });

  it("reports failures in JSON output", async () => {
    setupMocks();
    const { loadCommand } = await import("./load.js");
    await loadCommand(["missing-skill"], { json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.loaded).toHaveLength(0);
    expect(output.failed).toHaveLength(1);
    expect(output.failed[0]).toHaveProperty("name", "missing-skill");
    expect(output.failed[0]).toHaveProperty("error");
  });

  it("counts files correctly including references and rules", async () => {
    createSkill(
      "multi-file",
      "# Main",
      { "ref1.md": "Ref 1", "ref2.md": "Ref 2" },
      { "rule1.md": "Rule 1" },
    );
    setupMocks();

    const { loadCommand } = await import("./load.js");
    await loadCommand(["multi-file"], { json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.loaded[0].files).toBe(4); // SKILL.md + 2 refs + 1 rule
  });

  it("tracks byte size correctly", async () => {
    const content = "# Test Content\nSome body text here.";
    createSkill("byte-test", content);
    setupMocks();

    const { loadCommand } = await import("./load.js");
    await loadCommand(["byte-test"], { json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.loaded[0].bytes).toBe(content.length);
  });
});
