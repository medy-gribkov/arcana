import { describe, it, expect } from "vitest";
import { scoreSkill, rankSkills } from "./scoring.js";
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
    tags: ["go", "golang", "docker"],
    preferences: [],
    ruleFiles: [],
    claudeMdContent: null,
    installedSkills: [],
    ...overrides,
  };
}

describe("scoreSkill", () => {
  it("returns skip for already installed skills", () => {
    const skill = makeSkill({ name: "golang-pro" });
    const context = makeContext({ installedSkills: ["golang-pro"] });

    const result = scoreSkill(skill, context, context.installedSkills, [skill]);

    expect(result.verdict).toBe("skip");
    expect(result.score).toBe(0);
    expect(result.reasons).toContain("Already installed");
  });

  it("returns conflict when skill conflicts with installed skill", () => {
    const skill = makeSkill({
      name: "eslint-flat",
      conflicts: ["eslint-legacy"],
    });
    const context = makeContext({ installedSkills: ["eslint-legacy"] });

    const result = scoreSkill(skill, context, context.installedSkills, [skill]);

    expect(result.verdict).toBe("conflict");
    expect(result.score).toBe(-100);
    expect(result.reasons[0]).toContain("eslint-legacy");
  });

  it("scores tag matches at +20 per tag, capped at +60", () => {
    const skill = makeSkill({
      name: "multi-tag-skill",
      tags: ["go", "golang", "docker", "kubernetes"],
    });
    const context = makeContext({
      tags: ["go", "golang", "docker", "kubernetes"],
    });

    const result = scoreSkill(skill, context, [], [skill]);

    // 4 tags * 20 = 80, capped at 60
    expect(result.score).toBe(60);
  });

  it("gives companion boost of +15", () => {
    const installedSkill = makeSkill({
      name: "go-base",
      companions: ["go-linter-configuration"],
    });
    const candidateSkill = makeSkill({
      name: "go-linter-configuration",
      tags: [],
    });
    const context = makeContext({ installedSkills: ["go-base"] });

    const result = scoreSkill(candidateSkill, context, context.installedSkills, [installedSkill, candidateSkill]);

    expect(result.score).toBe(15);
    expect(result.reasons.some((r) => r.includes("Companion of"))).toBe(true);
  });

  it("penalizes rule overlap at -30", () => {
    const skill = makeSkill({ name: "typescript", tags: [] });
    const context = makeContext({
      tags: [],
      ruleFiles: ["typescript.md"],
    });

    const result = scoreSkill(skill, context, [], [skill]);

    expect(result.score).toBe(-30);
    expect(result.reasons.some((r) => r.includes("Rule overlap"))).toBe(true);
  });

  it("returns recommended for score >= 40", () => {
    const skill = makeSkill({
      name: "golang-pro",
      tags: ["go", "golang"],
    });
    const context = makeContext({ tags: ["go", "golang", "docker"] });

    const result = scoreSkill(skill, context, [], [skill]);

    // 2 tags * 20 = 40
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.verdict).toBe("recommended");
  });

  it("returns optional for score 15-39", () => {
    const skill = makeSkill({
      name: "docker-helper",
      tags: ["docker"],
    });
    const context = makeContext({ tags: ["go", "golang", "docker"] });

    const result = scoreSkill(skill, context, [], [skill]);

    // 1 tag * 20 = 20
    expect(result.score).toBeGreaterThanOrEqual(15);
    expect(result.score).toBeLessThan(40);
    expect(result.verdict).toBe("optional");
  });

  it("returns skip for score < 15", () => {
    const skill = makeSkill({
      name: "ruby-gems",
      tags: ["ruby", "rails"],
    });
    const context = makeContext({ tags: ["go", "golang", "docker"] });

    const result = scoreSkill(skill, context, [], [skill]);

    expect(result.score).toBeLessThan(15);
    expect(result.verdict).toBe("skip");
  });
});

describe("rankSkills", () => {
  it("sorts by score descending", () => {
    const skills = [
      makeSkill({ name: "no-match", tags: ["ruby"] }),
      makeSkill({ name: "best-match", tags: ["go", "golang", "docker"] }),
      makeSkill({ name: "partial-match", tags: ["go"] }),
    ];
    const context = makeContext({
      tags: ["go", "golang", "docker"],
      installedSkills: [],
    });

    const ranked = rankSkills(skills, context);

    expect(ranked[0].skill).toBe("best-match");
    expect(ranked[1].skill).toBe("partial-match");
    expect(ranked[2].skill).toBe("no-match");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    expect(ranked[1].score).toBeGreaterThan(ranked[2].score);
  });
});
