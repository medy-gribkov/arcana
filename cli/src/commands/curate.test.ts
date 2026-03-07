import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const mockHelpers = vi.hoisted(() => ({
  getInstalledNames: vi.fn(() => [] as string[]),
}));

const mockScoring = vi.hoisted(() => ({
  rankSkills: vi.fn(() => [] as { skill: string; score: number; verdict: string; reasons: string[] }[]),
}));

const mockLoad = vi.hoisted(() => ({
  readSkillContent: vi.fn(
    () => null as { content: string; bytes: number } | null,
  ),
}));

const mockUsage = vi.hoisted(() => ({
  recordCuration: vi.fn(),
}));

const mockContext = vi.hoisted(() => ({
  detectProjectContext: vi.fn(() => ({
    tags: ["typescript"],
    tools: [],
    projectType: "node",
    filePatterns: [],
  })),
}));

const mockFs = vi.hoisted(() => ({
  getInstallDir: vi.fn(() => "/mock-install"),
}));

vi.mock("../interactive/helpers.js", () => mockHelpers);
vi.mock("../utils/scoring.js", () => mockScoring);
vi.mock("./load.js", () => mockLoad);
vi.mock("../utils/usage.js", () => mockUsage);
vi.mock("../utils/project-context.js", () => mockContext);
vi.mock("../utils/fs.js", () => mockFs);
vi.mock("../utils/ui.js", () => ({
  ui: {
    bold: (s: string) => s,
    dim: (s: string) => s,
    success: (s: string) => s,
    warn: (s: string) => s,
  },
  banner: () => {},
}));
vi.mock("../utils/atomic.js", () => ({
  atomicWriteSync: vi.fn(),
}));
vi.mock("node:fs", () => ({
  existsSync: () => true,
  mkdirSync: () => {},
}));

import { curateForContext, curateCommand, regenerateActive } from "./curate.js";

let logOutput: string[] = [];
const originalLog = console.log;

beforeEach(() => {
  vi.clearAllMocks();
  logOutput = [];
  console.log = (...args: unknown[]) => logOutput.push(args.join(" "));
  mockHelpers.getInstalledNames.mockReturnValue([]);
  mockScoring.rankSkills.mockReturnValue([]);
  mockLoad.readSkillContent.mockReturnValue(null);
});

afterAll(() => {
  console.log = originalLog;
});

