import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { ui, banner } from "../utils/ui.js";
import { getInstallDir, getDirSize } from "../utils/fs.js";

interface Recommendation {
  area: string;
  status: "good" | "suggest" | "warn";
  message: string;
  action?: string;
}

function readSettings(): Record<string, unknown> | null {
  const settingsPath = join(homedir(), ".claude", "settings.json");
  if (!existsSync(settingsPath)) return null;
  try {
    return JSON.parse(readFileSync(settingsPath, "utf-8"));
  } catch {
    return null;
  }
}

function checkAutocompact(): Recommendation {
  const settings = readSettings();
  if (!settings) {
    return {
      area: "Autocompact",
      status: "suggest",
      message: "No settings.json found",
      action: "Set CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=80 in ~/.claude/settings.json env block",
    };
  }

  const env = settings.env as Record<string, string> | undefined;
  const val = env?.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE;
  if (!val) {
    return {
      area: "Autocompact",
      status: "suggest",
      message: "Not configured (defaults to high threshold)",
      action: "Set to 80 to compact earlier and save tokens",
    };
  }
  const pct = parseInt(val);
  if (pct <= 70) {
    return {
      area: "Autocompact",
      status: "warn",
      message: `Set to ${pct}%. Too aggressive, may lose context.`,
      action: "Raise to 75-80% for better balance",
    };
  }
  if (pct > 85) {
    return {
      area: "Autocompact",
      status: "suggest",
      message: `Set to ${pct}%. Compaction happens late, less room for reasoning.`,
      action: "Lower to 80% for better quality (research-backed)",
    };
  }
  return { area: "Autocompact", status: "good", message: `Set to ${pct}% (optimal range)` };
}

function checkEffortLevel(): Recommendation {
  const settings = readSettings();
  const env = (settings?.env ?? {}) as Record<string, string>;
  const val = env.CLAUDE_CODE_EFFORT_LEVEL;
  if (!val) {
    return { area: "Effort level", status: "good", message: "Using default (high)" };
  }
  if (val === "low") {
    return {
      area: "Effort level",
      status: "suggest",
      message: "Set to 'low'. Faster but may miss details.",
      action: "Use 'medium' for daily work, 'high' for complex tasks",
    };
  }
  if (val === "medium") {
    return { area: "Effort level", status: "good", message: "Set to 'medium'. Good balance of speed and quality." };
  }
  return { area: "Effort level", status: "good", message: `Set to '${val}'` };
}

function checkNonEssentialCalls(): Recommendation {
  const settings = readSettings();
  const env = (settings?.env ?? {}) as Record<string, string>;
  const val = env.DISABLE_NON_ESSENTIAL_MODEL_CALLS;
  if (val === "1" || val === "true") {
    return { area: "Non-essential calls", status: "good", message: "Disabled (saves tokens)" };
  }
  return {
    area: "Non-essential calls",
    status: "suggest",
    message: "Not disabled",
    action: "Set DISABLE_NON_ESSENTIAL_MODEL_CALLS=1 in settings.json env to save tokens",
  };
}

function checkSkillTokenBudget(): Recommendation {
  const dir = getInstallDir();
  if (!existsSync(dir)) {
    return { area: "Skill token budget", status: "good", message: "No skills installed" };
  }

  let totalKB = 0;
  let skillCount = 0;
  const large: { name: string; kb: number }[] = [];

  for (const entry of readdirSync(dir)) {
    const skillDir = join(dir, entry);
    if (!statSync(skillDir).isDirectory()) continue;
    skillCount++;
    const kb = getDirSize(skillDir) / 1024;
    totalKB += kb;
    if (kb > 50) large.push({ name: entry, kb });
  }

  const estTokens = Math.round(totalKB * 256);
  if (totalKB > 500) {
    large.sort((a, b) => b.kb - a.kb);
    const topNames = large
      .slice(0, 3)
      .map((s) => s.name)
      .join(", ");
    return {
      area: "Skill token budget",
      status: "warn",
      message: `${skillCount} skills, ${totalKB.toFixed(0)} KB (~${(estTokens / 1000).toFixed(0)}K tokens). Heavy context load.`,
      action: `Consider uninstalling rarely used skills. Largest: ${topNames}`,
    };
  }
  if (totalKB > 200) {
    return {
      area: "Skill token budget",
      status: "suggest",
      message: `${skillCount} skills, ${totalKB.toFixed(0)} KB (~${(estTokens / 1000).toFixed(0)}K tokens)`,
      action: "Review installed skills with 'arcana list --installed' and remove unused ones",
    };
  }
  return {
    area: "Skill token budget",
    status: "good",
    message: `${skillCount} skills, ${totalKB.toFixed(0)} KB (~${(estTokens / 1000).toFixed(0)}K tokens)`,
  };
}

