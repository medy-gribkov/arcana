import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { ui, banner } from "../utils/ui.js";
import { getDirSize, listSymlinks, isOrphanedProject } from "../utils/fs.js";
import { clearHistory } from "../utils/history.js";

interface CleanResult {
  dryRun: boolean;
  actions: number;
  reclaimedBytes: number;
  removedSymlinks: string[];
  removedProjects: { name: string; sizeMB: string; reason: string }[];
  removedCacheFiles: string[];
  removedSessionLogs: { project: string; file: string; sizeMB: string; daysOld: number; reason: string }[];
  purgedDirs: { name: string; sizeMB: string }[];
  failedSymlinks?: string[];
}

import { STALE_PROJECT_DAYS, AGENT_LOG_MAX_AGE_DAYS, MAIN_LOG_MAX_AGE_DAYS } from "../constants.js";

const AUXILIARY_DIRS = ["file-history", "debug", "shell-snapshots", "todos", "plans"] as const;

function purgeDir(dir: string, dryRun: boolean): number {
  if (!existsSync(dir)) return 0;
  let reclaimed = 0;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    try {
      const stat = statSync(full);
      reclaimed += stat.isDirectory() ? getDirSize(full) : stat.size;
      if (!dryRun) rmSync(full, { recursive: true, force: true });
    } catch {
      /* skip locked files */
    }
  }
  return reclaimed;
}

function isAgentLog(filename: string): boolean {
  return filename.startsWith("agent-") && filename.endsWith(".jsonl");
}

