import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, copyFileSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { atomicWriteSync } from "../utils/atomic.js";

export interface SnapshotMeta {
  name: string;
  source: string;
  project: string;
  created: string;
  sizeBytes: number;
  messageCount: number;
}

function snapshotDir(): string {
  return join(homedir(), ".arcana", "snapshots");
}

function metaPath(): string {
  return join(snapshotDir(), "snapshots.json");
}

function readSnapshotMetas(): SnapshotMeta[] {
  const p = metaPath();
  if (!existsSync(p)) return [];
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as SnapshotMeta[];
  } catch {
    return [];
  }
}

function writeSnapshotMetas(metas: SnapshotMeta[]): void {
  const dir = snapshotDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  atomicWriteSync(metaPath(), JSON.stringify(metas, null, 2));
}

/** Find the most recent session JSONL for the current project. */
export function findLatestSession(cwd: string): string | null {
  const projectsDir = join(homedir(), ".claude", "projects");
  if (!existsSync(projectsDir)) return null;

  // Encode the project path the way Claude Code does
  const encoded = cwd.replace(/[:/\\]/g, "-").replace(/^-+/, "");
  const variants = [encoded, encoded.toLowerCase()];

  for (const variant of variants) {
    const projDir = join(projectsDir, variant);
    if (!existsSync(projDir)) continue;

    // Find newest .jsonl file
    let newest: { path: string; mtime: number } | null = null;
    try {
      for (const file of readdirSync(projDir)) {
        if (!file.endsWith(".jsonl")) continue;
        const fullPath = join(projDir, file);
        const stat = statSync(fullPath);
        if (!newest || stat.mtimeMs > newest.mtime) {
          newest = { path: fullPath, mtime: stat.mtimeMs };
        }
      }
    } catch {
      continue;
    }
    if (newest) return newest.path;
  }

  return null;
}

/** Count messages in a JSONL file. */
function countMessages(filePath: string): number {
  try {
    const content = readFileSync(filePath, "utf-8");
    return content.split("\n").filter((l) => l.trim().length > 0).length;
  } catch {
    return 0;
  }
}

/** Create a snapshot of the current session. */
export function createSnapshot(name: string, cwd: string): SnapshotMeta | null {
  const sessionPath = findLatestSession(cwd);
  if (!sessionPath) return null;

  const dir = snapshotDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const safeName = name.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const destFile = join(dir, `${safeName}.jsonl`);

  copyFileSync(sessionPath, destFile);

  const stat = statSync(destFile);
  const meta: SnapshotMeta = {
    name: safeName,
    source: sessionPath,
    project: basename(cwd),
    created: new Date().toISOString(),
    sizeBytes: stat.size,
    messageCount: countMessages(destFile),
  };

  const metas = readSnapshotMetas();
  // Replace if same name exists
  const idx = metas.findIndex((m) => m.name === safeName);
  if (idx >= 0) metas[idx] = meta;
  else metas.push(meta);
  writeSnapshotMetas(metas);

  return meta;
}

/** List all snapshots. */
export function listSnapshots(): SnapshotMeta[] {
  return readSnapshotMetas().sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
}

/** Get snapshot info by name. */
export function getSnapshot(name: string): SnapshotMeta | null {
  return readSnapshotMetas().find((m) => m.name === name) ?? null;
}

/** Delete a snapshot. */
export function deleteSnapshot(name: string): boolean {
  const metas = readSnapshotMetas();
  const idx = metas.findIndex((m) => m.name === name);
  if (idx === -1) return false;

  const filePath = join(snapshotDir(), `${name}.jsonl`);
  try {
    const { rmSync } = require("node:fs") as typeof import("node:fs");
    if (existsSync(filePath)) rmSync(filePath);
  } catch { /* best effort */ }

  metas.splice(idx, 1);
  writeSnapshotMetas(metas);
  return true;
}
