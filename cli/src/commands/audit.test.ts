import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { auditSkill } from "./audit.js";

function makeTempSkill(name: string, content: string, extraDirs: string[] = []): string {
  const base = mkdtempSync(join(tmpdir(), "arcana-test-"));
  const skillDir = join(base, name);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), content, "utf-8");

  for (const dir of extraDirs) {
    mkdirSync(join(skillDir, dir), { recursive: true });
  }

  return skillDir;
}

describe("auditSkill", () => {
  it("returns WEAK with score 0 when SKILL.md doesn't exist", () => {
    const base = mkdtempSync(join(tmpdir(), "arcana-test-"));
    const skillDir = join(base, "empty");
    mkdirSync(skillDir, { recursive: true });

    const result = auditSkill(skillDir, "empty");

    expect(result.rating).toBe("WEAK");
    expect(result.score).toBe(0);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0]!.passed).toBe(false);
    expect(result.checks[0]!.name).toBe("SKILL.md exists");
  });

  it("returns low score when SKILL.md has only frontmatter, no body", () => {
    const content = "---\nname: test-skill\ndescription: " + "A".repeat(100) + "\n---\n";
    const skillDir = makeTempSkill("test-skill", content);

    const result = auditSkill(skillDir, "test-skill");

    expect(result.score).toBeLessThan(40);
    expect(result.rating).toBe("WEAK");
    const headingCheck = result.checks.find((c) => c.name.includes("headings"));
    expect(headingCheck?.passed).toBe(false);
  });

  it("scores correctly for description length check (80-1024 chars)", () => {
    const shortDesc = "A".repeat(50);
    const goodDesc = "A".repeat(100);
    const longDesc = "A".repeat(2000);

    const shortContent = `---\nname: short\ndescription: ${shortDesc}\n---\n## Heading\n${"Body line\n".repeat(60)}`;
    const goodContent = `---\nname: good\ndescription: ${goodDesc}\n---\n## Heading\n${"Body line\n".repeat(60)}`;
    const longContent = `---\nname: long\ndescription: ${longDesc}\n---\n## Heading\n${"Body line\n".repeat(60)}`;

    const shortDir = makeTempSkill("short", shortContent);
    const goodDir = makeTempSkill("good", goodContent);
    const longDir = makeTempSkill("long", longContent);

    const shortResult = auditSkill(shortDir, "short");
    const goodResult = auditSkill(goodDir, "good");
    const longResult = auditSkill(longDir, "long");

    const shortDescCheck = shortResult.checks.find((c) => c.name.includes("Description length"));
    const goodDescCheck = goodResult.checks.find((c) => c.name.includes("Description length"));
    const longDescCheck = longResult.checks.find((c) => c.name.includes("Description length"));

    expect(shortDescCheck?.passed).toBe(false);
    expect(goodDescCheck?.passed).toBe(true);
    expect(longDescCheck?.passed).toBe(false);
  });

  it("counts ## headings correctly", () => {
    const noHeadings = `---\nname: test\ndescription: ${"A".repeat(100)}\n---\n${"Body\n".repeat(60)}`;
    const twoHeadings = `---\nname: test\ndescription: ${"A".repeat(100)}\n---\n## First\nContent\n## Second\nContent\n${"Body\n".repeat(50)}`;
    const threeHeadings = `---\nname: test\ndescription: ${"A".repeat(100)}\n---\n## First\n## Second\n## Third\n${"Body\n".repeat(50)}`;

    const noDir = makeTempSkill("no", noHeadings);
    const twoDir = makeTempSkill("two", twoHeadings);
    const threeDir = makeTempSkill("three", threeHeadings);

    const noResult = auditSkill(noDir, "no");
    const twoResult = auditSkill(twoDir, "two");
    const threeResult = auditSkill(threeDir, "three");

    const noCheck = noResult.checks.find((c) => c.name.includes("headings"));
    const twoCheck = twoResult.checks.find((c) => c.name.includes("headings"));
    const threeCheck = threeResult.checks.find((c) => c.name.includes("headings"));

    expect(noCheck?.passed).toBe(false);
    expect(noCheck?.detail).toBe("0 headings");
    expect(twoCheck?.passed).toBe(true);
    expect(twoCheck?.detail).toBe("2 headings");
    expect(threeCheck?.passed).toBe(true);
    expect(threeCheck?.detail).toBe("3 headings");
  });

  it("counts code blocks correctly", () => {
    const noCode = `---\nname: test\ndescription: ${"A".repeat(100)}\n---\n## Heading\n${"Body\n".repeat(60)}`;
    const oneBlock = `---\nname: test\ndescription: ${"A".repeat(100)}\n---\n## Heading\n\`\`\`js\ncode\n\`\`\`\n${"Body\n".repeat(50)}`;
    const twoBlocks = `---\nname: test\ndescription: ${"A".repeat(100)}\n---\n## Heading\n\`\`\`js\ncode\n\`\`\`\n## Second\n\`\`\`ts\nmore\n\`\`\`\n${"Body\n".repeat(50)}`;

    const noDir = makeTempSkill("no", noCode);
    const oneDir = makeTempSkill("one", oneBlock);
    const twoDir = makeTempSkill("two", twoBlocks);

    const noResult = auditSkill(noDir, "no");
    const oneResult = auditSkill(oneDir, "one");
    const twoResult = auditSkill(twoDir, "two");

    const noCheck = noResult.checks.find((c) => c.name.includes("code examples"));
    const oneCheck = oneResult.checks.find((c) => c.name.includes("code examples"));
    const twoCheck = twoResult.checks.find((c) => c.name.includes("code examples"));

    expect(noCheck?.passed).toBe(false);
    expect(noCheck?.detail).toBe("0 blocks");
    expect(oneCheck?.passed).toBe(false);
    expect(oneCheck?.detail).toBe("1 blocks");
    expect(twoCheck?.passed).toBe(true);
    expect(twoCheck?.detail).toBe("2 blocks");
  });

  it("detects BAD/GOOD patterns", () => {
    const noPairs = `---\nname: test\ndescription: ${"A".repeat(100)}\n---\n## Heading\n${"Body\n".repeat(60)}`;
    const withBAD = `---\nname: test\ndescription: ${"A".repeat(100)}\n---\n## Heading\nBAD example:\n\`\`\`\ncode\n\`\`\`\nGOOD example:\n\`\`\`\ncode\n\`\`\`\n${"Body\n".repeat(50)}`;
    const withBEFORE = `---\nname: test\ndescription: ${"A".repeat(100)}\n---\n## Heading\nBEFORE:\n\`\`\`\ncode\n\`\`\`\nAFTER:\n\`\`\`\ncode\n\`\`\`\n${"Body\n".repeat(50)}`;
    const withDO = `---\nname: test\ndescription: ${"A".repeat(100)}\n---\n## Heading\nDON'T do this:\n\`\`\`\ncode\n\`\`\`\nDO this instead:\n\`\`\`\ncode\n\`\`\`\n${"Body\n".repeat(50)}`;

    const noDir = makeTempSkill("no", noPairs);
    const badDir = makeTempSkill("bad", withBAD);
    const beforeDir = makeTempSkill("before", withBEFORE);
    const doDir = makeTempSkill("do", withDO);

    const noResult = auditSkill(noDir, "no");
    const badResult = auditSkill(badDir, "bad");
    const beforeResult = auditSkill(beforeDir, "before");
    const doResult = auditSkill(doDir, "do");

    const noCheck = noResult.checks.find((c) => c.name.includes("BAD/GOOD"));
    const badCheck = badResult.checks.find((c) => c.name.includes("BAD/GOOD"));
    const beforeCheck = beforeResult.checks.find((c) => c.name.includes("BAD/GOOD"));
    const doCheck = doResult.checks.find((c) => c.name.includes("BAD/GOOD"));

    expect(noCheck?.passed).toBe(false);
    expect(badCheck?.passed).toBe(true);
    expect(beforeCheck?.passed).toBe(true);
    expect(doCheck?.passed).toBe(true);
  });

  it("detects capabilities list anti-pattern (>20 bullets, <3 code blocks)", () => {
    const goodList = `---\nname: test\ndescription: ${"A".repeat(100)}\n---\n## Heading\n${Array(10).fill("- Item\n").join("")}\`\`\`\ncode\n\`\`\`\n\`\`\`\ncode\n\`\`\`\n${"Body\n".repeat(40)}`;
    const capList = `---\nname: test\ndescription: ${"A".repeat(100)}\n---\n## Capabilities\n${Array(25).fill("- Feature\n").join("")}\`\`\`\ncode\n\`\`\`\n${"Body\n".repeat(30)}`;

    const goodDir = makeTempSkill("good", goodList);
    const capDir = makeTempSkill("cap", capList);

    const goodResult = auditSkill(goodDir, "good");
    const capResult = auditSkill(capDir, "cap");

    const goodCheck = goodResult.checks.find((c) => c.name.includes("capabilities list"));
    const capCheck = capResult.checks.find((c) => c.name.includes("capabilities list"));

    expect(goodCheck?.passed).toBe(true);
    expect(capCheck?.passed).toBe(false);
    expect(capCheck?.detail).toContain("25 bullets");
    expect(capCheck?.detail).toContain("1 code blocks");
  });

  it("returns PERFECT for well-structured skill with all checks passing", () => {
    const perfectSkill = `---
name: perfect-skill
description: This is a well-structured skill description that meets all the length requirements and provides clear information about what the skill does. It's detailed enough to be useful but not so long that it becomes unwieldy.
---

## Overview

This skill demonstrates best practices.

\`\`\`js
// Example 1
function good() {
  return true;
}
\`\`\`

## Usage Patterns

BAD example:
\`\`\`js
const x = 1;
\`\`\`

GOOD example:
\`\`\`js
const meaningfulName = 1;
\`\`\`

## Workflow

1. First step in the process
2. Second step validates input
3. Third step produces output

## Additional Details

More content here to ensure we have enough lines.
${Array(30).fill("Content line for length.\n").join("")}
`;

    const skillDir = makeTempSkill("perfect-skill", perfectSkill, ["scripts", "references"]);
    const result = auditSkill(skillDir, "perfect-skill");

    expect(result.rating).toBe("PERFECT");
    expect(result.score).toBeGreaterThanOrEqual(90);

    for (const check of result.checks) {
      expect(check.passed).toBe(true);
    }
  });

  it("checks section diversity (3+ unique headings)", () => {
    const twoHeadings = `---\nname: test\ndescription: ${"A".repeat(100)}\n---\n## First\nContent\n## Second\nContent\n${"Body\n".repeat(50)}`;
    const fourHeadings = `---\nname: test\ndescription: ${"A".repeat(100)}\n---\n## First\n## Second\n## Third\n## Fourth\n${"Body\n".repeat(50)}`;

    const twoDir = makeTempSkill("two", twoHeadings);
    const fourDir = makeTempSkill("four", fourHeadings);

    const twoResult = auditSkill(twoDir, "two");
    const fourResult = auditSkill(fourDir, "four");

    const twoCheck = twoResult.checks.find((c) => c.name.includes("Section diversity"));
    const fourCheck = fourResult.checks.find((c) => c.name.includes("Section diversity"));

    expect(twoCheck?.passed).toBe(false);
    expect(twoCheck?.detail).toBe("2 unique sections");
    expect(fourCheck?.passed).toBe(true);
    expect(fourCheck?.detail).toBe("4 unique sections");
  });

  it("checks numbered steps (3+)", () => {
    const noSteps = `---\nname: test\ndescription: ${"A".repeat(100)}\n---\n## Heading\n${"Body\n".repeat(60)}`;
    const withSteps = `---\nname: test\ndescription: ${"A".repeat(100)}\n---\n## Heading\n1. First step\n2. Second step\n3. Third step\n${"Body\n".repeat(50)}`;

    const noDir = makeTempSkill("no", noSteps);
    const stepsDir = makeTempSkill("steps", withSteps);

    const noResult = auditSkill(noDir, "no");
    const stepsResult = auditSkill(stepsDir, "steps");

    const noCheck = noResult.checks.find((c) => c.name.includes("numbered steps"));
    const stepsCheck = stepsResult.checks.find((c) => c.name.includes("numbered steps"));

    expect(noCheck?.passed).toBe(false);
    expect(noCheck?.detail).toBe("0 steps");
    expect(stepsCheck?.passed).toBe(true);
    expect(stepsCheck?.detail).toBe("3 steps");
  });

  it("checks reasonable length (50-500 lines)", () => {
    const shortSkill = `---\nname: short\ndescription: ${"A".repeat(100)}\n---\n## Heading\n\`\`\`\ncode\n\`\`\`\n\`\`\`\ncode\n\`\`\`\n${Array(10).fill("Line\n").join("")}`;
    const goodSkill = `---\nname: good\ndescription: ${"A".repeat(100)}\n---\n## Heading\n\`\`\`\ncode\n\`\`\`\n\`\`\`\ncode\n\`\`\`\n${Array(80).fill("Line\n").join("")}`;
    const longSkill = `---\nname: long\ndescription: ${"A".repeat(100)}\n---\n## Heading\n\`\`\`\ncode\n\`\`\`\n\`\`\`\ncode\n\`\`\`\n${Array(550).fill("Line\n").join("")}`;

    const shortDir = makeTempSkill("short", shortSkill);
    const goodDir = makeTempSkill("good", goodSkill);
    const longDir = makeTempSkill("long", longSkill);

    const shortResult = auditSkill(shortDir, "short");
    const goodResult = auditSkill(goodDir, "good");
    const longResult = auditSkill(longDir, "long");

    const shortCheck = shortResult.checks.find((c) => c.name.includes("Reasonable length"));
    const goodCheck = goodResult.checks.find((c) => c.name.includes("Reasonable length"));
    const longCheck = longResult.checks.find((c) => c.name.includes("Reasonable length"));

    expect(shortCheck?.passed).toBe(false);
    expect(goodCheck?.passed).toBe(true);
    expect(longCheck?.passed).toBe(false);
  });

  it("detects scripts/ and references/ directories", () => {
    const content = `---\nname: test\ndescription: ${"A".repeat(100)}\n---\n## Heading\n\`\`\`\ncode\n\`\`\`\n\`\`\`\ncode\n\`\`\`\n${Array(60).fill("Line\n").join("")}`;

    const noExtras = makeTempSkill("no-extras", content);
    const withScripts = makeTempSkill("with-scripts", content, ["scripts"]);
    const withRefs = makeTempSkill("with-refs", content, ["references"]);
    const withBoth = makeTempSkill("with-both", content, ["scripts", "references"]);

    const noResult = auditSkill(noExtras, "no-extras");
    const scriptsResult = auditSkill(withScripts, "with-scripts");
    const refsResult = auditSkill(withRefs, "with-refs");
    const bothResult = auditSkill(withBoth, "with-both");

    const noCheck = noResult.checks.find((c) => c.name.includes("scripts/ or references/"));
    const scriptsCheck = scriptsResult.checks.find((c) => c.name.includes("scripts/ or references/"));
    const refsCheck = refsResult.checks.find((c) => c.name.includes("scripts/ or references/"));
    const bothCheck = bothResult.checks.find((c) => c.name.includes("scripts/ or references/"));

    expect(noCheck?.passed).toBe(false);
    expect(noCheck?.detail).toBe("none");
    expect(scriptsCheck?.passed).toBe(true);
    expect(scriptsCheck?.detail).toBe("scripts");
    expect(refsCheck?.passed).toBe(true);
    expect(refsCheck?.detail).toBe("references");
    expect(bothCheck?.passed).toBe(true);
    expect(bothCheck?.detail).toContain("scripts");
    expect(bothCheck?.detail).toContain("references");
  });

  it("returns WEAK with 'SKILL.md readable' when readFileSync throws (line 28)", () => {
    const base = mkdtempSync(join(tmpdir(), "arcana-test-"));
    const skillDir = join(base, "unreadable");
    mkdirSync(skillDir, { recursive: true });
    const skillMd = join(skillDir, "SKILL.md");
    // Create a directory named SKILL.md so readFileSync throws EISDIR
    mkdirSync(skillMd, { recursive: true });

    const result = auditSkill(skillDir, "unreadable");

    expect(result.rating).toBe("WEAK");
    expect(result.score).toBe(0);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0]!.name).toBe("SKILL.md readable");
    expect(result.checks[0]!.passed).toBe(false);
  });
});

