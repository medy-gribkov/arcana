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
  // ──────────────────────────────────────────
  // Already installed / conflicts
  // ──────────────────────────────────────────

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

  it("does not flag conflict when conflicts array is empty", () => {
    const skill = makeSkill({ name: "safe-skill", conflicts: [] });
    const context = makeContext({ installedSkills: ["other-skill"] });

    const result = scoreSkill(skill, context, context.installedSkills, [skill]);

    expect(result.verdict).not.toBe("conflict");
  });

  it("does not flag conflict when conflicts is undefined", () => {
    const skill = makeSkill({ name: "safe-skill", conflicts: undefined });
    const context = makeContext({ installedSkills: ["other-skill"] });

    const result = scoreSkill(skill, context, context.installedSkills, [skill]);

    expect(result.verdict).not.toBe("conflict");
  });

  it("lists multiple conflicting skills in reason", () => {
    const skill = makeSkill({
      name: "new-linter",
      conflicts: ["old-linter-a", "old-linter-b", "old-linter-c"],
    });
    const context = makeContext({ installedSkills: ["old-linter-a", "old-linter-c"] });

    const result = scoreSkill(skill, context, context.installedSkills, [skill]);

    expect(result.verdict).toBe("conflict");
    expect(result.reasons[0]).toContain("old-linter-a");
    expect(result.reasons[0]).toContain("old-linter-c");
  });

  // ──────────────────────────────────────────
  // Tag matching
  // ──────────────────────────────────────────

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

  it("gives no tag score when skill has no tags", () => {
    const skill = makeSkill({ name: "no-tags", tags: [] });
    const context = makeContext({ tags: ["go", "golang"] });

    const result = scoreSkill(skill, context, [], [skill]);

    expect(result.reasons.some((r) => r.startsWith("Tags:"))).toBe(false);
  });

  it("gives no tag score when skill tags is undefined", () => {
    const skill = makeSkill({ name: "undef-tags", tags: undefined });
    const context = makeContext({ tags: ["go", "golang"] });

    const result = scoreSkill(skill, context, [], [skill]);

    expect(result.reasons.some((r) => r.startsWith("Tags:"))).toBe(false);
  });

  it("gives no tag score when tags don't overlap", () => {
    const skill = makeSkill({ name: "python-skill", tags: ["python", "flask"] });
    const context = makeContext({ tags: ["go", "golang"] });

    const result = scoreSkill(skill, context, [], [skill]);

    expect(result.reasons.some((r) => r.startsWith("Tags:"))).toBe(false);
  });

  // ──────────────────────────────────────────
  // Category match
  // ──────────────────────────────────────────

  it("gives +10 category match when type keywords match but no tag match yet", () => {
    // The category match only fires when there are no "Tags:" reasons already.
    // So we need skill.tags to contain a type keyword but NOT overlap with context.tags.
    const skill = makeSkill({
      name: "react-helper",
      tags: ["web"], // "web" is in Next.js type keywords
    });
    const context = makeContext({
      type: "Next.js",
      tags: ["next", "typescript"], // No overlap with ["web"]
    });

    const result = scoreSkill(skill, context, [], [skill]);

    expect(result.score).toBe(10);
    expect(result.reasons).toContain("Category match");
  });

  it("does not add category match when tag match already present", () => {
    // If tag match already happened, category match is skipped
    const skill = makeSkill({
      name: "react-skill",
      tags: ["react", "web"], // "react" overlaps with context, "web" is in type keywords
    });
    const context = makeContext({
      type: "Next.js",
      tags: ["react", "next"], // "react" overlaps
    });

    const result = scoreSkill(skill, context, [], [skill]);

    // Should have tag match (+20) but NOT category match
    expect(result.reasons.some((r) => r.startsWith("Tags:"))).toBe(true);
    expect(result.reasons).not.toContain("Category match");
  });

  it("does not add category match when type is not in TYPE_CATEGORY_MAP", () => {
    const skill = makeSkill({ name: "skill", tags: ["something"] });
    const context = makeContext({ type: "Unknown", tags: [] });

    const result = scoreSkill(skill, context, [], [skill]);

    expect(result.reasons).not.toContain("Category match");
  });

  it("handles React type category match", () => {
    const skill = makeSkill({ name: "react-kit", tags: ["typescript"] });
    const context = makeContext({
      type: "React",
      tags: ["jsx"], // No overlap with ["typescript"]
    });

    const result = scoreSkill(skill, context, [], [skill]);

    expect(result.reasons).toContain("Category match");
    expect(result.score).toBe(10);
  });

  it("handles Node.js type category match", () => {
    const skill = makeSkill({ name: "node-kit", tags: ["node"] });
    const context = makeContext({
      type: "Node.js",
      tags: ["express"], // No overlap with ["node"]
    });

    const result = scoreSkill(skill, context, [], [skill]);

    expect(result.reasons).toContain("Category match");
  });

  it("handles Rust type category match", () => {
    const skill = makeSkill({ name: "rust-kit", tags: ["rust"] });
    const context = makeContext({
      type: "Rust",
      tags: ["cargo"], // No overlap with ["rust"]
    });

    const result = scoreSkill(skill, context, [], [skill]);

    expect(result.reasons).toContain("Category match");
  });

  it("handles Python type category match", () => {
    const skill = makeSkill({ name: "py-kit", tags: ["python"] });
    const context = makeContext({
      type: "Python",
      tags: ["flask"], // No overlap with ["python"]
    });

    const result = scoreSkill(skill, context, [], [skill]);

    expect(result.reasons).toContain("Category match");
  });

  // ──────────────────────────────────────────
  // Companion boost
  // ──────────────────────────────────────────

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

  it("does not give companion boost when no installed skill lists it as companion", () => {
    const installedSkill = makeSkill({
      name: "go-base",
      companions: ["unrelated-skill"],
    });
    const candidateSkill = makeSkill({ name: "go-linter", tags: [] });
    const context = makeContext({ installedSkills: ["go-base"] });

    const result = scoreSkill(candidateSkill, context, context.installedSkills, [installedSkill, candidateSkill]);

    expect(result.reasons.some((r) => r.includes("Companion of"))).toBe(false);
  });

  it("lists multiple companion sources in reason", () => {
    const installed1 = makeSkill({ name: "base-a", companions: ["helper"] });
    const installed2 = makeSkill({ name: "base-b", companions: ["helper"] });
    const candidate = makeSkill({ name: "helper", tags: [] });
    const context = makeContext({ installedSkills: ["base-a", "base-b"] });

    const result = scoreSkill(candidate, context, context.installedSkills, [installed1, installed2, candidate]);

    expect(result.score).toBe(15);
    expect(result.reasons.some((r) => r.includes("base-a") && r.includes("base-b"))).toBe(true);
  });

  // ──────────────────────────────────────────
  // Rule overlap penalty
  // ──────────────────────────────────────────

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

  it("rule overlap is case-insensitive", () => {
    const skill = makeSkill({ name: "TypeScript", tags: [] });
    const context = makeContext({
      tags: [],
      ruleFiles: ["typescript.md"],
    });

    const result = scoreSkill(skill, context, [], [skill]);

    expect(result.reasons.some((r) => r.includes("Rule overlap"))).toBe(true);
  });

  it("no rule overlap when rule file name does not match skill name", () => {
    const skill = makeSkill({ name: "golang", tags: [] });
    const context = makeContext({
      tags: [],
      ruleFiles: ["typescript.md", "react.md"],
    });

    const result = scoreSkill(skill, context, [], [skill]);

    expect(result.reasons.some((r) => r.includes("Rule overlap"))).toBe(false);
  });

  // ──────────────────────────────────────────
  // Preference alignment
  // ──────────────────────────────────────────

  it("gives +10 for preference alignment", () => {
    const skill = makeSkill({
      name: "strict-lint",
      description: "Enforces strict TypeScript linting rules with zero tolerance",
      tags: [],
    });
    const context = makeContext({
      tags: [],
      // "linting" is > 4 chars and appears in the description as "linting"
      preferences: ["Always use linting enforcement"],
    });

    const result = scoreSkill(skill, context, [], [skill]);

    expect(result.score).toBe(10);
    expect(result.reasons).toContain("Matches project preferences");
  });

  it("does not match preferences with short words (<=4 chars)", () => {
    const skill = makeSkill({
      name: "go-skill",
      description: "A go tool",
      tags: [],
    });
    const context = makeContext({
      tags: [],
      preferences: ["Use go for backend"],
    });

    // Words "Use", "go", "for" are all <= 4 chars; "backend" > 4 chars but not in description
    const result = scoreSkill(skill, context, [], [skill]);

    expect(result.reasons).not.toContain("Matches project preferences");
  });

  it("does not add preference score when preferences is empty", () => {
    const skill = makeSkill({
      name: "anything",
      description: "Some description with strict rules",
      tags: [],
    });
    const context = makeContext({ tags: [], preferences: [] });

    const result = scoreSkill(skill, context, [], [skill]);

    expect(result.reasons).not.toContain("Matches project preferences");
  });

  it("does not add preference score when description is empty", () => {
    const skill = makeSkill({
      name: "empty-desc",
      description: "",
      tags: [],
    });
    const context = makeContext({
      tags: [],
      preferences: ["strict TypeScript"],
    });

    const result = scoreSkill(skill, context, [], [skill]);

    expect(result.reasons).not.toContain("Matches project preferences");
  });

  // ──────────────────────────────────────────
  // Verdict thresholds
  // ──────────────────────────────────────────

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

  it("returns optional at exactly score 15 (companion boost only)", () => {
    const installed = makeSkill({ name: "base", companions: ["addon"] });
    const candidate = makeSkill({ name: "addon", tags: [] });
    const context = makeContext({ installedSkills: ["base"], tags: [] });

    const result = scoreSkill(candidate, context, context.installedSkills, [installed, candidate]);

    expect(result.score).toBe(15);
    expect(result.verdict).toBe("optional");
  });

  // ──────────────────────────────────────────
  // Combined scoring
  // ──────────────────────────────────────────

  it("combines tag match + companion + preference for high score", () => {
    const installed = makeSkill({ name: "base-go", companions: ["go-advanced"] });
    const candidate = makeSkill({
      name: "go-advanced",
      description: "Advanced golang tooling with strict checks",
      tags: ["go", "golang"],
    });
    const context = makeContext({
      installedSkills: ["base-go"],
      tags: ["go", "golang", "docker"],
      preferences: ["strict error handling"],
    });

    const result = scoreSkill(candidate, context, context.installedSkills, [installed, candidate]);

    // 2 tags * 20 = 40 (tag) + 15 (companion) + 10 (preference "strict") = 65
    expect(result.score).toBe(65);
    expect(result.verdict).toBe("recommended");
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

    expect(ranked[0]!.skill).toBe("best-match");
    expect(ranked[1]!.skill).toBe("partial-match");
    expect(ranked[2]!.skill).toBe("no-match");
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
    expect(ranked[1]!.score).toBeGreaterThan(ranked[2]!.score);
  });

  it("places already-installed skills below active candidates", () => {
    const skills = [
      makeSkill({ name: "installed-skill", tags: ["go", "golang", "docker"] }),
      makeSkill({ name: "new-skill", tags: ["go"] }),
    ];
    const context = makeContext({
      tags: ["go", "golang", "docker"],
      installedSkills: ["installed-skill"],
    });

    const ranked = rankSkills(skills, context);

    // installed-skill gets score=0 (skip), new-skill gets 20 (1 tag)
    expect(ranked[0]!.skill).toBe("new-skill");
    expect(ranked[1]!.skill).toBe("installed-skill");
  });

  it("returns empty array for empty input", () => {
    const context = makeContext();
    const ranked = rankSkills([], context);
    expect(ranked).toEqual([]);
  });

  it("handles single skill", () => {
    const skills = [makeSkill({ name: "only-one", tags: ["go"] })];
    const context = makeContext({ tags: ["go"] });

    const ranked = rankSkills(skills, context);

    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.skill).toBe("only-one");
    expect(ranked[0]!.score).toBe(20);
  });
});
