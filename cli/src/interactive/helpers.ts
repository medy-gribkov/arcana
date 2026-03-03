import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { getInstallDir, getSkillDir, getDirSize } from "../utils/fs.js";
import { clearProviderCache } from "../registry.js";

export const AMBER = chalk.hex("#d4943a");

export function cancelAndExit(): never {
  clearProviderCache();
  p.cancel("Goodbye.");
  process.exit(0);
}

export function handleCancel(value: unknown): void {
  if (p.isCancel(value)) cancelAndExit();
}

export function countInstalled(): number {
  const dir = getInstallDir();
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((d) => {
    try {
      return statSync(join(dir, d)).isDirectory();
    } catch {
      return false;
    }
  }).length;
}

export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str;
}

export function getInstalledNames(): string[] {
  const dir = getInstallDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((d) => {
      try {
        return statSync(join(dir, d)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

export function getTokenEstimate(skillName: string): { tokens: number; kb: number } {
  const dir = getSkillDir(skillName);
  if (!existsSync(dir)) return { tokens: 0, kb: 0 };
  const bytes = getDirSize(dir);
  return { tokens: Math.round(bytes / 4), kb: Math.round(bytes / 1024) };
}

export function getTotalTokenBudget(): {
  totalKB: number;
  totalTokens: number;
  count: number;
  skills: { name: string; tokens: number; kb: number }[];
} {
  const names = getInstalledNames();
  const skills = names.map((name) => {
    const est = getTokenEstimate(name);
    return { name, tokens: est.tokens, kb: est.kb };
  });
  skills.sort((a, b) => b.tokens - a.tokens);
  const totalKB = skills.reduce((sum, s) => sum + s.kb, 0);
  const totalTokens = skills.reduce((sum, s) => sum + s.tokens, 0);
  return { totalKB, totalTokens, count: names.length, skills };
}

export function buildMenuOptions(installedCount: number, _availableCount: number) {
  const isNew = installedCount === 0;
  const options: { value: string; label: string; hint?: string }[] = [];

  if (isNew) {
    options.push({
      value: "setup",
      label: AMBER("Get Started"),
      hint: "detect project, install recommended skills",
    });
  } else {
    options.push({
      value: "installed",
      label: "Your skills",
      hint: `${installedCount} installed, manage & update`,
    });
  }

  options.push({ value: "browse", label: "Browse marketplace" });
  options.push({ value: "search", label: "Search skills" });

  if (!isNew) {
    options.push({ value: "setup", label: "Get Started", hint: "detect project, add more skills" });
  }

  options.push({ value: "health", label: "Health check" });
  options.push({ value: "optimize", label: "Token budget" });
  options.push({ value: "ref", label: "CLI reference" });
  options.push({ value: "exit", label: "Exit" });

  return options;
}
