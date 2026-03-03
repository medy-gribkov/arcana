import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { atomicWriteSync } from "./atomic.js";

const MAX_ENTRIES = 50;

export interface HistoryEntry {
  action: string;
  target?: string;
  timestamp: string;
}

function historyPath(): string {
  return join(homedir(), ".arcana", "history.json");
}

export function readHistory(): HistoryEntry[] {
  const p = historyPath();
  if (!existsSync(p)) return [];
  try {
    const data = JSON.parse(readFileSync(p, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function appendHistory(action: string, target?: string): void {
  const entries = readHistory();
  entries.push({ action, target, timestamp: new Date().toISOString() });
  while (entries.length > MAX_ENTRIES) entries.shift();
  const dir = join(homedir(), ".arcana");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  try {
    atomicWriteSync(historyPath(), JSON.stringify(entries, null, 2));
  } catch {
    // Best effort
  }
}

export function clearHistory(): void {
  const dir = join(homedir(), ".arcana");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  try {
    atomicWriteSync(historyPath(), "[]");
  } catch {
    // Best effort
  }
}

export function getRecentSkills(limit = 5): string[] {
  const entries = readHistory();
  const skills: string[] = [];
  for (let i = entries.length - 1; i >= 0 && skills.length < limit; i--) {
    const e = entries[i]!;
    if (e.target && (e.action === "install" || e.action === "search") && !skills.includes(e.target)) {
      skills.push(e.target);
    }
  }
  return skills;
}
