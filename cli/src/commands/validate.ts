import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { getInstallDir } from "../utils/fs.js";
import { validateSkillDir, fixSkillFrontmatter } from "../utils/frontmatter.js";
import { atomicWriteSync } from "../utils/atomic.js";
import { ui, banner } from "../utils/ui.js";
import { scanSkillContent } from "../utils/scanner.js";
import type { ValidationResult } from "../types.js";

export async function validateCommand(
  skill: string | undefined,
  opts: {
    all?: boolean;
    fix?: boolean;
    json?: boolean;
    source?: string;
    cross?: boolean;
    minScore?: number;
  },
): Promise<void> {
  if (!opts.json) banner();

  const baseDir = opts.source ? resolve(opts.source) : getInstallDir();
  if (!existsSync(baseDir)) {
    if (opts.json) {
      console.log(JSON.stringify({ results: [] }));
    } else {
      console.log(ui.dim("  No skills installed."));
      console.log();
    }
    return;
  }

  let skills: string[];
  if (opts.all) {
    skills = readdirSync(baseDir).filter((d) => {
      try {
        return statSync(join(baseDir, d)).isDirectory();
      } catch {
        return false;
      }
    });
  } else if (skill) {
    skills = [skill];
  } else {
    if (opts.json) {
      console.log(JSON.stringify({ error: "Specify a skill name or use --all" }));
    } else {
      console.log(ui.error("  Specify a skill name or use --all"));
      console.log(ui.dim("  Usage: arcana validate <skill>"));
      console.log(ui.dim("         arcana validate --all [--fix]"));
      console.log();
    }
    process.exit(1);
  }

  const results: (ValidationResult & { qualityScore?: number; qualityRating?: string })[] = [];

  for (const name of skills) {
    const skillDir = join(baseDir, name);
    if (!existsSync(skillDir)) {
      results.push({ skill: name, valid: false, errors: ["Not installed"], warnings: [], infos: [] });
      continue;
    }

    let result: ValidationResult = validateSkillDir(skillDir, name);

    if (opts.fix && (result.warnings.length > 0 || !result.valid)) {
      const skillMd = join(skillDir, "SKILL.md");
      if (existsSync(skillMd)) {
        try {
          const content = readFileSync(skillMd, "utf-8");
          const fixed = fixSkillFrontmatter(content);
          if (fixed !== content) {
            atomicWriteSync(skillMd, fixed);
            result = validateSkillDir(skillDir, name);
            result.fixed = true;
          }
        } catch (err) {
          if (!opts.json)
            console.log(ui.dim(`    Could not fix: ${err instanceof Error ? err.message : "unknown error"}`));
        }
      }
    }

    // Security scan
    const skillMdPath = join(skillDir, "SKILL.md");
    if (existsSync(skillMdPath)) {
      try {
        const content = readFileSync(skillMdPath, "utf-8");
        const scanIssues = scanSkillContent(content);
        for (const issue of scanIssues) {
          const msg = `Security: ${issue.category} - ${issue.detail} (line ${issue.line})`;
          if (issue.level === "critical") {
            result.errors.push(msg);
            result.valid = false;
          } else {
            result.warnings.push(msg);
          }
        }
      } catch {
        /* skip if unreadable */
      }
    }

    // Quality scoring (when --min-score is set)
    const entry: ValidationResult & { qualityScore?: number; qualityRating?: string } = { ...result };
    if (opts.minScore !== undefined) {
      const { auditSkill } = await import("./audit.js");
      const audit = auditSkill(skillDir, name);
      entry.qualityScore = audit.score;
      entry.qualityRating = audit.rating;

      if (audit.score < opts.minScore) {
        entry.valid = false;
        entry.errors.push(`Quality score ${audit.score} below minimum ${opts.minScore} (${audit.rating})`);
      }
    }

    results.push(entry);
  }

  // Cross-validation (when --cross is set)
  let crossIssues: import("../utils/quality.js").CrossValidationIssue[] = [];
  if (opts.cross) {
    const { crossValidate } = await import("../utils/quality.js");
    const marketplacePaths = opts.source
      ? [
          resolve(opts.source, "..", ".claude-plugin", "marketplace.json"),
          resolve(opts.source, ".claude-plugin", "marketplace.json"),
        ]
      : [resolve(baseDir, "..", ".claude-plugin", "marketplace.json")];

    const marketplacePath = marketplacePaths.find((p) => existsSync(p));
    if (marketplacePath) {
      crossIssues = crossValidate(baseDir, marketplacePath);
    } else if (!opts.json) {
      console.log(ui.warn("  Could not find marketplace.json for cross-validation"));
    }
  }

  const hasErrors = results.some((r) => !r.valid);
  const hasCrossErrors = crossIssues.some((i) => i.level === "error");

  if (opts.json) {
    const output: Record<string, unknown> = {
      results: results.map((r) => ({
        skill: r.skill,
        valid: r.valid,
        errors: r.errors,
        warnings: r.warnings,
        infos: r.infos,
        fixed: r.fixed ?? false,
        ...(r.qualityScore !== undefined && { qualityScore: r.qualityScore, qualityRating: r.qualityRating }),
      })),
    };

    if (opts.cross && crossIssues.length > 0) {
      output.crossValidation = crossIssues;
    }

    const scores = results.filter((r) => r.qualityScore !== undefined).map((r) => r.qualityScore!);
    if (scores.length > 0) {
      output.summary = {
        total: results.length,
        passed: results.filter((r) => r.valid).length,
        failed: results.filter((r) => !r.valid).length,
        averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        belowThreshold: opts.minScore ? results.filter((r) => (r.qualityScore ?? 0) < opts.minScore!).length : 0,
      };
    }

    console.log(JSON.stringify(output, null, 2));
    if (hasErrors || hasCrossErrors) process.exit(1);
    return;
  }

  // Human-readable output
  let passed = 0;
  let warned = 0;
  let failed = 0;
  let fixed = 0;

  for (const r of results) {
    const icon = r.valid ? (r.warnings.length > 0 ? ui.warn("[!!]") : ui.success("[OK]")) : ui.error("[XX]");

    const fixTag = r.fixed ? ui.cyan(" [fixed]") : "";
    const scoreTag = r.qualityScore !== undefined ? ui.dim(` (${r.qualityScore}/100 ${r.qualityRating})`) : "";
    console.log(`  ${icon} ${ui.bold(r.skill)}${fixTag}${scoreTag}`);

    for (const err of r.errors) {
      console.log(ui.error(`    Error: ${err}`));
    }
    for (const warn of r.warnings) {
      console.log(ui.dim(`    Warn: ${warn}`));
    }
    for (const info of r.infos) {
      console.log(ui.dim(`    [i] ${info}`));
    }

    if (r.valid) {
      if (r.warnings.length > 0) warned++;
      else passed++;
    } else {
      failed++;
    }
    if (r.fixed) fixed++;
  }

  // Cross-validation output
  if (opts.cross && crossIssues.length > 0) {
    console.log();
    console.log(ui.bold("  Cross-validation:"));
    for (const issue of crossIssues) {
      const icon = issue.level === "error" ? ui.error("[XX]") : ui.warn("[!!]");
      console.log(`  ${icon} ${issue.skill}: ${issue.detail}`);
    }
  }

  console.log();
  const parts: string[] = [];
  if (passed > 0) parts.push(ui.success(`${passed} passed`));
  if (warned > 0) parts.push(ui.warn(`${warned} warnings`));
  if (failed > 0) parts.push(ui.error(`${failed} failed`));
  if (fixed > 0) parts.push(ui.cyan(`${fixed} fixed`));
  if (hasCrossErrors) parts.push(ui.error(`${crossIssues.filter((i) => i.level === "error").length} cross-validation errors`));
  console.log(`  ${parts.join(ui.dim(" | "))}`);
  console.log();

  if (failed > 0 || hasCrossErrors) process.exit(1);
}
