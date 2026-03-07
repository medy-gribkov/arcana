import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getInstallDir } from "../utils/fs.js";
import { atomicWriteSync } from "../utils/atomic.js";
import { detectProjectContext } from "../utils/project-context.js";
import { rankSkills } from "../utils/scoring.js";
import { readSkillContent } from "./load.js";
import { ACTIVE_FILENAME, CONTEXT_BUDGET_PCT, MODEL_CONTEXTS, TOKENS_PER_KB } from "../constants.js";
import { recordCuration } from "../utils/usage.js";
import { ui, banner } from "../utils/ui.js";
import { getInstalledNames } from "../interactive/helpers.js";
import type { SkillInfo } from "../types.js";

export interface CuratedSkill {
  name: string;
  score: number;
  tokens: number;
  reasons: string[];
}

export interface CurationResult {
  selected: CuratedSkill[];
  skipped: { name: string; reason: string }[];
  totalTokens: number;
  budgetTokens: number;
  budgetPct: number;
}

/** Resolve model context window size. */
function resolveModelContext(model?: string): number {
  if (!model) return MODEL_CONTEXTS["default"]!;
  // Try exact match first, then prefix match
  if (MODEL_CONTEXTS[model] !== undefined) return MODEL_CONTEXTS[model]!;
  const key = Object.keys(MODEL_CONTEXTS).find((k) => model.startsWith(k));
  return key ? MODEL_CONTEXTS[key]! : MODEL_CONTEXTS["default"]!;
}

/** Estimate token count from byte size. */
function estimateTokens(bytes: number): number {
  return Math.round((bytes / 1024) * TOKENS_PER_KB);
}

/**
 * Curate skills for context: rank by relevance, greedily fill token budget.
 * Uses existing rankSkills() from scoring.ts and readSkillContent() from load.ts.
 */
export function curateForContext(
  cwd: string,
  opts: { budgetPct?: number; model?: string; forceInclude?: string[] },
): CurationResult {
  const context = detectProjectContext(cwd);
  const installedNames = getInstalledNames();
  if (installedNames.length === 0) {
    return { selected: [], skipped: [], totalTokens: 0, budgetTokens: 0, budgetPct: 0 };
  }

  // Build SkillInfo stubs for ranking (only installed skills)
  const skillInfos: SkillInfo[] = installedNames.map((name) => ({
    name,
    description: "",
    version: "0.0.0",
    source: "local",
    tags: context.tags.length > 0 ? [...context.tags] : undefined,
  }));

  // Get marketplace data for better scoring if available
  const ranked = rankSkills(skillInfos, context);

  const modelContext = resolveModelContext(opts.model);
  const budgetPct = opts.budgetPct ?? CONTEXT_BUDGET_PCT;
  const budgetTokens = Math.floor((modelContext * budgetPct) / 100);

  const selected: CuratedSkill[] = [];
  const skipped: { name: string; reason: string }[] = [];
  let totalTokens = 0;

  // Force-included skills go first
  const forceInclude = opts.forceInclude ?? [];
  for (const name of forceInclude) {
    if (!installedNames.includes(name)) continue;
    const content = readSkillContent(name);
    if (!content) continue;
    const tokens = estimateTokens(content.bytes);
    if (totalTokens + tokens > budgetTokens) {
      skipped.push({ name, reason: `Force-included but exceeds budget (${tokens} tokens)` });
      continue;
    }
    totalTokens += tokens;
    selected.push({ name, score: 999, tokens, reasons: ["Force-included"] });
  }

  // Fill remaining budget with ranked skills
  for (const verdict of ranked) {
    if (verdict.verdict === "skip" || verdict.verdict === "conflict") continue;
    if (selected.some((s) => s.name === verdict.skill)) continue; // already force-included
    if (!installedNames.includes(verdict.skill)) continue;

    const content = readSkillContent(verdict.skill);
    if (!content) {
      skipped.push({ name: verdict.skill, reason: "Content unreadable" });
      continue;
    }

    const tokens = estimateTokens(content.bytes);
    if (totalTokens + tokens > budgetTokens) {
      skipped.push({ name: verdict.skill, reason: `Over budget (+${tokens} tokens)` });
      continue;
    }

    totalTokens += tokens;
    selected.push({
      name: verdict.skill,
      score: verdict.score,
      tokens,
      reasons: verdict.reasons,
    });
  }

  return { selected, skipped, totalTokens, budgetTokens, budgetPct };
}

/**
 * Generate _active.md with curated skill content.
 * Writes to ~/.agents/skills/_active.md.
 */
