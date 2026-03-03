import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  extractFrontmatter,
  parseFrontmatter,
  fixSkillFrontmatter,
  validateSkillDir,
  NAME_REGEX,
  MIN_DESC_LENGTH,
} from "./frontmatter.js";

function makeTempSkill(name: string, content: string): string {
  const base = mkdtempSync(join(tmpdir(), "arcana-test-"));
  const skillDir = join(base, name);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), content, "utf-8");
  return skillDir;
}

describe("NAME_REGEX", () => {
  it("accepts valid names", () => {
    expect(NAME_REGEX.test("a")).toBe(true);
    expect(NAME_REGEX.test("foo-bar")).toBe(true);
    expect(NAME_REGEX.test("a1-b2")).toBe(true);
    expect(NAME_REGEX.test("my-skill-123")).toBe(true);
  });

  it("rejects invalid names", () => {
    expect(NAME_REGEX.test("Foo")).toBe(false);
    expect(NAME_REGEX.test("-bar")).toBe(false);
    expect(NAME_REGEX.test("foo_bar")).toBe(false);
    expect(NAME_REGEX.test("1abc")).toBe(false);
    expect(NAME_REGEX.test("")).toBe(false);
    expect(NAME_REGEX.test("FOO")).toBe(false);
  });
});

describe("extractFrontmatter", () => {
  it("extracts valid frontmatter", () => {
    const content = "---\nname: test\ndescription: hello\n---\n# Body";
    const result = extractFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.raw).toBe("name: test\ndescription: hello");
    expect(result!.body).toBe("# Body");
  });

  it("returns null for missing opening delimiter", () => {
    expect(extractFrontmatter("name: test\n---\n# Body")).toBeNull();
  });

  it("returns null for missing closing delimiter", () => {
    expect(extractFrontmatter("---\nname: test\n# Body")).toBeNull();
  });

  it("returns null for empty content", () => {
    expect(extractFrontmatter("")).toBeNull();
  });

  it("handles empty frontmatter block", () => {
    const result = extractFrontmatter("---\n---\nBody");
    expect(result).not.toBeNull();
    expect(result!.raw).toBe("");
    expect(result!.body).toBe("Body");
  });
});

describe("parseFrontmatter", () => {
  it("parses name and description", () => {
    const result = parseFrontmatter("name: my-skill\ndescription: A useful skill");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("my-skill");
    expect(result!.description).toBe("A useful skill");
  });

  it("strips quotes from name", () => {
    const result = parseFrontmatter('name: "my-skill"\ndescription: test');
    expect(result).not.toBeNull();
    expect(result!.name).toBe("my-skill");
  });

  it("handles YAML | multiline description", () => {
    const raw = "name: test\ndescription: |\n  Line one\n  Line two";
    const result = parseFrontmatter(raw);
    expect(result).not.toBeNull();
    expect(result!.description).toBe("Line one\nLine two");
  });

  it("handles YAML > folded description", () => {
    const raw = "name: test\ndescription: >\n  Line one\n  Line two";
    const result = parseFrontmatter(raw);
    expect(result).not.toBeNull();
    expect(result!.description).toBe("Line one Line two");
  });

  it("handles bare indented continuation", () => {
    const raw = "name: test\ndescription:\n  Use this skill to do something great and wonderful";
    const result = parseFrontmatter(raw);
    expect(result).not.toBeNull();
    expect(result!.description).toBe("Use this skill to do something great and wonderful");
  });

  it("strips quotes from description", () => {
    const result = parseFrontmatter('name: test\ndescription: "A quoted desc"');
    expect(result).not.toBeNull();
    expect(result!.description).toBe("A quoted desc");
  });

  it("returns null for invalid name", () => {
    expect(parseFrontmatter("name: INVALID\ndescription: test")).toBeNull();
    expect(parseFrontmatter("name: -bad\ndescription: test")).toBeNull();
  });

  it("returns null when name is missing", () => {
    expect(parseFrontmatter("description: test")).toBeNull();
  });
});

describe("fixSkillFrontmatter", () => {
  it("rebuilds clean frontmatter", () => {
    const content = "---\nname: test\ndescription: hello\nextra: field\n---\n# Body";
    const fixed = fixSkillFrontmatter(content);
    expect(fixed).toContain("name: test");
    expect(fixed).toContain("description: hello");
    expect(fixed).not.toContain("extra: field");
  });

  it("preserves body content", () => {
    const content = "---\nname: test\ndescription: hello\n---\n# My Body\nContent here";
    const fixed = fixSkillFrontmatter(content);
    expect(fixed).toContain("# My Body");
    expect(fixed).toContain("Content here");
  });

  it("returns original when no frontmatter", () => {
    const content = "No frontmatter here";
    expect(fixSkillFrontmatter(content)).toBe(content);
  });

  it("returns original when name cannot be parsed", () => {
    const content = "---\ndescription: no name\n---\nBody";
    expect(fixSkillFrontmatter(content)).toBe(content);
  });
});

describe("validateSkillDir", () => {
  const longDesc = "A".repeat(MIN_DESC_LENGTH);

  it("returns error for missing SKILL.md", () => {
    const dir = mkdtempSync(join(tmpdir(), "arcana-test-"));
    const result = validateSkillDir(dir, "test");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing SKILL.md");
  });

  it("returns warning for short description", () => {
    const dir = makeTempSkill(
      "short-desc",
      "---\nname: short-desc\ndescription: Too short\n---\n# Body content goes here, needs at least 50 chars in the body section",
    );
    const result = validateSkillDir(dir, "short-desc");
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("too short"))).toBe(true);
  });

  it("returns warning for name mismatch", () => {
    const dir = makeTempSkill(
      "wrong-name",
      `---\nname: other-name\ndescription: ${longDesc}\n---\n## Heading\nBody content goes here, needs at least 50 chars in the body section`,
    );
    const result = validateSkillDir(dir, "wrong-name");
    expect(result.warnings.some((w) => w.includes("mismatch"))).toBe(true);
  });

  it("passes valid skill with no warnings", () => {
    const dir = makeTempSkill(
      "valid-skill",
      `---\nname: valid-skill\ndescription: ${longDesc}\n---\n## Heading\nBody content goes here, needs at least 50 chars in the body section`,
    );
    const result = validateSkillDir(dir, "valid-skill");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("returns error for malformed frontmatter", () => {
    const dir = makeTempSkill("bad-fm", "no frontmatter here");
    const result = validateSkillDir(dir, "bad-fm");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("frontmatter"))).toBe(true);
  });
});
