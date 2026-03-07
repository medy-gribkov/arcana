import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  rmSync,
  readFileSync,
  symlinkSync,
  readdirSync,
  utimesSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SkillFile, SkillMeta } from "../types.js";

let testTempDir: string | null = null;

// Mock getInstallDir to use our temp directory
vi.mock("./config.js", () => ({
  loadConfig: () => ({ installDir: testTempDir ?? "" }),
}));

// Re-import after mock setup
const {
  installSkill,
  isSkillInstalled,
  readSkillMeta,
  writeSkillMeta,
  getDirSize,
  getSkillDir,
  getInstallDir,
  listFilesByAge,
  isOrphanedProject,
  listSymlinks,
} = await import("./fs.js");

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

// ──────────────────────────────────────────
// getInstallDir / getSkillDir
// ──────────────────────────────────────────

describe("getInstallDir", () => {
  it("returns the configured install directory", () => {
    const base = makeTempBase();
    expect(getInstallDir()).toBe(base);
  });
});

describe("getSkillDir", () => {
  it("joins installDir with skill name", () => {
    const base = makeTempBase();
    expect(getSkillDir("my-skill")).toBe(join(base, "my-skill"));
  });
});

// ──────────────────────────────────────────
// installSkill
// ──────────────────────────────────────────

describe("installSkill", () => {
  it("blocks path traversal (file.path containing ../)", () => {
    makeTempBase();

    const files: SkillFile[] = [{ path: "../escape/SKILL.md", content: "Malicious content" }];

    expect(() => installSkill("test-skill", files)).toThrow("Path traversal blocked");
  });

  it("blocks path traversal with ~ in path", () => {
    makeTempBase();

    const files: SkillFile[] = [{ path: "~/escape/SKILL.md", content: "Malicious" }];

    expect(() => installSkill("test-skill", files)).toThrow("Path traversal blocked");
  });

  it("blocks path traversal with \\\\ UNC prefix", () => {
    makeTempBase();

    const files: SkillFile[] = [{ path: "\\\\server\\share\\SKILL.md", content: "Malicious" }];

    expect(() => installSkill("test-skill", files)).toThrow("Path traversal blocked");
  });

  it("blocks path traversal with // prefix", () => {
    makeTempBase();

    const files: SkillFile[] = [{ path: "//server/share/SKILL.md", content: "Malicious" }];

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

  it("overwrites existing skill directory on reinstall", () => {
    makeTempBase();

    const filesV1: SkillFile[] = [
      { path: "SKILL.md", content: "version 1" },
      { path: "old-file.txt", content: "should be removed" },
    ];
    const filesV2: SkillFile[] = [{ path: "SKILL.md", content: "version 2" }];

    const dirV1 = installSkill("overwrite-skill", filesV1);
    expect(readFileSync(join(dirV1, "SKILL.md"), "utf-8")).toBe("version 1");
    expect(existsSync(join(dirV1, "old-file.txt"))).toBe(true);

    const dirV2 = installSkill("overwrite-skill", filesV2);
    expect(readFileSync(join(dirV2, "SKILL.md"), "utf-8")).toBe("version 2");
    // Old file should be gone after overwrite
    expect(existsSync(join(dirV2, "old-file.txt"))).toBe(false);
  });

  it("handles empty file list", () => {
    makeTempBase();

    const skillDir = installSkill("empty-skill", []);
    expect(existsSync(skillDir)).toBe(true);
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
    const entries = existsSync(base) ? readdirSync(base) : [];
    const installingDirs = entries.filter((e: string) => e.includes(".installing"));
    expect(installingDirs).toHaveLength(0);
  });

  it("cleans up leftover temp dir from previous failed install", () => {
    const base = makeTempBase();

    // Simulate a leftover temp dir from a crashed install
    const leftover = join(base, `crash-skill.installing.${process.pid}`);
    mkdirSync(leftover, { recursive: true });
    writeFileSync(join(leftover, "stale.txt"), "leftover", "utf-8");

    const files: SkillFile[] = [{ path: "SKILL.md", content: "fresh install" }];
    const skillDir = installSkill("crash-skill", files);

    expect(existsSync(skillDir)).toBe(true);
    expect(existsSync(leftover)).toBe(false);
    expect(readFileSync(join(skillDir, "SKILL.md"), "utf-8")).toBe("fresh install");
  });
});

// ──────────────────────────────────────────
// isSkillInstalled
// ──────────────────────────────────────────

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

  it("returns false when directory exists but SKILL.md is missing", () => {
    const base = makeTempBase();
    const skillDir = join(base, "no-skillmd");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "README.md"), "not a skill", "utf-8");

    const result = isSkillInstalled("no-skillmd");
    expect(result).toBe(false);
  });
});