describe("auditCommand", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("JSON mode --all lists directories and audits each", async () => {
    const base = mkdtempSync(join(tmpdir(), "arcana-audit-"));
    const skill1Dir = join(base, "skill-one");
    const skill2Dir = join(base, "skill-two");
    mkdirSync(skill1Dir, { recursive: true });
    mkdirSync(skill2Dir, { recursive: true });
    writeFileSync(
      join(skill1Dir, "SKILL.md"),
      `---\nname: skill-one\ndescription: ${"A".repeat(100)}\n---\n## Heading\n${"Body\n".repeat(60)}`,
      "utf-8",
    );
    writeFileSync(
      join(skill2Dir, "SKILL.md"),
      `---\nname: skill-two\ndescription: ${"B".repeat(100)}\n---\n## Heading\n${"Body\n".repeat(60)}`,
      "utf-8",
    );

    const { auditCommand } = await import("./audit.js");
    await auditCommand(undefined, { all: true, json: true, source: base });

    const output = JSON.parse(consoleLogSpy.mock.calls[0]![0] as string);
    expect(output.results).toBeDefined();
    expect(output.results.length).toBe(2);
    const names = output.results.map((r: { skill: string }) => r.skill);
    expect(names).toContain("skill-one");
    expect(names).toContain("skill-two");
  });

  it("JSON mode single skill audit", async () => {
    const base = mkdtempSync(join(tmpdir(), "arcana-audit-"));
    const skillDir = join(base, "my-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      `---\nname: my-skill\ndescription: ${"A".repeat(100)}\n---\n## Heading\n${"Body\n".repeat(60)}`,
      "utf-8",
    );

    const { auditCommand } = await import("./audit.js");
    await auditCommand("my-skill", { json: true, source: base });

    const output = JSON.parse(consoleLogSpy.mock.calls[0]![0] as string);
    expect(output.results).toBeDefined();
    expect(output.results.length).toBe(1);
    expect(output.results[0].skill).toBe("my-skill");
    expect(output.results[0].rating).toBeDefined();
    expect(output.results[0].score).toBeGreaterThanOrEqual(0);
  });

  it("JSON mode no skill and no --all outputs error and exits", async () => {
    const base = mkdtempSync(join(tmpdir(), "arcana-audit-"));

    const { auditCommand } = await import("./audit.js");
    // process.exit is mocked as no-op, so execution continues past it
    // and hits skills.sort() where skills is undefined. We catch the TypeError.
    try {
      await auditCommand(undefined, { json: true, source: base });
    } catch {
      // Expected: TypeError from continued execution after mocked process.exit
    }

    const output = JSON.parse(consoleLogSpy.mock.calls[0]![0] as string);
    expect(output.error).toContain("Specify a skill name or use --all");
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("JSON mode baseDir doesn't exist returns empty results", async () => {
    const { auditCommand } = await import("./audit.js");
    await auditCommand(undefined, { json: true, all: true, source: "/nonexistent/path/abc123" });

    const output = JSON.parse(consoleLogSpy.mock.calls[0]![0] as string);
    expect(output.results).toEqual([]);
  });

  it("JSON mode single skill that doesn't exist returns WEAK with Exists check", async () => {
    const base = mkdtempSync(join(tmpdir(), "arcana-audit-"));

    const { auditCommand } = await import("./audit.js");
    await auditCommand("nonexistent-skill", { json: true, source: base });

    const output = JSON.parse(consoleLogSpy.mock.calls[0]![0] as string);
    expect(output.results.length).toBe(1);
    expect(output.results[0].rating).toBe("WEAK");
    expect(output.results[0].score).toBe(0);
    expect(output.results[0].checks[0].name).toBe("Exists");
    expect(output.results[0].checks[0].passed).toBe(false);
  });
});
