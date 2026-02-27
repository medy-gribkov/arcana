import { existsSync, openSync, readSync, closeSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { ui, banner, table } from "../utils/ui.js";
import { readHistory } from "../utils/history.js";
import { getDirSize } from "../utils/fs.js";

interface SessionInfo {
  project: string;
  file: string;
  sizeBytes: number;
  lines: number;
  modified: Date;
}

function discoverSessions(): SessionInfo[] {
  const projectsDir = join(homedir(), ".claude", "projects");
  if (!existsSync(projectsDir)) return [];

  const sessions: SessionInfo[] = [];

  for (const project of readdirSync(projectsDir)) {
    const projDir = join(projectsDir, project);
    if (!statSync(projDir).isDirectory()) continue;

    for (const file of readdirSync(projDir)) {
      if (!file.endsWith(".jsonl")) continue;
      const fullPath = join(projDir, file);
      const stat = statSync(fullPath);

      // Count newlines by streaming in 64KB chunks (avoids loading entire file)
      let lines = 0;
      try {
        const fd = openSync(fullPath, "r");
        try {
          const chunk = Buffer.alloc(65536);
          let bytesRead: number;
          while ((bytesRead = readSync(fd, chunk, 0, chunk.length, null)) > 0) {
            for (let i = 0; i < bytesRead; i++) {
              if (chunk[i] === 10) lines++;
            }
          }
        } finally {
          closeSync(fd);
        }
      } catch {
        continue;
      }

      sessions.push({
        project,
        file,
        sizeBytes: stat.size,
        lines,
        modified: stat.mtime,
      });
    }
  }

  return sessions;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getDiskBreakdown(): { name: string; sizeBytes: number }[] {
  const claudeDir = join(homedir(), ".claude");
  const dirs = [
    "projects",
    "file-history",
    "skills",
    "debug",
    "todos",
    "shell-snapshots",
    "plans",
    "cache",
    "usage-data",
  ] as const;
  const breakdown: { name: string; sizeBytes: number }[] = [];

  for (const dirName of dirs) {
    const dir = join(claudeDir, dirName);
    if (!existsSync(dir)) continue;
    breakdown.push({ name: dirName, sizeBytes: getDirSize(dir) });
  }

  breakdown.sort((a, b) => b.sizeBytes - a.sizeBytes);
  return breakdown;
}

function getProjectBreakdown(): { name: string; sizeBytes: number; sessionCount: number }[] {
  const projectsDir = join(homedir(), ".claude", "projects");
  if (!existsSync(projectsDir)) return [];

  const projects: { name: string; sizeBytes: number; sessionCount: number }[] = [];
  for (const entry of readdirSync(projectsDir)) {
    const full = join(projectsDir, entry);
    if (!statSync(full).isDirectory()) continue;
    const jsonlCount = readdirSync(full).filter((f) => f.endsWith(".jsonl")).length;
    projects.push({ name: entry, sizeBytes: getDirSize(full), sessionCount: jsonlCount });
  }

  projects.sort((a, b) => b.sizeBytes - a.sizeBytes);
  return projects;
}

export async function statsCommand(opts: { json?: boolean }): Promise<void> {
  if (!opts.json) banner();

  const sessions = discoverSessions();

  if (sessions.length === 0) {
    if (opts.json) {
      console.log(JSON.stringify({ totalSessions: 0, totalProjects: 0 }));
    } else {
      console.log(ui.dim("  No session data found in ~/.claude/projects/"));
      console.log();
    }
    return;
  }

  const totalSize = sessions.reduce((sum, s) => sum + s.sizeBytes, 0);
  const totalLines = sessions.reduce((sum, s) => sum + s.lines, 0);
  const avgLines = Math.round(totalLines / sessions.length);
  // Rough token estimate: ~4 chars per token for LLM tokenizers
  const estimatedTokens = Math.round(totalSize / 4);

  const projects = new Set(sessions.map((s) => s.project));
  const sorted = [...sessions].sort((a, b) => b.modified.getTime() - a.modified.getTime());
  const newest = sorted[0]!;
  const oldest = sorted[sorted.length - 1]!;

  // Sessions per project (top 5)
  const projectCounts = new Map<string, number>();
  for (const s of sessions) {
    projectCounts.set(s.project, (projectCounts.get(s.project) ?? 0) + 1);
  }
  const topProjects = [...projectCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Disk breakdown
  const diskBreakdown = getDiskBreakdown();
  const projectBreakdown = getProjectBreakdown();
  const totalDisk = diskBreakdown.reduce((sum, d) => sum + d.sizeBytes, 0);

  // Calculate reclaimable space (auxiliary dirs)
  const reclaimableDirs = ["file-history", "debug", "shell-snapshots", "todos", "plans"];
  const reclaimable = diskBreakdown
    .filter((d) => reclaimableDirs.includes(d.name))
    .reduce((sum, d) => sum + d.sizeBytes, 0);

  if (opts.json) {
    const data = {
      totalSessions: sessions.length,
      totalProjects: projects.size,
      totalSizeBytes: totalSize,
      estimatedTokens,
      avgLinesPerSession: avgLines,
      topProjects: topProjects.map(([name, count]) => ({ name, sessions: count })),
      diskBreakdown: diskBreakdown.map((d) => ({ name: d.name, sizeBytes: d.sizeBytes })),
      projectBreakdown: projectBreakdown
        .slice(0, 10)
        .map((p) => ({ name: p.name, sizeBytes: p.sizeBytes, sessions: p.sessionCount })),
      reclaimableBytes: reclaimable,
    };
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log(ui.bold("  Session Analytics\n"));

  const rows: string[][] = [
    [ui.dim("Sessions"), String(sessions.length)],
    [ui.dim("Projects"), String(projects.size)],
    [ui.dim("Total session data"), formatBytes(totalSize)],
    [ui.dim("Est. tokens"), `~${(estimatedTokens / 1_000_000).toFixed(1)}M (rough)`],
    [ui.dim("Avg lines/session"), String(avgLines)],
    [ui.dim("Newest session"), newest.modified.toLocaleDateString()],
    [ui.dim("Oldest session"), oldest.modified.toLocaleDateString()],
  ];
  table(rows);

  // Disk breakdown
  console.log();
  console.log(ui.bold("  Disk Breakdown\n"));
  const diskRows = diskBreakdown
    .filter((d) => d.sizeBytes > 0)
    .map((d) => [ui.dim(`~/.claude/${d.name}/`), formatBytes(d.sizeBytes)]);
  diskRows.push([ui.bold("Total"), ui.bold(formatBytes(totalDisk))]);
  table(diskRows);

  // Per-project breakdown (top 5)
  if (projectBreakdown.length > 0) {
    console.log();
    console.log(ui.bold("  Projects by Size\n"));
    const projRows = projectBreakdown
      .slice(0, 5)
      .map((p) => [
        ui.dim(p.name.length > 45 ? p.name.slice(0, 42) + "..." : p.name),
        formatBytes(p.sizeBytes),
        `${p.sessionCount} sessions`,
      ]);
    table(projRows);
  }

  if (topProjects.length > 0) {
    console.log();
    console.log(ui.bold("  Most Active Projects\n"));
    const projRows = topProjects.map(([name, count]) => [
      ui.dim(name.length > 40 ? name.slice(0, 37) + "..." : name),
      `${count} sessions`,
    ]);
    table(projRows);
  }

  // Cleanup suggestion
  if (reclaimable > 1024 * 1024) {
    console.log();
    console.log(ui.warn(`  ${formatBytes(reclaimable)} reclaimable in temp directories. Run: arcana clean`));
  }

  const history = readHistory();
  if (history.length > 0) {
    console.log();
    console.log(ui.bold("  Recent Arcana Activity\n"));
    const recent = history.slice(-5).reverse();
    const histRows = recent.map((e) => [ui.dim(new Date(e.timestamp).toLocaleDateString()), e.action, e.target ?? ""]);
    table(histRows);
  }

  console.log();
}
