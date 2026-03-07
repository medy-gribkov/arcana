import * as p from "@clack/prompts";
import chalk from "chalk";
import { detectProjectContext } from "../utils/project-context.js";
import { rankSkills } from "../utils/scoring.js";
import type { RecommendVerdict } from "../utils/scoring.js";
import { getProviders } from "../registry.js";
import type { SkillInfo } from "../types.js";

export async function recommendCommand(opts: { json?: boolean; limit?: number; provider?: string }): Promise<void> {
  const cwd = process.cwd();
  const context = detectProjectContext(cwd);

  /* v8 ignore start */
  if (!opts.json) {
    p.intro(chalk.bold("Smart Recommendations"));
    p.log.step(`Project: ${chalk.cyan(context.name)} (${context.type} / ${context.lang})`);
    if (context.tags.length > 0) {
      p.log.info(`Tags detected: ${context.tags.join(", ")}`);
    }
    if (context.ruleFiles.length > 0) {
      p.log.info(`Rules found: ${context.ruleFiles.join(", ")}`);
    }
  }
  /* v8 ignore stop */

  // Fetch all skills from providers
  const providers = getProviders(opts.provider);
  const allSkills: SkillInfo[] = [];
  for (const prov of providers) {
    try {
      const skills = await prov.list();
      allSkills.push(...skills);
    } catch (err) {
      /* v8 ignore start */
      if (!opts.json) {
        p.log.warn(`Could not fetch from ${prov.displayName}: ${err instanceof Error ? err.message : String(err)}`);
      }
      /* v8 ignore stop */
    }
  }

  if (allSkills.length === 0) {
    if (opts.json) {
      console.log(JSON.stringify({ error: "No skills available" }));
      process.exit(1);
    }
    /* v8 ignore next 2 */
    p.log.error("No skills available from any provider.");
    process.exit(1);
  }

  // Score and rank
  const verdicts = rankSkills(allSkills, context);
  const limit = opts.limit ?? Infinity;

  const recommended = verdicts.filter((v) => v.verdict === "recommended").slice(0, limit);
  const optional = verdicts.filter((v) => v.verdict === "optional").slice(0, limit);
  const conflicts = verdicts.filter((v) => v.verdict === "conflict");
  const skipped = verdicts.filter((v) => v.verdict === "skip");

  if (opts.json) {
    const output = {
      project: { name: context.name, type: context.type, lang: context.lang, tags: context.tags },
      recommended: recommended.map(formatVerdict),
      optional: optional.map(formatVerdict),
      conflicts: conflicts.map(formatVerdict),
      skippedCount: skipped.length,
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  /* v8 ignore start */
  // Display results
  if (recommended.length > 0) {
    console.log();
    console.log(chalk.green.bold("  RECOMMENDED"));
    for (const v of recommended) {
      printVerdict(v);
    }
  }

  if (optional.length > 0) {
    console.log();
    console.log(chalk.yellow.bold("  OPTIONAL"));
    for (const v of optional) {
      printVerdict(v);
    }
  }

  if (conflicts.length > 0) {
    console.log();
    console.log(chalk.red.bold("  CONFLICTS"));
    for (const v of conflicts) {
      console.log(`    ${chalk.red(v.skill.padEnd(28))} ${chalk.red("!!")}   ${v.reasons.join(" | ")}`);
    }
  }

  const skipCount = skipped.length;
  if (skipCount > 0) {
    console.log();
    console.log(chalk.dim(`  ${skipCount} skill${skipCount === 1 ? "" : "s"} skipped (installed or no relevance)`));
  }

  console.log();
  p.outro(`Install: ${chalk.cyan("arcana install <skill>")}`);
  /* v8 ignore stop */
}

/* v8 ignore start */
function printVerdict(v: RecommendVerdict): void {
  const scoreStr = v.score > 0 ? `+${v.score}` : String(v.score);
  console.log(
    `    ${chalk.bold(v.skill.padEnd(28))} ${chalk.cyan(scoreStr.padStart(4))}  ${chalk.dim(v.reasons.join(" | "))}`,
  );
}
/* v8 ignore stop */

function formatVerdict(v: RecommendVerdict): { skill: string; score: number; reasons: string[] } {
  return { skill: v.skill, score: v.score, reasons: v.reasons };
}
