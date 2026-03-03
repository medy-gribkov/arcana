import { describe, it, expect } from "vitest";
import { checkConflicts } from "./conflict-check.js";
import type { SkillInfo } from "../types.js";
import type { ProjectContext } from "./project-context.js";

function makeSkill(overrides: Partial<SkillInfo> = {}): SkillInfo {
  return {
    name: "test-skill",
    description: "A test skill",
    version: "1.0.0",
    source: "arcana",
    tags: [],
    companions: [],
    conflicts: [],
    verified: true,
    author: "arcana",
    ...overrides,
  };
}

function makeContext(overrides: Partial<ProjectContext> = {}): ProjectContext {
  return {
    name: "my-project",
    type: "Go",
    lang: "go",
    tags: ["go", "golang"],
    preferences: [],
    ruleFiles: [],
    claudeMdContent: null,
    installedSkills: [],
    ...overrides,
  };
}

describe("checkConflicts", () => {
  it("returns empty array when no conflicts", () => {
    const skill = makeSkill({ name: "golang-pro" });
    const context = makeContext();

    const result = checkConflicts("golang-pro", skill, "Some skill content", context);

    expect(result).toEqual([]);
  });

  it("detects explicit skill conflict with block severity", () => {
    const skill = makeSkill({
      name: "eslint-flat",
      conflicts: ["eslint-legacy"],
    });
    const context = makeContext({ installedSkills: ["eslint-legacy"] });

    const result = checkConflicts("eslint-flat", skill, "Flat config linter", context);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("skill-conflict");
    expect(result[0].severity).toBe("block");
    expect(result[0].message).toContain("eslint-legacy");
  });

  it("detects rule overlap with warn severity", () => {
    const skill = makeSkill({ name: "typescript" });
    const context = makeContext({ ruleFiles: ["typescript.md"] });

    const result = checkConflicts("typescript", skill, "TS rules", context);

    const ruleOverlap = result.find((w) => w.type === "rule-overlap" && w.message.includes("already exists"));
    expect(ruleOverlap).toBeDefined();
    expect(ruleOverlap!.severity).toBe("warn");
  });

  it("detects tag overlap with existing rules", () => {
    const skill = makeSkill({
      name: "web-tooling",
      tags: ["eslint", "prettier"],
    });
    const context = makeContext({ ruleFiles: ["eslint.md"] });

    const result = checkConflicts("web-tooling", skill, "Web tools", context);

    const tagOverlap = result.find((w) => w.type === "rule-overlap" && w.message.includes("tag"));
    expect(tagOverlap).toBeDefined();
    expect(tagOverlap!.message).toContain("eslint");
    expect(tagOverlap!.severity).toBe("warn");
  });

  it("detects preference clash", () => {
    const skill = makeSkill({ name: "callback-patterns" });
    const context = makeContext({
      preferences: ["Use async/await over callbacks"],
    });
    const content = "This skill teaches effective use of callbacks for handling async operations.";

    const result = checkConflicts("callback-patterns", skill, content, context);

    const clash = result.find((w) => w.type === "preference-clash");
    expect(clash).toBeDefined();
    expect(clash!.severity).toBe("warn");
    expect(clash!.message).toContain("callbacks");
    expect(clash!.message).toContain("async/await");
  });

  it("returns multiple warnings for multiple issues", () => {
    const skill = makeSkill({
      name: "typescript",
      tags: ["typescript"],
    });
    const context = makeContext({
      ruleFiles: ["typescript.md"],
      preferences: ["Use async/await over callbacks"],
    });
    const content = "Use callbacks for event handling in TypeScript.";

    const result = checkConflicts("typescript", skill, content, context);

    // Should have rule-overlap (name match) + preference-clash (callbacks vs async/await)
    expect(result.length).toBeGreaterThanOrEqual(2);
    const types = result.map((w) => w.type);
    expect(types).toContain("rule-overlap");
    expect(types).toContain("preference-clash");
  });

  it("handles null skillInfo gracefully", () => {
    const context = makeContext();

    const result = checkConflicts("some-skill", null, "Some content", context);

    expect(Array.isArray(result)).toBe(true);
  });

  it("handles null skillContent gracefully", () => {
    const skill = makeSkill({ name: "some-skill" });
    const context = makeContext({
      preferences: ["Use async/await over callbacks"],
    });

    const result = checkConflicts("some-skill", skill, null, context);

    // No preference-clash should appear since content is null
    const clashes = result.filter((w) => w.type === "preference-clash");
    expect(clashes).toHaveLength(0);
  });
});