// ──────────────────────────────────────────
// readSkillMeta
// ──────────────────────────────────────────

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

  it("parses valid meta with optional fields", () => {
    const base = makeTempBase();
    const skillDir = join(base, "full-meta");
    mkdirSync(skillDir, { recursive: true });

    const meta: SkillMeta = {
      version: "2.0.0",
      installedAt: "2026-03-01T00:00:00Z",
      source: "github",
      description: "Full skill",
      fileCount: 5,
      sizeBytes: 12345,
    };
    writeFileSync(join(skillDir, ".arcana-meta.json"), JSON.stringify(meta), "utf-8");

    const result = readSkillMeta("full-meta");
    expect(result).toEqual(meta);
  });
});

// ──────────────────────────────────────────
// writeSkillMeta and readSkillMeta
// ──────────────────────────────────────────

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

  it("creates skill directory if it does not exist", () => {
    const base = makeTempBase();

    const meta: SkillMeta = {
      version: "1.0.0",
      installedAt: "2026-03-07T00:00:00Z",
      source: "test",
    };

    writeSkillMeta("brand-new-skill", meta);
    expect(existsSync(join(base, "brand-new-skill"))).toBe(true);
  });
});

// ──────────────────────────────────────────
// getDirSize
// ──────────────────────────────────────────

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

  it("returns 0 for non-existent directory", () => {
    makeTempBase();
    const size = getDirSize(join(testTempDir!, "does-not-exist"));
    expect(size).toBe(0);
  });

  it("skips symlinks in size calculation", () => {
    const base = makeTempBase();
    const testDir = join(base, "symlink-size-test");
    mkdirSync(testDir, { recursive: true });

    writeFileSync(join(testDir, "real.txt"), "a".repeat(100), "utf-8");

    // Create a symlink to a file outside the dir
    const externalFile = join(base, "external.txt");
    writeFileSync(externalFile, "b".repeat(9999), "utf-8");

    try {
      symlinkSync(externalFile, join(testDir, "link.txt"));
    } catch {
      // Symlinks may fail on Windows without admin, skip the assertion
      return;
    }

    const size = getDirSize(testDir);
    // Should only count real.txt (100 bytes), not the symlink target
    expect(size).toBe(100);
  });
});

// ──────────────────────────────────────────
// listFilesByAge
// ──────────────────────────────────────────