describe("curateForContext", () => {
  it("returns empty when no skills installed", () => {
    mockHelpers.getInstalledNames.mockReturnValue([]);
    const result = curateForContext("/project", {});
    expect(result.selected).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.totalTokens).toBe(0);
  });

  it("selects skills within budget", () => {
    mockHelpers.getInstalledNames.mockReturnValue(["typescript", "golang"]);
    mockScoring.rankSkills.mockReturnValue([
      { skill: "typescript", score: 80, verdict: "include", reasons: ["match"] },
      { skill: "golang", score: 60, verdict: "include", reasons: ["match"] },
    ]);
    mockLoad.readSkillContent.mockReturnValue({ content: "# Skill", bytes: 1024 });

    const result = curateForContext("/project", {});
    expect(result.selected.length).toBe(2);
    expect(result.selected[0]!.name).toBe("typescript");
    expect(result.totalTokens).toBeGreaterThan(0);
  });

  it("skips skills that exceed budget", () => {
    mockHelpers.getInstalledNames.mockReturnValue(["huge-skill"]);
    mockScoring.rankSkills.mockReturnValue([
      { skill: "huge-skill", score: 90, verdict: "include", reasons: ["match"] },
    ]);
    // Return a massive skill that exceeds the default 30% of 200k = 60k tokens
    // 60k tokens * 4 bytes/token = 240KB -> return bigger than that
    mockLoad.readSkillContent.mockReturnValue({ content: "x".repeat(300_000), bytes: 300_000 });

    const result = curateForContext("/project", {});
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0]!.reason).toContain("Over budget");
  });

  it("force-includes specified skills", () => {
    mockHelpers.getInstalledNames.mockReturnValue(["forced-skill"]);
    mockScoring.rankSkills.mockReturnValue([]);
    mockLoad.readSkillContent.mockReturnValue({ content: "# Forced", bytes: 512 });

    const result = curateForContext("/project", { forceInclude: ["forced-skill"] });
    expect(result.selected.length).toBe(1);
    expect(result.selected[0]!.score).toBe(999);
    expect(result.selected[0]!.reasons).toContain("Force-included");
  });

  it("skips unreadable skills", () => {
    mockHelpers.getInstalledNames.mockReturnValue(["broken"]);
    mockScoring.rankSkills.mockReturnValue([
      { skill: "broken", score: 80, verdict: "include", reasons: ["match"] },
    ]);
    mockLoad.readSkillContent.mockReturnValue(null);

    const result = curateForContext("/project", {});
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0]!.reason).toContain("unreadable");
  });

  it("resolves model context for budget calculation", () => {
    mockHelpers.getInstalledNames.mockReturnValue(["small"]);
    mockScoring.rankSkills.mockReturnValue([
      { skill: "small", score: 80, verdict: "include", reasons: ["match"] },
    ]);
    mockLoad.readSkillContent.mockReturnValue({ content: "# Small", bytes: 256 });

    // Use a known model
    const result = curateForContext("/project", { model: "claude-opus-4.6" });
    // Budget should be 30% of 200_000 = 60_000
    expect(result.budgetTokens).toBe(60_000);
  });

  it("uses custom budget percentage", () => {
    mockHelpers.getInstalledNames.mockReturnValue(["small"]);
    mockScoring.rankSkills.mockReturnValue([
      { skill: "small", score: 80, verdict: "include", reasons: ["match"] },
    ]);
    mockLoad.readSkillContent.mockReturnValue({ content: "# Small", bytes: 256 });

    const result = curateForContext("/project", { budgetPct: 50 });
    // Budget should be 50% of 200_000 = 100_000
    expect(result.budgetTokens).toBe(100_000);
    expect(result.budgetPct).toBe(50);
  });

  it("skips skills with skip verdict", () => {
    mockHelpers.getInstalledNames.mockReturnValue(["skipped"]);
    mockScoring.rankSkills.mockReturnValue([
      { skill: "skipped", score: 10, verdict: "skip", reasons: ["low relevance"] },
    ]);

    const result = curateForContext("/project", {});
    expect(result.selected.length).toBe(0);
  });

  it("estimates tokens from byte size", () => {
    mockHelpers.getInstalledNames.mockReturnValue(["skill"]);
    mockScoring.rankSkills.mockReturnValue([
      { skill: "skill", score: 80, verdict: "include", reasons: ["match"] },
    ]);
    // 1024 bytes = 1 KB -> 256 tokens per KB -> 256 tokens
    mockLoad.readSkillContent.mockReturnValue({ content: "x".repeat(1024), bytes: 1024 });

    const result = curateForContext("/project", {});
    expect(result.selected[0]!.tokens).toBe(256);
  });
});

describe("curateCommand", () => {
  it("outputs JSON when json flag set", async () => {
    mockHelpers.getInstalledNames.mockReturnValue(["ts"]);
    mockScoring.rankSkills.mockReturnValue([
      { skill: "ts", score: 80, verdict: "include", reasons: ["match"] },
    ]);
    mockLoad.readSkillContent.mockReturnValue({ content: "# TS", bytes: 256 });

    await curateCommand({ json: true });

    const output = JSON.parse(logOutput[0]!);
    expect(output.selected).toBeDefined();
    expect(output.totalTokens).toBeDefined();
  });

  it("shows error when no skills installed", async () => {
    mockHelpers.getInstalledNames.mockReturnValue([]);

    await curateCommand({ json: true });

    const output = JSON.parse(logOutput[0]!);
    expect(output.error).toContain("No skills installed");
  });

  it("displays budget bar in non-JSON mode", async () => {
    mockHelpers.getInstalledNames.mockReturnValue(["ts"]);
    mockScoring.rankSkills.mockReturnValue([
      { skill: "ts", score: 80, verdict: "include", reasons: ["match"] },
    ]);
    mockLoad.readSkillContent.mockReturnValue({ content: "# TS", bytes: 256 });

    await curateCommand({});

    expect(logOutput.some((l) => l.includes("tokens"))).toBe(true);
  });

  it("JSON mode writes _active.md and returns selected/skipped in output", async () => {
    mockHelpers.getInstalledNames.mockReturnValue(["ts", "golang"]);
    mockScoring.rankSkills.mockReturnValue([
      { skill: "ts", score: 80, verdict: "include", reasons: ["match"] },
      { skill: "golang", score: 60, verdict: "include", reasons: ["match"] },
    ]);
    mockLoad.readSkillContent.mockReturnValue({ content: "# Skill content", bytes: 512 });

    await curateCommand({ json: true });

    const output = JSON.parse(logOutput[0]!);
    expect(output.selected).toBeDefined();
    expect(output.selected.length).toBe(2);
    expect(output.skipped).toBeDefined();
    expect(output.totalTokens).toBeGreaterThan(0);
    expect(output.budgetTokens).toBeGreaterThan(0);
    expect(output.path).toBeDefined();
  });
});

