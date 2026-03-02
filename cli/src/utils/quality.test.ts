import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { jaccardSimilarity, validateCompanions, validateDescriptionSync, crossValidate } from "./quality.js";
import type { MarketplacePlugin } from "../types.js";

function makeTestSetup(
  skills: { name: string; description: string }[],
  plugins: Partial<MarketplacePlugin>[],
): { skillsDir: string; marketplacePath: string } {
  const base = mkdtempSync(join(tmpdir(), "arcana-cross-"));
  const skillsDir = join(base, "skills");
  mkdirSync(skillsDir, { recursive: true });

  for (const skill of skills) {
    const dir = join(skillsDir, skill.name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "SKILL.md"),
      `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n## Content\nBody here`,
      "utf-8",
    );
  }

  const marketplacePath = join(base, "marketplace.json");
  writeFileSync(
    marketplacePath,
    JSON.stringify({
      name: "test",
      plugins: plugins.map((p) => ({
        name: p.name || "unknown",
        source: `./skills/${p.name || "unknown"}`,
        description: p.description || "A test description that is long enough to pass validation checks",
        version: p.version || "1.0.0",
        ...p,
      })),
    }),
    "utf-8",
  );

  return { skillsDir, marketplacePath };
}

describe("jaccardSimilarity", () => {
  it("returns 1.0 for identical strings", () => {
    expect(jaccardSimilarity("hello world", "hello world")).toBe(1.0);
  });

  it("returns 0.0 for completely different strings", () => {
    expect(jaccardSimilarity("alpha beta gamma", "delta epsilon zeta")).toBe(0.0);
  });

  it("returns expected value for partial overlap", () => {
    const sim = jaccardSimilarity("hello world foo", "hello world bar");
    expect(sim).toBeGreaterThan(0.4);
    expect(sim).toBeLessThan(0.7);
  });

  it("handles empty strings", () => {
    expect(jaccardSimilarity("", "")).toBe(1.0);
    expect(jaccardSimilarity("hello", "")).toBe(0.0);
    expect(jaccardSimilarity("", "hello")).toBe(0.0);
  });
});

describe("validateCompanions", () => {
  it("passes when all companions exist", () => {
    const plugins: MarketplacePlugin[] = [
      { name: "skill-a", source: "./skills/skill-a", description: "desc a", version: "1.0.0", companions: ["skill-b"] },
      { name: "skill-b", source: "./skills/skill-b", description: "desc b", version: "1.0.0" },
    ];
    expect(validateCompanions(plugins)).toHaveLength(0);
  });

  it("detects companion pointing to non-existent skill", () => {
    const plugins: MarketplacePlugin[] = [
      { name: "skill-a", source: "./skills/skill-a", description: "desc a", version: "1.0.0", companions: ["ghost"] },
    ];
    const issues = validateCompanions(plugins);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.category).toBe("companion");
    expect(issues[0]!.detail).toContain("ghost");
  });

  it("handles plugins with no companions", () => {
    const plugins: MarketplacePlugin[] = [
      { name: "skill-a", source: "./skills/skill-a", description: "desc a", version: "1.0.0" },
    ];
    expect(validateCompanions(plugins)).toHaveLength(0);
  });
});

describe("validateDescriptionSync", () => {
  it("passes when descriptions match", () => {
    expect(validateDescriptionSync("test", "Same description here", "Same description here")).toBeNull();
  });

  it("passes when descriptions are similar", () => {
    expect(
      validateDescriptionSync(
        "test",
        "Build REST APIs with Node.js and Express",
        "Build REST APIs with Node.js Express and routing",
      ),
    ).toBeNull();
  });

  it("detects description drift", () => {
    const issue = validateDescriptionSync(
      "test",
      "Completely unrelated topic about cooking",
      "Advanced quantum physics simulation engine",
    );
    expect(issue).not.toBeNull();
    expect(issue!.category).toBe("marketplace-drift");
  });

  it("returns null when either description is empty", () => {
    expect(validateDescriptionSync("test", "", "Some desc")).toBeNull();
    expect(validateDescriptionSync("test", "Some desc", "")).toBeNull();
  });
});

