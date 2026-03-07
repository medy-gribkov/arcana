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

  it("handles YAML |- chomp indicator", () => {
    const raw = "name: test\ndescription: |-\n  Line one\n  Line two";
    const result = parseFrontmatter(raw);
    expect(result).not.toBeNull();
    // |- is not "|", so multiline lines join with space
    expect(result!.description).toBe("Line one Line two");
  });

  it("handles YAML >- chomp indicator", () => {
    const raw = "name: test\ndescription: >-\n  Line one\n  Line two";
    const result = parseFrontmatter(raw);
    expect(result).not.toBeNull();
    expect(result!.description).toBe("Line one Line two");
  });

  it("handles YAML >+ keep indicator", () => {
    const raw = "name: test\ndescription: >+\n  Line one\n  Line two";
    const result = parseFrontmatter(raw);
    expect(result).not.toBeNull();
    expect(result!.description).toBe("Line one Line two");
  });

  it("handles YAML |+ keep indicator", () => {
    const raw = "name: test\ndescription: |+\n  Line one\n  Line two";
    const result = parseFrontmatter(raw);
    expect(result).not.toBeNull();
    expect(result!.description).toBe("Line one Line two");
  });

  it("handles empty continuation lines in multiline", () => {
    const raw = "name: test\ndescription: |\n  First paragraph\n\n  Second paragraph";
    const result = parseFrontmatter(raw);
    expect(result).not.toBeNull();
    expect(result!.description).toBe("First paragraph\n\nSecond paragraph");
  });

  it("returns empty description for empty multiline block", () => {
    const raw = "name: test\ndescription: |\nnext-field: value";
    const result = parseFrontmatter(raw);
    expect(result).not.toBeNull();
    // No continuation lines, so description stays empty
    expect(result!.description).toBe("");
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

  it("returns error for short description", () => {
    const dir = makeTempSkill(
      "short-desc",
      "---\nname: short-desc\ndescription: Too short\n---\n# Body content goes here, needs at least 50 chars in the body section",
    );
    const result = validateSkillDir(dir, "short-desc");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("too short"))).toBe(true);
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
      `---\nname: valid-skill\ndescription: ${longDesc}\n---\n## Heading\nBody content goes here, needs at least 50 chars in the body section\n\n\`\`\`js\nconst x = 1;\n\`\`\``,
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

  it("warns about metadata field", () => {
    const dir = makeTempSkill(
      "meta-skill",
      `---\nname: meta-skill\ndescription: ${longDesc}\nmetadata: some-value\n---\n## Heading\nBody content goes here, needs at least 50 chars in the body section\n\n\`\`\`js\nconst x = 1;\n\`\`\``,
    );
    const result = validateSkillDir(dir, "meta-skill");
    expect(result.warnings.some((w) => w.includes("metadata"))).toBe(true);
  });

  it("reports non-standard field as info", () => {
    const dir = makeTempSkill(
      "unknown-field",
      `---\nname: unknown-field\ndescription: ${longDesc}\nunknown-field: value\n---\n## Heading\nBody content goes here, needs at least 50 chars in the body section\n\n\`\`\`js\nconst x = 1;\n\`\`\``,
    );
    const result = validateSkillDir(dir, "unknown-field");
    expect(result.infos.some((i) => i.includes("Non-standard field"))).toBe(true);
    expect(result.infos.some((i) => i.includes("unknown-field"))).toBe(true);
  });

  it("reports valid optional fields as info", () => {
    const dir = makeTempSkill(
      "license-skill",
      `---\nname: license-skill\ndescription: ${longDesc}\nlicense: MIT\n---\n## Heading\nBody content goes here, needs at least 50 chars in the body section\n\n\`\`\`js\nconst x = 1;\n\`\`\``,
    );
    const result = validateSkillDir(dir, "license-skill");
    expect(result.infos.some((i) => i.includes("Optional field"))).toBe(true);
  });

  it("warns about description starting with quote", () => {
    // Use multiline syntax so the description isn't quote-stripped by parseFrontmatter
    const quotedLine = '"' + "A".repeat(MIN_DESC_LENGTH);
    const content = [
      "---",
      "name: quoted-desc",
      "description: >",
      `  ${quotedLine}`,
      "---",
      "## Heading",
      "Body content goes here, needs at least 50 chars in the body section",
      "",
      "```js",
      "const x = 1;",
      "```",
    ].join("\n");
    const dir = makeTempSkill("quoted-desc", content);
    const result = validateSkillDir(dir, "quoted-desc");
    expect(result.warnings.some((w) => w.includes("quote character"))).toBe(true);
  });

  it("warns when body is very short", () => {
    const dir = makeTempSkill(
      "short-body",
      `---\nname: short-body\ndescription: ${longDesc}\n---\nShort`,
    );
    const result = validateSkillDir(dir, "short-body");
    expect(result.warnings.some((w) => w.includes("very short"))).toBe(true);
  });

  it("warns when body has no headings", () => {
    const bodyContent = "This is a long body without any headings at all, just plain text that goes on for more than fifty characters easily.";
    const dir = makeTempSkill(
      "no-headings",
      `---\nname: no-headings\ndescription: ${longDesc}\n---\n${bodyContent}`,
    );
    const result = validateSkillDir(dir, "no-headings");
    expect(result.warnings.some((w) => w.includes("no ## headings"))).toBe(true);
  });

  it("warns when body has no code blocks", () => {
    const bodyContent = "## Heading\nThis is a long body with a heading but no code blocks at all, just plain text content filling space.";
    const dir = makeTempSkill(
      "no-code",
      `---\nname: no-code\ndescription: ${longDesc}\n---\n${bodyContent}`,
    );
    const result = validateSkillDir(dir, "no-code");
    expect(result.warnings.some((w) => w.includes("No code blocks"))).toBe(true);
  });

  it("reports missing BAD/GOOD patterns as info", () => {
    const bodyContent = "## Heading\nThis is a long body that has a heading and code blocks but no contrast patterns anywhere at all in the entire content.\n\n```js\nconst x = 1;\n```";
    const dir = makeTempSkill(
      "no-patterns",
      `---\nname: no-patterns\ndescription: ${longDesc}\n---\n${bodyContent}`,
    );
    const result = validateSkillDir(dir, "no-patterns");
    expect(result.infos.some((i) => i.includes("BAD/GOOD"))).toBe(true);
  });

  it("does not report BAD/GOOD info when patterns present", () => {
    const bodyContent = "## Heading\nThis is a long body that has a heading and code blocks and also has BAD and GOOD pattern examples throughout.\n\n```js\nconst x = 1;\n```";
    const dir = makeTempSkill(
      "has-patterns",
      `---\nname: has-patterns\ndescription: ${longDesc}\n---\n${bodyContent}`,
    );
    const result = validateSkillDir(dir, "has-patterns");
    expect(result.infos.some((i) => i.includes("BAD/GOOD"))).toBe(false);
  });

  it("returns error when description too long", () => {
    const tooLongDesc = "A".repeat(1025);
    const dir = makeTempSkill(
      "long-desc",
      `---\nname: long-desc\ndescription: ${tooLongDesc}\n---\n## Heading\nBody content goes here, needs at least 50 chars in the body section\n\n\`\`\`js\nconst x = 1;\n\`\`\``,
    );
    const result = validateSkillDir(dir, "long-desc");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("too long"))).toBe(true);
  });
});
