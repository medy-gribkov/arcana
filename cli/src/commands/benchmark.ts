import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getInstallDir, readSkillMeta, getDirSize } from "../utils/fs.js";
import { CONTEXT_WINDOW_TOKENS } from "../constants.js";

interface FileEntry {
  path: string;
  sizeBytes: number;
}

interface SkillBenchmark {
  name: string;
  fileCount: number;
  totalBytes: number;
  estimatedTokens: number;
  contextPercent: number;
  files: FileEntry[];
}

function collectFiles(dir: string, prefix: string): FileEntry[] {
  const entries: FileEntry[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      entries.push(...collectFiles(fullPath, prefix ? `${prefix}/${entry}` : entry));
    } else {
      entries.push({ path: prefix ? `${prefix}/${entry}` : entry, sizeBytes: stat.size });
    }
  }
  return entries;
}

function benchmarkSkill(skillName: string): SkillBenchmark | null {
  const installDir = getInstallDir();
  const skillDir = join(installDir, skillName);

  try {
    statSync(skillDir);
  } catch {
    return null;
  }

  const files = collectFiles(skillDir, "");
  const totalBytes = getDirSize(skillDir);
  const estimatedTokens = Math.round(totalBytes / 4);
  const contextPercent = (estimatedTokens / CONTEXT_WINDOW_TOKENS) * 100;

  return {
    name: skillName,
    fileCount: files.length,
    totalBytes,
    estimatedTokens,
    contextPercent,
    files,
  };
}

function formatKB(bytes: number): string {
  return (bytes / 1024).toFixed(1) + " KB";
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return (tokens / 1_000_000).toFixed(1) + "M";
  if (tokens >= 1_000) return (tokens / 1_000).toFixed(1) + "k";
  return String(tokens);
}

export async function benchmarkCommand(
  skill: string | undefined,
  opts: { all?: boolean; json?: boolean },
): Promise<void> {
  const installDir = getInstallDir();

  if (skill) {
    return benchmarkSingle(skill, opts.json);
  }

  if (opts.all) {
    return benchmarkAll(installDir, opts.json);
  }

  console.error("Specify a skill name or use --all to benchmark all installed skills.");
  console.error("Usage: arcana benchmark <skill-name>");
  console.error("       arcana benchmark --all");
  process.exit(1);
}

function benchmarkSingle(skillName: string, json?: boolean): void {
  const result = benchmarkSkill(skillName);

  if (!result) {
    if (json) {
      console.log(JSON.stringify({ error: `Skill "${skillName}" not found` }));
    } else {
      console.error(`Skill "${skillName}" is not installed.`);
    }
    process.exit(1);
  }

  const meta = readSkillMeta(skillName);

  if (json) {
    console.log(
      JSON.stringify({
        name: result.name,
        version: meta?.version ?? "unknown",
        fileCount: result.fileCount,
        totalBytes: result.totalBytes,
        estimatedTokens: result.estimatedTokens,
        contextPercent: Math.round(result.contextPercent * 100) / 100,
        files: result.files.map((f) => ({
          path: f.path,
          sizeBytes: f.sizeBytes,
          estimatedTokens: Math.round(f.sizeBytes / 4),
        })),
      }),
    );
    return;
  }

  console.log();
  console.log(`  Benchmark: ${skillName}${meta?.version ? ` v${meta.version}` : ""}`);
  console.log();
  console.log(`  Files:            ${result.fileCount}`);
  console.log(`  Total size:       ${formatKB(result.totalBytes)}`);
  console.log(`  Est. tokens:      ${formatTokens(result.estimatedTokens)}`);
  console.log(
    `  Context usage:    ${result.contextPercent.toFixed(2)}% of ${(CONTEXT_WINDOW_TOKENS / 1000).toFixed(0)}k window`,
  );
  console.log();
  console.log("  File breakdown:");
  console.log();

  const sorted = [...result.files].sort((a, b) => b.sizeBytes - a.sizeBytes);
  const maxPathLen = Math.min(Math.max(...sorted.map((f) => f.path.length)), 50);

  for (const file of sorted) {
    const displayPath = file.path.length > 50 ? file.path.slice(0, 47) + "..." : file.path;
    const tokens = Math.round(file.sizeBytes / 4);
    console.log(
      `    ${displayPath.padEnd(maxPathLen + 2)} ${formatKB(file.sizeBytes).padStart(10)}  ~${formatTokens(tokens).padStart(6)} tokens`,
    );
  }

  console.log();
}

