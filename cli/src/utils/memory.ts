import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { atomicWriteSync } from "./atomic.js";
import { randomBytes } from "node:crypto";

export interface Memory {
  id: string;
  content: string;
  tags: string[];
  project?: string;
  created: string;
}

const MAX_MEMORIES = 200;

function memoriesPath(): string {
  return join(homedir(), ".arcana", "memories.json");
}

function readMemories(): Memory[] {
  const p = memoriesPath();
  if (!existsSync(p)) return [];
  try {
    const data = JSON.parse(readFileSync(p, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeMemories(memories: Memory[]): void {
  const dir = join(homedir(), ".arcana");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  atomicWriteSync(memoriesPath(), JSON.stringify(memories, null, 2));
}

function generateId(): string {
  return randomBytes(4).toString("hex");
}

/** Add a memory. Extracts tags from content if not provided. */
export function addMemory(content: string, opts?: { tags?: string[]; project?: string }): Memory {
  const memories = readMemories();

  const tags = opts?.tags ?? [];
  // Auto-extract simple tags from content if none provided
  if (tags.length === 0) {
    const words = content.toLowerCase().split(/\s+/);
    const keywords = words.filter(
      (w) =>
        w.length > 3 &&
        !["always", "never", "should", "this", "that", "with", "from", "have", "will", "when", "then", "than"].includes(
          w,
        ),
    );
    tags.push(...keywords.slice(0, 3));
  }

  const project = opts?.project ?? basename(process.cwd());

  const memory: Memory = {
    id: generateId(),
    content,
    tags,
    project,
    created: new Date().toISOString(),
  };

  memories.push(memory);
  // Cap at max
  while (memories.length > MAX_MEMORIES) memories.shift();

  writeMemories(memories);
  return memory;
}

/** Search memories by query (substring + tag match). */
export function searchMemories(query: string, opts?: { project?: string }): Memory[] {
  const memories = readMemories();
  const q = query.toLowerCase();

  return memories
    .filter((m) => {
      // Project filter
      if (opts?.project && m.project !== opts.project) return false;
      // Content match
      if (m.content.toLowerCase().includes(q)) return true;
      // Tag match
      if (m.tags.some((t) => t.toLowerCase().includes(q))) return true;
      return false;
    })
    .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
}

/** List all memories, optionally filtered by project. */
export function listMemories(opts?: { project?: string; limit?: number }): Memory[] {
  const memories = readMemories();
  let filtered = memories;
  if (opts?.project) {
    filtered = filtered.filter((m) => m.project === opts.project);
  }
  filtered.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  if (opts?.limit) {
    filtered = filtered.slice(0, opts.limit);
  }
  return filtered;
}

/** Remove a memory by ID. */
export function removeMemory(id: string): boolean {
  const memories = readMemories();
  const idx = memories.findIndex((m) => m.id === id);
  if (idx === -1) return false;
  memories.splice(idx, 1);
  writeMemories(memories);
  return true;
}

/** Get memories relevant to the current project for injection into _active.md */
export function getProjectMemories(project?: string): Memory[] {
  const proj = project ?? basename(process.cwd());
  return listMemories({ project: proj, limit: 10 });
}
