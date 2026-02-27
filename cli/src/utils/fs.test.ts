import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SkillFile, SkillMeta } from "../types.js";

let testTempDir: string | null = null;

// Mock getInstallDir to use our temp directory
vi.mock("./config.js", () => ({
  loadConfig: () => ({ installDir: testTempDir ?? "" }),
}));

// Re-import after mock setup
const { installSkill, isSkillInstalled, readSkillMeta, writeSkillMeta, getDirSize } = await import("./fs.js");

function makeTempBase(): string {
  const dir = mkdtempSync(join(tmpdir(), "arcana-test-"));
  testTempDir = dir;
  return dir;
}

beforeEach(() => {
  testTempDir = null;
});

afterEach(() => {
  if (testTempDir && existsSync(testTempDir)) {
    try {
      rmSync(testTempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
});

describe("installSkill", () => {
  it("blocks path traversal (file.path containing ../)", () => {
    makeTempBase();

    const files: SkillFile[] = [{ path: "../escape/SKILL.md", content: "Malicious content" }];

    expect(() => installSkill("test-skill", files)).toThrow("Path traversal blocked");
  });

  it("creates skill directory with correct files", () => {
    makeTempBase();

    const files: SkillFile[] = [
      { path: "SKILL.md", content: "---\nname: test\n---\nBody" },
      { path: "scripts/helper.sh", content: "#!/bin/bash\necho test" },
      { path: "references/doc.txt", content: "Documentation" },
    ];

    const skillDir = installSkill("test-skill", files);

    expect(existsSync(join(skillDir, "SKILL.md"))).toBe(true);
    expect(existsSync(join(skillDir, "scripts", "helper.sh"))).toBe(true);
    expect(existsSync(join(skillDir, "references", "doc.txt"))).toBe(true);

    const content = readFileSync(join(skillDir, "SKILL.md"), "utf-8");
    expect(content).toBe("---\nname: test\n---\nBody");
  });

  it("removes temp dir on failure", () => {
    const base = makeTempBase();

    const files: SkillFile[] = [{ path: "../invalid", content: "Bad" }];

    try {
      installSkill("test-skill", files);
    } catch {
      // Expected to fail
    }

    // Temp dirs include PID, but the key check is no leftover .installing dirs
    const entries = existsSync(base) ? require("node:fs").readdirSync(base) : [];
    const installingDirs = entries.filter((e: string) => e.includes(".installing"));
    expect(installingDirs).toHaveLength(0);
  });
});

describe("isSkillInstalled", () => {
  it("returns true when SKILL.md exists", () => {
    const base = makeTempBase();
    const skillDir = join(base, "test-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "content", "utf-8");

    const result = isSkillInstalled("test-skill");
    expect(result).toBe(true);
  });

  it("returns false when directory doesn't exist", () => {
    makeTempBase();

    const result = isSkillInstalled("nonexistent-skill");
    expect(result).toBe(false);
  });
});

describe("readSkillMeta", () => {
  it("returns null for non-existent skill", () => {
    makeTempBase();

    const result = readSkillMeta("nonexistent");
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    const base = makeTempBase();
    const skillDir = join(base, "bad-meta");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, ".arcana-meta.json"), "invalid json{", "utf-8");

    const result = readSkillMeta("bad-meta");
    expect(result).toBeNull();
  });
});

describe("writeSkillMeta and readSkillMeta", () => {
  it("roundtrip correctly", () => {
    makeTempBase();

    const meta: SkillMeta = {
      version: "1.0.0",
      installedAt: "2026-02-14T12:00:00Z",
      source: "local",
    };

    writeSkillMeta("roundtrip-skill", meta);
    const result = readSkillMeta("roundtrip-skill");

    expect(result).not.toBeNull();
    expect(result?.version).toBe(meta.version);
    expect(result?.installedAt).toBe(meta.installedAt);
    expect(result?.source).toBe(meta.source);
  });
});

describe("getDirSize", () => {
  it("calculates directory size correctly", () => {
    const base = makeTempBase();
    const testDir = join(base, "size-test");
    mkdirSync(testDir, { recursive: true });

    // Create files of known sizes
    writeFileSync(join(testDir, "file1.txt"), "a".repeat(100), "utf-8"); // 100 bytes
    writeFileSync(join(testDir, "file2.txt"), "b".repeat(200), "utf-8"); // 200 bytes

    // Create subdirectory with file
    const subDir = join(testDir, "subdir");
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(subDir, "file3.txt"), "c".repeat(50), "utf-8"); // 50 bytes

    const size = getDirSize(testDir);
    expect(size).toBe(350); // 100 + 200 + 50
  });

  it("returns 0 for empty directory", () => {
    const base = makeTempBase();
    const emptyDir = join(base, "empty");
    mkdirSync(emptyDir, { recursive: true });

    const size = getDirSize(emptyDir);
    expect(size).toBe(0);
  });

  it("handles nested directories", () => {
    const base = makeTempBase();
    const nestedDir = join(base, "nested");
    mkdirSync(join(nestedDir, "a", "b", "c"), { recursive: true });

    writeFileSync(join(nestedDir, "root.txt"), "x".repeat(10), "utf-8");
    writeFileSync(join(nestedDir, "a", "level1.txt"), "y".repeat(20), "utf-8");
    writeFileSync(join(nestedDir, "a", "b", "level2.txt"), "z".repeat(30), "utf-8");
    writeFileSync(join(nestedDir, "a", "b", "c", "level3.txt"), "w".repeat(40), "utf-8");

    const size = getDirSize(nestedDir);
    expect(size).toBe(100); // 10 + 20 + 30 + 40
  });
});