describe("crossValidate", () => {
  it("passes when dirs and marketplace match", () => {
    const desc = "A valid description that is long enough to pass the minimum length requirement for skills";
    const { skillsDir, marketplacePath } = makeTestSetup(
      [{ name: "skill-a", description: desc }],
      [{ name: "skill-a", description: desc }],
    );
    const issues = crossValidate(skillsDir, marketplacePath);
    const errors = issues.filter((i) => i.level === "error");
    expect(errors).toHaveLength(0);
  });

  it("detects orphan skill directory (no marketplace entry)", () => {
    const desc = "A valid description that is long enough to pass the minimum length requirement for skills";
    const { skillsDir, marketplacePath } = makeTestSetup(
      [
        { name: "skill-a", description: desc },
        { name: "orphan-dir", description: desc },
      ],
      [{ name: "skill-a", description: desc }],
    );
    const issues = crossValidate(skillsDir, marketplacePath);
    const orphans = issues.filter((i) => i.category === "orphan" && i.skill === "orphan-dir");
    expect(orphans).toHaveLength(1);
    expect(orphans[0]!.detail).toContain("no marketplace.json entry");
  });

  it("detects orphan marketplace entry (no skill directory)", () => {
    const desc = "A valid description that is long enough to pass the minimum length requirement for skills";
    const { skillsDir, marketplacePath } = makeTestSetup(
      [{ name: "skill-a", description: desc }],
      [
        { name: "skill-a", description: desc },
        { name: "ghost-entry", description: desc },
      ],
    );
    const issues = crossValidate(skillsDir, marketplacePath);
    const orphans = issues.filter((i) => i.category === "orphan" && i.skill === "ghost-entry");
    expect(orphans).toHaveLength(1);
    expect(orphans[0]!.detail).toContain("no skill directory");
  });

  it("detects near-duplicate descriptions across skills", () => {
    const desc1 = "Build scalable REST APIs with Node.js Express routing and middleware patterns for web apps";
    const desc2 = "Build scalable REST APIs with Node.js Express routing and middleware patterns for web applications";
    const { skillsDir, marketplacePath } = makeTestSetup(
      [
        { name: "skill-a", description: desc1 },
        { name: "skill-b", description: desc2 },
      ],
      [
        { name: "skill-a", description: desc1 },
        { name: "skill-b", description: desc2 },
      ],
    );
    const issues = crossValidate(skillsDir, marketplacePath);
    const dupes = issues.filter((i) => i.category === "duplicate-desc");
    expect(dupes.length).toBeGreaterThanOrEqual(1);
  });

  it("handles empty marketplace gracefully", () => {
    const { skillsDir, marketplacePath } = makeTestSetup([{ name: "skill-a", description: "Some description" }], []);
    const issues = crossValidate(skillsDir, marketplacePath);
    expect(issues.some((i) => i.category === "orphan")).toBe(true);
  });

  it("handles empty skills directory gracefully", () => {
    const desc = "A valid description that is long enough";
    const { skillsDir, marketplacePath } = makeTestSetup([], [{ name: "skill-a", description: desc }]);
    const issues = crossValidate(skillsDir, marketplacePath);
    expect(issues.some((i) => i.category === "orphan" && i.skill === "skill-a")).toBe(true);
  });

  it("validates companion references", () => {
    const desc = "A valid description that is long enough to pass the minimum length requirement for skills";
    const { skillsDir, marketplacePath } = makeTestSetup(
      [{ name: "skill-a", description: desc }],
      [{ name: "skill-a", description: desc, companions: ["nonexistent"] }],
    );
    const issues = crossValidate(skillsDir, marketplacePath);
    const companionIssues = issues.filter((i) => i.category === "companion");
    expect(companionIssues).toHaveLength(1);
    expect(companionIssues[0]!.detail).toContain("nonexistent");
  });
});