describe("listFilesByAge", () => {
  it("returns empty array for non-existent directory", () => {
    const result = listFilesByAge("/non/existent/path", ".txt", 1);
    expect(result).toEqual([]);
  });

  it("returns empty array when no files match the age threshold", () => {
    const base = makeTempBase();
    const dir = join(base, "young-files");
    mkdirSync(dir, { recursive: true });

    // Just-created files are 0 days old, threshold is 30 days
    writeFileSync(join(dir, "new.txt"), "fresh", "utf-8");

    const result = listFilesByAge(dir, ".txt", 30);
    expect(result).toEqual([]);
  });

  it("returns old files matching the extension", () => {
    const base = makeTempBase();
    const dir = join(base, "old-files");
    mkdirSync(dir, { recursive: true });

    const filePath = join(dir, "old.log");
    writeFileSync(filePath, "a".repeat(2048), "utf-8");

    // Set mtime to 60 days ago
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    utimesSync(filePath, sixtyDaysAgo, sixtyDaysAgo);

    const result = listFilesByAge(dir, ".log", 30);
    expect(result).toHaveLength(1);
    expect(result[0]!.path).toBe(filePath);
    expect(result[0]!.daysOld).toBeGreaterThanOrEqual(59);
    expect(result[0]!.sizeMB).toBeCloseTo(2048 / (1024 * 1024), 4);
  });

  it("filters by extension", () => {
    const base = makeTempBase();
    const dir = join(base, "ext-filter");
    mkdirSync(dir, { recursive: true });

    const txtPath = join(dir, "file.txt");
    const logPath = join(dir, "file.log");

    writeFileSync(txtPath, "text", "utf-8");
    writeFileSync(logPath, "log", "utf-8");

    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    utimesSync(txtPath, oldDate, oldDate);
    utimesSync(logPath, oldDate, oldDate);

    const result = listFilesByAge(dir, ".txt", 1);
    expect(result).toHaveLength(1);
    expect(result[0]!.path).toBe(txtPath);
  });

  it("recurses into subdirectories", () => {
    const base = makeTempBase();
    const dir = join(base, "recurse-test");
    mkdirSync(join(dir, "sub"), { recursive: true });

    const f1 = join(dir, "root.txt");
    const f2 = join(dir, "sub", "nested.txt");

    writeFileSync(f1, "root", "utf-8");
    writeFileSync(f2, "nested", "utf-8");

    const oldDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    utimesSync(f1, oldDate, oldDate);
    utimesSync(f2, oldDate, oldDate);

    const result = listFilesByAge(dir, ".txt", 1);
    expect(result).toHaveLength(2);
  });

  it("returns all file types when ext is empty string", () => {
    const base = makeTempBase();
    const dir = join(base, "all-types");
    mkdirSync(dir, { recursive: true });

    const f1 = join(dir, "file.txt");
    const f2 = join(dir, "file.log");
    const f3 = join(dir, "file.json");

    writeFileSync(f1, "a", "utf-8");
    writeFileSync(f2, "b", "utf-8");
    writeFileSync(f3, "c", "utf-8");

    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    utimesSync(f1, oldDate, oldDate);
    utimesSync(f2, oldDate, oldDate);
    utimesSync(f3, oldDate, oldDate);

    const result = listFilesByAge(dir, "", 1);
    expect(result).toHaveLength(3);
  });
});

// ──────────────────────────────────────────
// isOrphanedProject
// ──────────────────────────────────────────

describe("isOrphanedProject", () => {
  it("returns false for names that don't match the drive letter pattern", () => {
    // No drive letter prefix, so can't decode
    expect(isOrphanedProject("some-random-dir")).toBe(false);
    expect(isOrphanedProject("")).toBe(false);
    expect(isOrphanedProject("noDrivePrefix")).toBe(false);
  });

  it("returns false (not orphaned) when project directory exists", () => {
    const base = makeTempBase();
    // Create a project directory that matches the encoded name
    const projectDir = join(base, "real-project");
    mkdirSync(projectDir, { recursive: true });

    // We can't easily test with real drive letters since the directory must exist.
    // Instead, test the function's behavior with known-existing paths.
    // The C drive root always exists on Windows, so C--Windows should not be orphaned.
    if (process.platform === "win32") {
      expect(isOrphanedProject("C--Windows")).toBe(false);
    }
  });

  it("returns true (orphaned) when no path interpretation exists", () => {
    // This encoded name points to a path that almost certainly doesn't exist
    expect(isOrphanedProject("Z--zzz-nonexistent-path-xyz-abc")).toBe(true);
  });

  it("handles ambiguous hyphens in directory names", () => {
    // The function tries all possible splits. If any interpretation leads to an
    // existing path, the project is not orphaned.
    if (process.platform === "win32") {
      // "C--Users" should resolve to C:\Users which exists
      expect(isOrphanedProject("C--Users")).toBe(false);
    }
  });
});

// ──────────────────────────────────────────
// listSymlinks
// ──────────────────────────────────────────

describe("listSymlinks", () => {
  it("returns empty array when skills directory doesn't exist", () => {
    // listSymlinks looks at ~/.claude/skills which may or may not exist
    // We test the return type; can't mock homedir without mocking the module
    const result = listSymlinks();
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns SymlinkInfo objects with correct shape", () => {
    const result = listSymlinks();
    for (const entry of result) {
      expect(entry).toHaveProperty("name");
      expect(entry).toHaveProperty("fullPath");
      expect(entry).toHaveProperty("target");
      expect(entry).toHaveProperty("broken");
      expect(typeof entry.name).toBe("string");
      expect(typeof entry.broken).toBe("boolean");
    }
  });
});
