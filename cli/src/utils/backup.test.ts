import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Mock fs.ts to use temp dirs
const testDir = join(tmpdir(), `arcana-backup-test-${Date.now()}`);
const skillsDir = join(testDir, "skills");
const backupsDir = join(testDir, "backups");

vi.mock("./fs.js", () => ({
  getSkillDir: (name: string) => join(skillsDir, name),
  getInstallDir: () => skillsDir,
  getDirSize: () => 1024,
}));

vi.mock("node:os", async () => {
  const actual = await vi.importActual("node:os");
  return {
    ...actual,
    homedir: () => testDir,
  };
});

// Override BACKUP_DIR by re-importing after mocks
const { backupSkill, pruneOldBackups, getBackupDir } = await import("./backup.js");

describe("backup", () => {
  beforeEach(() => {
    mkdirSync(skillsDir, { recursive: true });
    mkdirSync(backupsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("returns null for non-existent skill", () => {
    expect(backupSkill("nonexistent")).toBeNull();
  });

  it("creates backup of existing skill", () => {
    const skillDir = join(skillsDir, "test-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "# Test");

    const result = backupSkill("test-skill");
    expect(result).not.toBeNull();
    expect(existsSync(result!)).toBe(true);
    expect(existsSync(join(result!, "SKILL.md"))).toBe(true);
  });

  it("creates timestamped backup directory", () => {
    const skillDir = join(skillsDir, "test-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "# Test");

    const result = backupSkill("test-skill");
    expect(result).toMatch(/test-skill_\d{4}-\d{2}-\d{2}T/);
  });

  it("prunes old backups beyond limit", () => {
    const dir = getBackupDir();
    mkdirSync(dir, { recursive: true });

    // Create 12 fake backups
    for (let i = 0; i < 12; i++) {
      const ts = `2024-01-${String(i + 1).padStart(2, "0")}T00-00-00-000Z`;
      mkdirSync(join(dir, `prune-skill_${ts}`));
    }

    pruneOldBackups("prune-skill");

    const remaining = readdirSync(dir).filter((d) => d.startsWith("prune-skill_"));
    expect(remaining.length).toBeLessThanOrEqual(10);
  });
});