function checkDiskHealth(): Recommendation {
  const claudeDir = join(homedir(), ".claude");
  if (!existsSync(claudeDir)) {
    return { area: "Disk health", status: "good", message: "No Claude data directory" };
  }

  const totalMB = getDirSize(claudeDir) / (1024 * 1024);
  if (totalMB > 1000) {
    return {
      area: "Disk health",
      status: "warn",
      message: `${totalMB.toFixed(0)} MB total Claude data`,
      action: "Run: arcana compact (removes agent logs, keeps sessions)",
    };
  }
  if (totalMB > 500) {
    return {
      area: "Disk health",
      status: "suggest",
      message: `${totalMB.toFixed(0)} MB total Claude data`,
      action: "Run: arcana compact",
    };
  }
  return { area: "Disk health", status: "good", message: `${totalMB.toFixed(0)} MB total Claude data` };
}

function checkPreCompactHook(): Recommendation {
  // Check both global and local settings for PreCompact hooks
  const paths = [join(homedir(), ".claude", "settings.json"), join(homedir(), ".claude", "settings.local.json")];

  for (const settingsPath of paths) {
    if (!existsSync(settingsPath)) continue;
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      const hooks = settings?.hooks?.PreCompact;
      if (hooks && Array.isArray(hooks) && hooks.length > 0) {
        return { area: "PreCompact hook", status: "good", message: "Installed. Context preserved before compaction." };
      }
    } catch {
      continue;
    }
  }

  return {
    area: "PreCompact hook",
    status: "suggest",
    message: "Not installed. Context is lost during auto-compaction.",
    action: "Run: arcana init --tool claude (adds PreCompact hook to preserve context)",
  };
}

function checkMemorySize(): Recommendation {
  const projectsDir = join(homedir(), ".claude", "projects");
  if (!existsSync(projectsDir)) {
    return { area: "MEMORY.md sizes", status: "good", message: "No project memory files" };
  }

  const oversized: { project: string; lines: number }[] = [];

  for (const entry of readdirSync(projectsDir)) {
    const memDir = join(projectsDir, entry, "memory");
    const memFile = join(memDir, "MEMORY.md");
    if (!existsSync(memFile)) continue;
    try {
      const content = readFileSync(memFile, "utf-8");
      const lineCount = content.split("\n").length;
      if (lineCount > 200) {
        oversized.push({ project: entry, lines: lineCount });
      }
    } catch {
      continue;
    }
  }

  if (oversized.length === 0) {
    return { area: "MEMORY.md sizes", status: "good", message: "All under 200 lines (auto-load limit)" };
  }

  oversized.sort((a, b) => b.lines - a.lines);
  const top = oversized[0]!;
  return {
    area: "MEMORY.md sizes",
    status: "warn",
    message: `${oversized.length} MEMORY.md file${oversized.length > 1 ? "s" : ""} exceed 200 lines. Only first 200 auto-load. Worst: ${top.project} (${top.lines} lines)`,
    action: "Trim to 200 lines. Move detailed notes to separate topic files in memory/",
  };
}

