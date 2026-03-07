import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../utils/project-context.js", () => ({
  detectProjectContext: vi.fn(),
}));

vi.mock("../registry.js", () => ({
  getProviders: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  log: { step: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { recommendCommand } from "./recommend.js";
import { detectProjectContext } from "../utils/project-context.js";
import { getProviders } from "../registry.js";
import type { ProjectContext } from "../utils/project-context.js";
import type { SkillInfo } from "../types.js";

function makeContext(overrides: Partial<ProjectContext> = {}): ProjectContext {
  return {
    name: "test-project",
    type: "Node.js",
    lang: "typescript",
    tags: ["typescript", "node", "testing"],
    preferences: [],
    ruleFiles: [],
    claudeMdContent: null,
    installedSkills: [],
    ...overrides,
  };
}

function makeSkill(overrides: Partial<SkillInfo> = {}): SkillInfo {
  return {
    name: "test-skill",
    description: "A test skill",
    version: "1.0.0",
    source: "arcana",
    tags: [],
    verified: true,
    author: "arcana",
    companions: [],
    conflicts: [],
    ...overrides,
  };
}

function mockProvider(skills: SkillInfo[]) {
  return {
    name: "arcana",
    displayName: "Arcana",
    list: vi.fn().mockResolvedValue(skills),
    search: vi.fn(),
    fetch: vi.fn(),
    info: vi.fn(),
    clearCache: vi.fn(),
  };
}

describe("recommendCommand", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("outputs JSON with recommended and optional skills", async () => {
    vi.mocked(detectProjectContext).mockReturnValue(makeContext());
    const skills = [
      makeSkill({ name: "typescript", tags: ["typescript", "node"] }),
      makeSkill({ name: "golang-pro", tags: ["go"] }),
      makeSkill({ name: "testing-strategy", tags: ["testing"] }),
    ];
    vi.mocked(getProviders).mockReturnValue([mockProvider(skills)] as never);

    await recommendCommand({ json: true });

    const output = vi.mocked(console.log).mock.calls.find((c) => {
      try {
        JSON.parse(c[0] as string);
        return true;
      } catch {
        return false;
      }
    });
    expect(output).toBeDefined();
    const parsed = JSON.parse(output![0] as string);
    expect(parsed.project.type).toBe("Node.js");
    expect(parsed.recommended.length).toBeGreaterThan(0);
  });

  it("marks installed skills as skipped", async () => {
    vi.mocked(detectProjectContext).mockReturnValue(makeContext({ installedSkills: ["typescript"] }));
    const skills = [makeSkill({ name: "typescript", tags: ["typescript"] })];
    vi.mocked(getProviders).mockReturnValue([mockProvider(skills)] as never);

    await recommendCommand({ json: true });

    const output = vi.mocked(console.log).mock.calls.find((c) => {
      try {
        JSON.parse(c[0] as string);
        return true;
      } catch {
        return false;
      }
    });
    const parsed = JSON.parse(output![0] as string);
    expect(parsed.skippedCount).toBe(1);
    expect(parsed.recommended).toHaveLength(0);
  });

  it("detects conflicts in JSON output", async () => {
    vi.mocked(detectProjectContext).mockReturnValue(makeContext({ installedSkills: ["skill-a"] }));
    const skills = [makeSkill({ name: "skill-b", tags: ["typescript"], conflicts: ["skill-a"] })];
    vi.mocked(getProviders).mockReturnValue([mockProvider(skills)] as never);

    await recommendCommand({ json: true });

    const output = vi.mocked(console.log).mock.calls.find((c) => {
      try {
        JSON.parse(c[0] as string);
        return true;
      } catch {
        return false;
      }
    });
    const parsed = JSON.parse(output![0] as string);
    expect(parsed.conflicts).toHaveLength(1);
    expect(parsed.conflicts[0].skill).toBe("skill-b");
  });

  it("exits with error when no skills available (JSON)", async () => {
    vi.mocked(detectProjectContext).mockReturnValue(makeContext());
    vi.mocked(getProviders).mockReturnValue([mockProvider([])] as never);

    const processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await recommendCommand({ json: true });

    const output = vi.mocked(console.log).mock.calls.find((c) => {
      try {
        const parsed = JSON.parse(c[0] as string);
        return parsed.error !== undefined;
      } catch {
        return false;
      }
    });
    expect(output).toBeDefined();
    const parsed = JSON.parse(output![0] as string);
    expect(parsed.error).toBe("No skills available");
    expect(processExitSpy).toHaveBeenCalledWith(1);
    processExitSpy.mockRestore();
  });

  it("handles provider list() error gracefully", async () => {
    vi.mocked(detectProjectContext).mockReturnValue(makeContext());
    const failingProvider = {
      name: "broken",
      displayName: "Broken",
      list: vi.fn().mockRejectedValue(new Error("Network error")),
      search: vi.fn(),
      fetch: vi.fn(),
      info: vi.fn(),
      clearCache: vi.fn(),
    };
    vi.mocked(getProviders).mockReturnValue([failingProvider] as never);

    const processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await recommendCommand({ json: true });

    expect(processExitSpy).toHaveBeenCalledWith(1);
    processExitSpy.mockRestore();
  });

  it("respects --limit option", async () => {
    vi.mocked(detectProjectContext).mockReturnValue(makeContext());
    const skills = [
      makeSkill({ name: "s1", tags: ["typescript", "node", "testing"] }),
      makeSkill({ name: "s2", tags: ["typescript", "node", "testing"] }),
      makeSkill({ name: "s3", tags: ["typescript", "node", "testing"] }),
    ];
    vi.mocked(getProviders).mockReturnValue([mockProvider(skills)] as never);

    await recommendCommand({ json: true, limit: 1 });

    const output = vi.mocked(console.log).mock.calls.find((c) => {
      try {
        JSON.parse(c[0] as string);
        return true;
      } catch {
        return false;
      }
    });
    const parsed = JSON.parse(output![0] as string);
    expect(parsed.recommended).toHaveLength(1);
  });
});
