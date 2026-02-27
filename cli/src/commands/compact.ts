import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { ui, banner, table } from "../utils/ui.js";
import { getDirSize } from "../utils/fs.js";

interface ProjectAnalysis {
  name: string;
  mainFiles: { name: string; sizeBytes: number; daysOld: number }[];
  agentFiles: { name: string; sizeBytes: number; daysOld: number }[];
  sessionDirs: { name: string; sizeBytes: number; daysOld: number }[];
  totalBytes: number;
  reclaimableBytes: number;
}

function analyzeProject(projDir: string, projName: string): ProjectAnalysis {
  const now = Date.now();
  const mainFiles: ProjectAnalysis["mainFiles"] = [];
  const agentFiles: ProjectAnalysis["agentFiles"] = [];
  const sessionDirs: ProjectAnalysis["sessionDirs"] = [];

  for (const entry of readdirSync(projDir)) {
    const full = join(projDir, entry);
    try {
      const stat = statSync(full);

      if (stat.isDirectory()) {
        if (entry === "memory") continue;
        sessionDirs.push({
          name: entry,
          sizeBytes: getDirSize(full),
          daysOld: Math.floor((now - stat.mtimeMs) / (1000 * 60 * 60 * 24)),
        });
        continue;
      }

      if (!entry.endsWith(".jsonl")) continue;

      const info = {
        name: entry,
        sizeBytes: stat.size,
        daysOld: Math.floor((now - stat.mtimeMs) / (1000 * 60 * 60 * 24)),
      };

      if (entry.startsWith("agent-")) {
        agentFiles.push(info);
      } else {
        mainFiles.push(info);
      }
    } catch { continue; }
  }

  const totalBytes = mainFiles.reduce((s, f) => s + f.sizeBytes, 0)
    + agentFiles.reduce((s, f) => s + f.sizeBytes, 0)
    + sessionDirs.reduce((s, d) => s + d.sizeBytes, 0);

  // Reclaimable: all agent files + all session dirs
  const reclaimableBytes = agentFiles.reduce((s, f) => s + f.sizeBytes, 0)
    + sessionDirs.reduce((s, d) => s + d.sizeBytes, 0);

  return { name: projName, mainFiles, agentFiles, sessionDirs, totalBytes, reclaimableBytes };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export async function compactCommand(opts: { dryRun?: boolean; json?: boolean }): Promise<void> {
  if (!opts.json) banner();

  const dryRun = opts.dryRun ?? false;
  if (dryRun && !opts.json) console.log(ui.warn("  DRY RUN - no files will be deleted\n"));

  const projectsDir = join(homedir(), ".claude", "projects");
  if (!existsSync(projectsDir)) {
    if (opts.json) {
      console.log(JSON.stringify({ projects: [], totalReclaimed: 0 }));
    } else {
      console.log(ui.dim("  No session data found."));
      console.log();
    }
    return;
  }

  const analyses: ProjectAnalysis[] = [];

  for (const entry of readdirSync(projectsDir)) {
    const projDir = join(projectsDir, entry);
    if (!statSync(projDir).isDirectory()) continue;
    if (entry === "memory" || entry.startsWith(".")) continue;

    const analysis = analyzeProject(projDir, entry);
    if (analysis.totalBytes > 0) {
      analyses.push(analysis);
    }
  }

  analyses.sort((a, b) => b.totalBytes - a.totalBytes);

  if (opts.json) {
    const jsonResult = {
      projects: analyses.map(a => ({
        name: a.name,
        totalBytes: a.totalBytes,
        reclaimableBytes: a.reclaimableBytes,
        mainSessions: a.mainFiles.length,
        agentLogs: a.agentFiles.length,
        sessionDirs: a.sessionDirs.length,
      })),
      totalReclaimed: dryRun ? 0 : analyses.reduce((s, a) => s + a.reclaimableBytes, 0),
    };
    console.log(JSON.stringify(jsonResult, null, 2));
    if (!dryRun) {
      for (const a of analyses) {
        const projDir = join(projectsDir, a.name);
        for (const f of a.agentFiles) {
          try { rmSync(join(projDir, f.name), { force: true }); } catch { /* skip */ }
        }
        for (const d of a.sessionDirs) {
          try { rmSync(join(projDir, d.name), { recursive: true, force: true }); } catch { /* skip */ }
        }
      }
    }
    return;
  }

  if (!opts.json) console.log(ui.bold("  Session Compaction Report\n"));

  let totalReclaimed = 0;
  const hasWork = analyses.some(a => a.reclaimableBytes > 0);

  for (const a of analyses) {
    if (a.totalBytes < 1024) continue; // Skip tiny projects

    const truncName = a.name.length > 50 ? a.name.slice(0, 47) + "..." : a.name;
    console.log(`  ${ui.bold(truncName)}  ${ui.dim(formatBytes(a.totalBytes))}`);

    // Main sessions
    const mainSize = a.mainFiles.reduce((s, f) => s + f.sizeBytes, 0);
    console.log(`    ${ui.success("Keep:")} ${a.mainFiles.length} main session${a.mainFiles.length !== 1 ? "s" : ""} ${ui.dim(`(${formatBytes(mainSize)})`)}`);

    // Agent logs
    if (a.agentFiles.length > 0) {
      const agentSize = a.agentFiles.reduce((s, f) => s + f.sizeBytes, 0);
      console.log(`    ${ui.warn("Remove:")} ${a.agentFiles.length} agent log${a.agentFiles.length !== 1 ? "s" : ""} ${ui.dim(`(${formatBytes(agentSize)})`)}`);

      if (!dryRun) {
        const projDir = join(projectsDir, a.name);
        for (const f of a.agentFiles) {
          try { rmSync(join(projDir, f.name), { force: true }); } catch { /* skip */ }
        }
      }
      totalReclaimed += agentSize;
    }

    // Session dirs
    if (a.sessionDirs.length > 0) {
      const dirSize = a.sessionDirs.reduce((s, d) => s + d.sizeBytes, 0);
      if (dirSize > 0) {
        console.log(`    ${ui.warn("Remove:")} ${a.sessionDirs.length} session dir${a.sessionDirs.length !== 1 ? "s" : ""} ${ui.dim(`(${formatBytes(dirSize)})`)}`);

        if (!dryRun) {
          const projDir = join(projectsDir, a.name);
          for (const d of a.sessionDirs) {
            try { rmSync(join(projDir, d.name), { recursive: true, force: true }); } catch { /* skip */ }
          }
        }
        totalReclaimed += dirSize;
      }
    }

    console.log();
  }

  // Summary
  if (!hasWork) {
    console.log(ui.success("  Already compact. No agent logs to remove."));
  } else {
    const verb = dryRun ? "Would reclaim" : "Reclaimed";
    console.log(ui.success(`  ${verb} ${formatBytes(totalReclaimed)} by removing agent logs and session dirs.`));
    console.log(ui.dim("  Main session files preserved for history."));
  }
  console.log();
}
