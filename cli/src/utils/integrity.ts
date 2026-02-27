import { createHash } from "node:crypto";
import { existsSync, readFileSync, mkdirSync, readdirSync, lstatSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { atomicWriteSync } from "./atomic.js";

export interface LockEntry {
  skill: string;
  version: string;
  hash: string;
  source: string;
  installedAt: string;
}

export function computeHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function getLockfilePath(): string {
  return join(homedir(), ".arcana", "arcana-lock.json");
}

export function readLockfile(): LockEntry[] {
  try {
    const raw = readFileSync(getLockfilePath(), "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function writeLockfile(entries: LockEntry[]): void {
  const lockPath = getLockfilePath();
  const dir = join(homedir(), ".arcana");
  mkdirSync(dir, { recursive: true });
  atomicWriteSync(lockPath, JSON.stringify(entries, null, 2) + "\n", 0o644);
}

export function updateLockEntry(
  skill: string,
  version: string,
  source: string,
  files: Array<{ path: string; content: string }>,
): void {
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const concatenated = sorted.map((f) => f.content).join("");
  const hash = computeHash(concatenated);

  const entries = readLockfile();
  const idx = entries.findIndex((e) => e.skill === skill);
  const entry: LockEntry = {
    skill,
    version,
    hash,
    source,
    installedAt: new Date().toISOString(),
  };

  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }

  writeLockfile(entries);
}

export function removeLockEntry(skill: string): void {
  const entries = readLockfile();
  const filtered = entries.filter((e) => e.skill !== skill);
  writeLockfile(filtered);
}

function readDirRecursive(dir: string): string[] {
  const results: string[] = [];
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = lstatSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...readDirRecursive(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

export function verifySkillIntegrity(skillName: string, installDir: string): "ok" | "modified" | "missing" {
  const entries = readLockfile();
  const entry = entries.find((e) => e.skill === skillName);
  if (!entry) return "missing";

  const skillDir = join(installDir, skillName);
  if (!existsSync(skillDir)) return "modified";

  const filePaths = readDirRecursive(skillDir);
  const relativePaths = filePaths.map((fp) => fp.slice(skillDir.length + 1)).sort();
  const concatenated = relativePaths
    .map((rel) => readFileSync(join(skillDir, rel), "utf-8"))
    .join("");
  const hash = computeHash(concatenated);

  return hash === entry.hash ? "ok" : "modified";
}
