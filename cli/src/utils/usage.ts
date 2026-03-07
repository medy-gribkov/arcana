import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { atomicWriteSync } from "./atomic.js";

export interface SkillUsage {
  loads: number;
  curations: number;
  lastUsed: string;
  firstUsed: string;
  projects: string[];
}

function usagePath(): string {
  return join(homedir(), ".arcana", "usage.json");
}

function readUsage(): Record<string, SkillUsage> {
  const p = usagePath();
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as Record<string, SkillUsage>;
  } catch {
    return {};
  }
}

function writeUsage(data: Record<string, SkillUsage>): void {
  const dir = join(homedir(), ".arcana");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  atomicWriteSync(usagePath(), JSON.stringify(data, null, 2));
}

function ensureEntry(data: Record<string, SkillUsage>, skillName: string): SkillUsage {
  if (!data[skillName]) {
    data[skillName] = {
      loads: 0,
      curations: 0,
      lastUsed: new Date().toISOString(),
      firstUsed: new Date().toISOString(),
      projects: [],
    };
  }
  return data[skillName]!;
}

/** Record a skill load event. */
export function recordLoad(skillName: string, project?: string): void {
  const data = readUsage();
  const entry = ensureEntry(data, skillName);
  entry.loads++;
  entry.lastUsed = new Date().toISOString();
  if (project && !entry.projects.includes(project)) {
    entry.projects.push(project);
  }
  writeUsage(data);
}

/** Record a skill curation event. */
export function recordCuration(skillName: string): void {
  const data = readUsage();
  const entry = ensureEntry(data, skillName);
  entry.curations++;
  entry.lastUsed = new Date().toISOString();
  writeUsage(data);
}

/** Get usage data for all skills. */
export function getAllUsage(): Record<string, SkillUsage> {
  return readUsage();
}

/** Get skills not used in the last N days. */
export function getUnusedSkills(days: number): string[] {
  const data = readUsage();
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return Object.entries(data)
    .filter(([, u]) => new Date(u.lastUsed).getTime() < threshold)
    .map(([name]) => name);
}

/** Get usage boost score for a skill (for curation ranking). */
export function getUsageBoost(skillName: string): number {
  const data = readUsage();
  const entry = data[skillName];
  if (!entry) return 0;

  const daysSinceUse = (Date.now() - new Date(entry.lastUsed).getTime()) / (24 * 60 * 60 * 1000);
  // Boost recently used skills, decay over 14 days
  if (daysSinceUse < 1) return 15;
  if (daysSinceUse < 7) return 10;
  if (daysSinceUse < 14) return 5;
  return 0;
}