function checkAgentBloat(): Recommendation {
  const projectsDir = join(homedir(), ".claude", "projects");
  if (!existsSync(projectsDir)) {
    return { area: "Agent log bloat", status: "good", message: "No session data" };
  }

  let agentBytes = 0;
  let mainBytes = 0;
  let agentCount = 0;
  let mainCount = 0;

  for (const project of readdirSync(projectsDir)) {
    const projDir = join(projectsDir, project);
    if (!statSync(projDir).isDirectory()) continue;

    for (const file of readdirSync(projDir)) {
      if (!file.endsWith(".jsonl")) continue;
      try {
        const size = statSync(join(projDir, file)).size;
        if (file.startsWith("agent-")) {
          agentBytes += size;
          agentCount++;
        } else {
          mainBytes += size;
          mainCount++;
        }
      } catch {
        continue;
      }
    }
  }

  const totalMB = (agentBytes + mainBytes) / (1024 * 1024);
  const agentMB = agentBytes / (1024 * 1024);
  const agentPct = totalMB > 0 ? Math.round((agentMB / totalMB) * 100) : 0;

  if (agentPct > 70 && agentMB > 50) {
    return {
      area: "Agent log bloat",
      status: "warn",
      message: `${agentCount} agent logs (${agentMB.toFixed(0)} MB, ${agentPct}% of all logs). ${mainCount} main sessions (${(mainBytes / (1024 * 1024)).toFixed(0)} MB).`,
      action: "Run: arcana compact (removes agent logs, keeps main sessions)",
    };
  }
  if (agentMB > 20) {
    return {
      area: "Agent log bloat",
      status: "suggest",
      message: `${agentCount} agent logs (${agentMB.toFixed(0)} MB, ${agentPct}%). ${mainCount} main sessions.`,
      action: "Run: arcana compact",
    };
  }
  return {
    area: "Agent log bloat",
    status: "good",
    message: `${agentCount} agent logs (${agentMB.toFixed(0)} MB), ${mainCount} main sessions (${(mainBytes / (1024 * 1024)).toFixed(0)} MB)`,
  };
}

function checkLargestSkills(): Recommendation {
  const dir = getInstallDir();
  if (!existsSync(dir)) {
    return { area: "Top skills by size", status: "good", message: "No skills installed" };
  }

  const skills: { name: string; kb: number }[] = [];

  for (const entry of readdirSync(dir)) {
    const skillDir = join(dir, entry);
    if (!statSync(skillDir).isDirectory()) continue;
    const kb = getDirSize(skillDir) / 1024;
    skills.push({ name: entry, kb });
  }

  if (skills.length === 0) {
    return { area: "Top skills by size", status: "good", message: "No skills installed" };
  }

  skills.sort((a, b) => b.kb - a.kb);
  const totalKB = skills.reduce((s, sk) => s + sk.kb, 0);
  const totalMB = totalKB / 1024;
  const top5 = skills
    .slice(0, 5)
    .map((s) => `${s.name} (${s.kb.toFixed(0)} KB)`)
    .join(", ");

  if (totalMB > 3) {
    return {
      area: "Top skills by size",
      status: "warn",
      message: `${skills.length} skills, ${totalMB.toFixed(1)} MB total. Top 5: ${top5}`,
      action: "Review large skills with 'arcana list --installed'. Uninstall unused ones.",
    };
  }
  if (totalMB > 1.5) {
    return {
      area: "Top skills by size",
      status: "suggest",
      message: `${skills.length} skills, ${totalMB.toFixed(1)} MB total. Top 5: ${top5}`,
      action: "Consider removing rarely used skills to save context tokens",
    };
  }
  return {
    area: "Top skills by size",
    status: "good",
    message: `${skills.length} skills, ${totalMB.toFixed(1)} MB total. Top 5: ${top5}`,
  };
}

export async function optimizeCommand(opts: { json?: boolean }): Promise<void> {
  if (!opts.json) {
    banner();
    console.log(ui.bold("  Claude Code Optimization Report\n"));
  }

  const recommendations: Recommendation[] = [
    checkAutocompact(),
    checkEffortLevel(),
    checkNonEssentialCalls(),
    checkPreCompactHook(),
    checkSkillTokenBudget(),
    checkMemorySize(),
    checkAgentBloat(),
    checkDiskHealth(),
    checkLargestSkills(),
  ];

  if (opts.json) {
    console.log(JSON.stringify({ recommendations }, null, 2));
    return;
  }

  for (const rec of recommendations) {
    const icon =
      rec.status === "good" ? ui.success("[OK]") : rec.status === "suggest" ? ui.cyan("[>>]") : ui.warn("[!!]");

    console.log(`  ${icon} ${ui.bold(rec.area)}: ${rec.message}`);
    if (rec.action) {
      console.log(ui.dim(`      ${rec.action}`));
    }
  }

  const actionable = recommendations.filter((r) => r.status !== "good");
  console.log();
  if (actionable.length === 0) {
    console.log(ui.success("  Your setup is well optimized."));
  } else {
    console.log(
      ui.dim(
        `  ${actionable.length} suggestion${actionable.length > 1 ? "s" : ""} to improve token usage and performance.`,
      ),
    );
  }
  console.log();
}