function benchmarkAll(installDir: string, json?: boolean): void {
  let dirs: string[];
  try {
    dirs = readdirSync(installDir).filter((d) => {
      try {
        return statSync(join(installDir, d)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    dirs = [];
  }

  if (dirs.length === 0) {
    if (json) {
      console.log(JSON.stringify({ skills: [], totalTokens: 0, totalBytes: 0 }));
    } else {
      console.log("No skills installed.");
    }
    return;
  }

  const results: SkillBenchmark[] = [];
  for (const dir of dirs) {
    const result = benchmarkSkill(dir);
    if (result) results.push(result);
  }

  results.sort((a, b) => b.estimatedTokens - a.estimatedTokens);

  const totalBytes = results.reduce((sum, r) => sum + r.totalBytes, 0);
  const totalTokens = results.reduce((sum, r) => sum + r.estimatedTokens, 0);
  const totalContextPercent = (totalTokens / CONTEXT_WINDOW_TOKENS) * 100;

  if (json) {
    console.log(
      JSON.stringify({
        skills: results.map((r) => ({
          name: r.name,
          fileCount: r.fileCount,
          totalBytes: r.totalBytes,
          estimatedTokens: r.estimatedTokens,
          contextPercent: Math.round(r.contextPercent * 100) / 100,
        })),
        totalBytes,
        totalTokens,
        totalContextPercent: Math.round(totalContextPercent * 100) / 100,
      }),
    );
    return;
  }

  console.log();
  console.log(`  Benchmark: ${results.length} installed skill(s)`);
  console.log();

  const maxNameLen = Math.min(Math.max(...results.map((r) => r.name.length)), 30);

  console.log(
    `  ${"Skill".padEnd(maxNameLen + 2)} ${"Files".padStart(5)}  ${"Size".padStart(10)}  ${"Tokens".padStart(8)}  ${"Context %".padStart(9)}`,
  );
  console.log(
    `  ${"-".repeat(maxNameLen + 2)} ${"-".repeat(5)}  ${"-".repeat(10)}  ${"-".repeat(8)}  ${"-".repeat(9)}`,
  );

  for (const r of results) {
    const displayName = r.name.length > 30 ? r.name.slice(0, 27) + "..." : r.name;
    console.log(
      `  ${displayName.padEnd(maxNameLen + 2)} ${String(r.fileCount).padStart(5)}  ${formatKB(r.totalBytes).padStart(10)}  ${formatTokens(r.estimatedTokens).padStart(8)}  ${r.contextPercent.toFixed(2).padStart(8)}%`,
    );
  }

  console.log(
    `  ${"-".repeat(maxNameLen + 2)} ${"-".repeat(5)}  ${"-".repeat(10)}  ${"-".repeat(8)}  ${"-".repeat(9)}`,
  );
  console.log(
    `  ${"TOTAL".padEnd(maxNameLen + 2)} ${String(results.reduce((s, r) => s + r.fileCount, 0)).padStart(5)}  ${formatKB(totalBytes).padStart(10)}  ${formatTokens(totalTokens).padStart(8)}  ${totalContextPercent.toFixed(2).padStart(8)}%`,
  );
  console.log();

  if (totalContextPercent > 50) {
    console.log(`  Warning: installed skills consume ${totalContextPercent.toFixed(1)}% of context window.`);
    console.log("  Consider removing unused skills with: arcana uninstall <skill>");
    console.log();
  }
}
