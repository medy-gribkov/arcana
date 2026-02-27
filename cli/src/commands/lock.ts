import { readdirSync, readFileSync, existsSync, lstatSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { getInstallDir, readSkillMeta } from "../utils/fs.js";
import { readLockfile, writeLockfile, computeHash, type LockEntry } from "../utils/integrity.js";
import { renderBanner } from "../utils/help.js";
import { printErrorWithHint } from "../utils/ui.js";

function readSkillFiles(skillDir: string): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  const queue = [skillDir];
  while (queue.length > 0) {
    const dir = queue.pop()!;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = lstatSync(full);
      if (stat.isDirectory()) queue.push(full);
      else if (stat.isFile()) {
        const relPath = full.slice(skillDir.length + 1).replace(/\\/g, "/");
        files.push({ path: relPath, content: readFileSync(full, "utf-8") });
      }
    }
  }
  return files;
}

export async function lockCommand(opts: { ci?: boolean; json?: boolean }): Promise<void> {
  if (opts.ci) {
    return ciMode(opts.json);
  }
  return generateMode(opts.json);
}

async function generateMode(json?: boolean): Promise<void> {
  if (!json) {
    console.log(renderBanner());
    console.log();
    p.intro(chalk.bold("Generate lockfile"));
  }

  const installDir = getInstallDir();
  if (!existsSync(installDir)) {
    if (json) {
      console.log(JSON.stringify({ action: "generate", entries: 0, path: "~/.arcana/arcana-lock.json" }));
    } else {
      p.log.info("No skills installed. Lockfile written with 0 entries.");
    }
    writeLockfile([]);
    return;
  }

  const dirs = readdirSync(installDir).filter((d) => {
    try {
      return lstatSync(join(installDir, d)).isDirectory();
    } catch {
      return false;
    }
  });

  const entries: LockEntry[] = [];

  for (const name of dirs) {
    const skillDir = join(installDir, name);
    const files = readSkillFiles(skillDir);
    const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
    const concatenated = sorted.map((f) => f.content).join("");
    const hash = computeHash(concatenated);

    const meta = readSkillMeta(name);
    entries.push({
      skill: name,
      version: meta?.version ?? "0.0.0",
      hash,
      source: meta?.source ?? "unknown",
      installedAt: meta?.installedAt ?? new Date().toISOString(),
    });
  }

  writeLockfile(entries);

  if (json) {
    console.log(JSON.stringify({ action: "generate", entries: entries.length, path: "~/.arcana/arcana-lock.json" }));
  } else {
    p.log.success(`Lockfile written with ${entries.length} entries.`);
    p.outro(chalk.dim("~/.arcana/arcana-lock.json"));
  }
}

async function ciMode(json?: boolean): Promise<void> {
  if (!json) {
    console.log(renderBanner());
    console.log();
    p.intro(chalk.bold("Validate lockfile"));
  }

  const existing = readLockfile();
  if (existing.length === 0) {
    const lockPath = join(getInstallDir(), "..", "arcana-lock.json");
    if (!existsSync(lockPath)) {
      if (json) {
        console.log(
          JSON.stringify({
            action: "ci",
            valid: false,
            mismatches: [],
            missing: [],
            extra: [],
            error: "No lockfile found",
          }),
        );
      } else {
        printErrorWithHint(new Error("No lockfile found. Run `arcana lock` first to generate one."), true);
      }
      process.exit(1);
    }
  }

  const installDir = getInstallDir();
  const installedDirs = existsSync(installDir)
    ? readdirSync(installDir).filter((d) => {
        try {
          return lstatSync(join(installDir, d)).isDirectory();
        } catch {
          return false;
        }
      })
    : [];

  const lockedNames = new Set(existing.map((e) => e.skill));
  const installedNames = new Set(installedDirs);

  const mismatches: string[] = [];
  const missing: string[] = [];
  const extra: string[] = [];

  // Check each lockfile entry against installed state
  for (const entry of existing) {
    if (!installedNames.has(entry.skill)) {
      missing.push(entry.skill);
      continue;
    }

    const skillDir = join(installDir, entry.skill);
    const files = readSkillFiles(skillDir);
    const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
    const concatenated = sorted.map((f) => f.content).join("");
    const hash = computeHash(concatenated);

    if (hash !== entry.hash) {
      mismatches.push(entry.skill);
    }
  }

  // Check for extra skills not in lockfile
  for (const name of installedDirs) {
    if (!lockedNames.has(name)) {
      extra.push(name);
    }
  }

  const valid = mismatches.length === 0 && missing.length === 0 && extra.length === 0;

  if (json) {
    console.log(JSON.stringify({ action: "ci", valid, mismatches, missing, extra }));
  } else {
    if (valid) {
      p.log.success("Lockfile matches installed state.");
      p.outro(chalk.dim("All entries verified."));
    } else {
      if (mismatches.length > 0) {
        p.log.error(`Hash mismatch: ${mismatches.join(", ")}`);
      }
      if (missing.length > 0) {
        p.log.error(`Missing from disk: ${missing.join(", ")}`);
      }
      if (extra.length > 0) {
        p.log.warn(`Extra (not in lockfile): ${extra.join(", ")}`);
      }
      p.outro(chalk.dim("Lockfile validation failed."));
    }
  }

  if (!valid) {
    process.exit(1);
  }
}