describe("curateForContext additional coverage", () => {
  it("force-include skill that exceeds budget is skipped with reason (line 86)", () => {
    mockHelpers.getInstalledNames.mockReturnValue(["huge-forced"]);
    mockScoring.rankSkills.mockReturnValue([]);
    // Return a massive skill that exceeds budget
    mockLoad.readSkillContent.mockReturnValue({ content: "x".repeat(300_000), bytes: 300_000 });

    const result = curateForContext("/project", { forceInclude: ["huge-forced"] });
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0]!.reason).toContain("Force-included but exceeds budget");
  });

  it("skill with unreadable content is skipped (line 100)", () => {
    mockHelpers.getInstalledNames.mockReturnValue(["broken-skill"]);
    mockScoring.rankSkills.mockReturnValue([
      { skill: "broken-skill", score: 80, verdict: "include", reasons: ["match"] },
    ]);
    mockLoad.readSkillContent.mockReturnValue(null);

    const result = curateForContext("/project", {});
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0]!.reason).toBe("Content unreadable");
  });

  it("force-include with null content is silently skipped", () => {
    mockHelpers.getInstalledNames.mockReturnValue(["no-content"]);
    mockScoring.rankSkills.mockReturnValue([]);
    mockLoad.readSkillContent.mockReturnValue(null);

    const result = curateForContext("/project", { forceInclude: ["no-content"] });
    // null content means the skill is silently skipped (line 82: if (!content) continue)
    expect(result.selected.length).toBe(0);
  });
});

describe("regenerateActive", () => {
  it("creates _active.md and calls recordCuration for each skill", () => {
    mockHelpers.getInstalledNames.mockReturnValue(["ts", "golang"]);
    mockScoring.rankSkills.mockReturnValue([
      { skill: "ts", score: 80, verdict: "include", reasons: ["match"] },
      { skill: "golang", score: 60, verdict: "include", reasons: ["match"] },
    ]);
    mockLoad.readSkillContent.mockReturnValue({ content: "# Skill body", bytes: 512 });

    const result = regenerateActive({ budgetPct: 30 });

    expect(result.selected.length).toBe(2);
    expect(result.totalTokens).toBeGreaterThan(0);
    // recordCuration should have been called for each selected skill
    expect(mockUsage.recordCuration).toHaveBeenCalledTimes(2);
    expect(mockUsage.recordCuration).toHaveBeenCalledWith("ts");
    expect(mockUsage.recordCuration).toHaveBeenCalledWith("golang");
  });

  it("handles recordCuration throwing an error (best-effort)", () => {
    mockHelpers.getInstalledNames.mockReturnValue(["ts"]);
    mockScoring.rankSkills.mockReturnValue([
      { skill: "ts", score: 80, verdict: "include", reasons: ["match"] },
    ]);
    mockLoad.readSkillContent.mockReturnValue({ content: "# Skill body", bytes: 512 });
    mockUsage.recordCuration.mockImplementation(() => {
      throw new Error("Write failed");
    });

    // Should not throw
    const result = regenerateActive();
    expect(result.selected.length).toBe(1);
  });

  it("skips content insertion when readSkillContent returns null during file generation", () => {
    mockHelpers.getInstalledNames.mockReturnValue(["ghost"]);
    mockScoring.rankSkills.mockReturnValue([
      { skill: "ghost", score: 80, verdict: "include", reasons: ["match"] },
    ]);
    // First call (during curateForContext) returns valid content, second (during file generation) returns null
    let callCount = 0;
    mockLoad.readSkillContent.mockImplementation(() => {
      callCount++;
      if (callCount <= 1) return { content: "# Ghost", bytes: 256 };
      return null;
    });

    const result = regenerateActive();
    expect(result.selected.length).toBe(1);
  });
});