export function regenerateActive(opts?: { budgetPct?: number; model?: string }): CurationResult {
  const result = curateForContext(process.cwd(), opts ?? {});
  const installDir = getInstallDir();
  if (!existsSync(installDir)) mkdirSync(installDir, { recursive: true });

  const parts: string[] = [];
  parts.push(`# Active Skills (${result.selected.length})`);
  parts.push("");
  parts.push(
    `Budget: ${result.totalTokens.toLocaleString()} / ${result.budgetTokens.toLocaleString()} tokens (${result.budgetPct}% of context)`,
  );
  parts.push(`Curated for project at: ${process.cwd()}`);
  parts.push(`Generated: ${new Date().toISOString()}`);
  parts.push("");
  parts.push("---");
  parts.push("");

  for (const skill of result.selected) {
    const content = readSkillContent(skill.name);
    if (!content) continue;
    parts.push(content.content);
    parts.push("");
    parts.push("---");
    parts.push("");
  }

  const activePath = join(installDir, ACTIVE_FILENAME);
  atomicWriteSync(activePath, parts.join("\n"), 0o644);

  // Record usage for each curated skill
  for (const skill of result.selected) {
    try {
      recordCuration(skill.name);
    } catch {
      /* best-effort */
    }
  }

  return result;
}

export async function curateCommand(opts: {
  json?: boolean;
  budget?: number;
  model?: string;
  include?: string[];
}): Promise<void> {
  if (!opts.json) {
    banner();
    console.log(ui.bold("  Context Curation\n"));
  }

  const result = curateForContext(process.cwd(), {
    budgetPct: opts.budget,
    model: opts.model,
    forceInclude: opts.include,
  });

  if (result.selected.length === 0 && getInstalledNames().length === 0) {
    if (opts.json) {
      console.log(JSON.stringify({ error: "No skills installed" }));
    } else {
      console.log(ui.dim("  No skills installed. Run: arcana install --all"));
    }
    console.log();
    return;
  }

  // Write _active.md
  const installDir = getInstallDir();
  if (!existsSync(installDir)) mkdirSync(installDir, { recursive: true });

  const parts: string[] = [];
  parts.push(`# Active Skills (${result.selected.length})`);
  parts.push("");
  parts.push(
    `Budget: ${result.totalTokens.toLocaleString()} / ${result.budgetTokens.toLocaleString()} tokens (${result.budgetPct}% of context)`,
  );
  parts.push(`Curated for project at: ${process.cwd()}`);
  parts.push(`Generated: ${new Date().toISOString()}`);
  parts.push("");
  parts.push("---");
  parts.push("");

  for (const skill of result.selected) {
    const content = readSkillContent(skill.name);
    if (!content) continue;
    parts.push(content.content);
    parts.push("");
    parts.push("---");
    parts.push("");
  }

  const activePath = join(installDir, ACTIVE_FILENAME);
  atomicWriteSync(activePath, parts.join("\n"), 0o644);

  if (opts.json) {
    console.log(
      JSON.stringify({
        selected: result.selected,
        skipped: result.skipped,
        totalTokens: result.totalTokens,
        budgetTokens: result.budgetTokens,
        path: activePath,
      }),
    );
    return;
  }

  // Display results
  const budgetBar = Math.round((result.totalTokens / result.budgetTokens) * 20);
  const bar = ui.success("█".repeat(budgetBar)) + ui.dim("░".repeat(20 - budgetBar));
  console.log(`  ${bar} ${result.totalTokens.toLocaleString()} / ${result.budgetTokens.toLocaleString()} tokens`);
  console.log();

  for (const skill of result.selected) {
    const pct = Math.round((skill.tokens / result.budgetTokens) * 100);
    console.log(`  ${ui.success("[OK]")} ${skill.name} (${skill.tokens.toLocaleString()} tokens, ${pct}%)`);
    if (skill.reasons.length > 0) {
      console.log(ui.dim(`       ${skill.reasons.join(", ")}`));
    }
  }

  if (result.skipped.length > 0) {
    console.log();
    console.log(ui.dim("  Skipped:"));
    for (const skip of result.skipped.slice(0, 5)) {
      console.log(ui.dim(`    ${skip.name}: ${skip.reason}`));
    }
    if (result.skipped.length > 5) {
      console.log(ui.dim(`    ...and ${result.skipped.length - 5} more`));
    }
  }

  console.log();
  console.log(ui.dim(`  Written to: ${activePath}`));
  console.log(ui.dim("  Agents read this file automatically for project-relevant skills."));
  console.log();
}