export async function cleanCommand(opts: {
  dryRun?: boolean;
  aggressive?: boolean;
  keepDays?: number;
  json?: boolean;
}): Promise<void> {
  if (!opts.json) banner();

  const dryRun = opts.dryRun ?? false;
  const aggressive = opts.aggressive ?? false;
  const keepDays = opts.keepDays ?? MAIN_LOG_MAX_AGE_DAYS;
  const agentKeepDays = aggressive ? 0 : AGENT_LOG_MAX_AGE_DAYS;
  const mainKeepDays = aggressive ? 0 : keepDays;

  if (dryRun && !opts.json) console.log(ui.warn("  DRY RUN - no files will be deleted\n"));
  if (aggressive && !opts.json) console.log(ui.warn("  AGGRESSIVE MODE - all session logs will be targeted\n"));

  const result: CleanResult = {
    dryRun,
    actions: 0,
    reclaimedBytes: 0,
    removedSymlinks: [],
    removedProjects: [],
    removedCacheFiles: [],
    removedSessionLogs: [],
    purgedDirs: [],
  };

  // 1. Clean broken symlinks
  const failedSymlinks: string[] = [];
  if (!opts.json) console.log(ui.bold("  Symlinks"));
  for (const link of listSymlinks().filter((s) => s.broken)) {
    if (!dryRun) {
      try {
        rmSync(link.fullPath);
      } catch (err) {
        if (!opts.json)
          console.log(
            `  ${ui.warn("  Could not remove:")} ${link.name} ${ui.dim(`(${err instanceof Error ? err.message : "unknown"})`)}`,
          );
        failedSymlinks.push(link.name);
        continue;
      }
    }
    if (!opts.json) console.log(`  ${ui.dim("  Remove broken:")} ${link.name}`);
    result.removedSymlinks.push(link.name);
    result.actions++;
  }
  if (result.removedSymlinks.length === 0 && !opts.json) console.log(ui.dim("    No broken symlinks"));

  // 2. Clean orphaned + stale project dirs
  if (!opts.json) console.log(ui.bold("\n  Project Data"));
  const projectsDir = join(homedir(), ".claude", "projects");
  if (existsSync(projectsDir)) {
    for (const entry of readdirSync(projectsDir)) {
      const projDir = join(projectsDir, entry);
      if (!statSync(projDir).isDirectory()) continue;
      if (entry === "memory" || entry.startsWith(".")) continue;

      const orphaned = isOrphanedProject(entry);

      let newest = 0;
      try {
        for (const file of readdirSync(projDir)) {
          const stat = statSync(join(projDir, file));
          if (stat.mtimeMs > newest) newest = stat.mtimeMs;
        }
      } catch {
        continue;
      }

      const daysOld = (Date.now() - newest) / (1000 * 60 * 60 * 24);
      const shouldRemove = orphaned || daysOld > STALE_PROJECT_DAYS;

      if (shouldRemove) {
        const size = getDirSize(projDir);
        result.reclaimedBytes += size;
        const mb = (size / (1024 * 1024)).toFixed(1);
        const reason = orphaned ? "orphaned (source deleted)" : `stale (${Math.floor(daysOld)}d old)`;
        if (!dryRun) rmSync(projDir, { recursive: true, force: true });
        if (!opts.json) console.log(`    ${ui.dim("Remove:")} ${entry} ${ui.dim(`(${mb} MB, ${reason})`)}`);
        result.removedProjects.push({ name: entry, sizeMB: mb, reason });
        result.actions++;
      }
    }
  }
  if (result.removedProjects.length === 0 && !opts.json) console.log(ui.dim("    No orphaned or stale projects"));

  // 3. Tiered session log cleanup
  // - Agent logs (agent-*.jsonl): delete after 7 days (never resumed, bulk of bloat)
  // - Main sessions (UUID.jsonl): delete after 30 days (configurable with --keep-days)
  // - Aggressive mode: delete everything regardless of age
  if (!opts.json) {
    console.log(ui.bold("\n  Session Logs"));
    if (!aggressive) {
      console.log(ui.dim(`    Agent logs: remove >${agentKeepDays}d | Main sessions: remove >${mainKeepDays}d`));
    }
  }

  let logCount = 0;
  if (existsSync(projectsDir)) {
    const now = Date.now();
    for (const entry of readdirSync(projectsDir)) {
      const projDir = join(projectsDir, entry);
      if (!statSync(projDir).isDirectory()) continue;
      if (entry === "memory" || entry.startsWith(".")) continue;

      // Scan all files in project dir (not recursive, JSONL files are at top level)
      for (const file of readdirSync(projDir)) {
        if (!file.endsWith(".jsonl")) continue;
        const fullPath = join(projDir, file);
        let stat;
        try {
          stat = statSync(fullPath);
        } catch {
          continue;
        }

        const daysOld = (now - stat.mtimeMs) / (1000 * 60 * 60 * 24);
        const isAgent = isAgentLog(file);
        const maxAge = isAgent ? agentKeepDays : mainKeepDays;

        if (daysOld > maxAge) {
          const sizeMB = stat.size / (1024 * 1024);
          result.reclaimedBytes += stat.size;
          if (!dryRun) {
            try {
              rmSync(fullPath, { force: true });
            } catch {
              continue;
            }
          }
          const reason = isAgent ? "agent log" : "main session";
          if (!opts.json)
            console.log(
              `    ${ui.dim("Remove:")} ${entry}/${file} ${ui.dim(`(${sizeMB.toFixed(1)} MB, ${Math.floor(daysOld)}d, ${reason})`)}`,
            );
          result.removedSessionLogs.push({
            project: entry,
            file,
            sizeMB: sizeMB.toFixed(1),
            daysOld: Math.floor(daysOld),
            reason,
          });
          logCount++;
          result.actions++;
        }
      }

      // Also clean agent subdirectories (UUID dirs containing agent subfiles)
      for (const sub of readdirSync(projDir)) {
        const subPath = join(projDir, sub);
        try {
          if (!statSync(subPath).isDirectory()) continue;
          if (sub === "memory") continue;
          // Check if directory is old enough
          const stat = statSync(subPath);
          const daysOld = (now - stat.mtimeMs) / (1000 * 60 * 60 * 24);
          if (daysOld > agentKeepDays) {
            const size = getDirSize(subPath);
            if (size === 0) continue;
            result.reclaimedBytes += size;
            if (!dryRun) rmSync(subPath, { recursive: true, force: true });
            const mb = (size / (1024 * 1024)).toFixed(1);
            if (!opts.json)
              console.log(
                `    ${ui.dim("Remove:")} ${entry}/${sub}/ ${ui.dim(`(${mb} MB, ${Math.floor(daysOld)}d, session dir)`)}`,
              );
            result.removedSessionLogs.push({
              project: entry,
              file: sub + "/",
              sizeMB: mb,
              daysOld: Math.floor(daysOld),
              reason: "session dir",
            });
            logCount++;
            result.actions++;
          }
        } catch {
          continue;
        }
      }
    }
  }
  if (logCount === 0 && !opts.json) console.log(ui.dim("    No session logs to trim"));

  // 4. Purge auxiliary directories
  if (!opts.json) console.log(ui.bold("\n  Auxiliary Data"));
  const claudeDir = join(homedir(), ".claude");
  for (const dirName of AUXILIARY_DIRS) {
    const dir = join(claudeDir, dirName);
    if (!existsSync(dir)) continue;
    const size = getDirSize(dir);
    if (size === 0) continue;
    const mb = (size / (1024 * 1024)).toFixed(1);
    const reclaimed = dryRun ? size : purgeDir(dir, false);
    result.reclaimedBytes += reclaimed;
    if (!opts.json) console.log(`    ${ui.dim("Purge:")} ${dirName}/ ${ui.dim(`(${mb} MB)`)}`);
    result.purgedDirs.push({ name: dirName, sizeMB: mb });
    result.actions++;
  }
  if (result.purgedDirs.length === 0 && !opts.json) console.log(ui.dim("    All clean"));

  // 5. Clear action history
  if (!dryRun) clearHistory();
  result.actions++;

  // 6. Clean disk cache
  const cacheDir = join(homedir(), ".arcana", "cache");
  if (existsSync(cacheDir)) {
    for (const file of readdirSync(cacheDir)) {
      if (!dryRun) {
        try {
          rmSync(join(cacheDir, file), { force: true });
        } catch {
          continue;
        }
      }
      result.removedCacheFiles.push(file);
      result.actions++;
    }
  }

  if (failedSymlinks.length > 0) result.failedSymlinks = failedSymlinks;

  // Output
  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          ...result,
          reclaimedMB: Number((result.reclaimedBytes / (1024 * 1024)).toFixed(1)),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log();
  const mb = (result.reclaimedBytes / (1024 * 1024)).toFixed(1);
  const verb = dryRun ? "Would reclaim" : "Reclaimed";
  if (result.actions > 1) {
    console.log(ui.success(`  ${result.actions} items cleaned. ${verb} ${mb} MB.`));
  } else {
    console.log(ui.success("  Nothing to clean."));
  }
  console.log();
}
