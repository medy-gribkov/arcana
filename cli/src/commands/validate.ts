import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { getInstallDir } from "../utils/fs.js";
import { validateSkillDir, fixSkillFrontmatter } from "../utils/frontmatter.js";
import { atomicWriteSync } from "../utils/atomic.js";
import { ui, banner } from "../utils/ui.js";
import { scanSkillContent } from "../utils/scanner.js";
import type { ValidationResult } from "../types.js";

export async function validateCommand(
  skill: string | undefined,
  opts: { all?: boolean; fix?: boolean; json?: boolean },
): Promise<void> {
  if (!opts.json) banner();

  const installDir = getInstallDir();
  if (!existsSync(installDir)) {
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
    skills = readdirSync(installDir).filter((d) => statSync(join(installDir, d)).isDirectory());
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

  const results: ValidationResult[] = [];

  for (const name of skills) {
    const skillDir = join(installDir, name);
    if (!existsSync(skillDir)) {
      results.push({ skill: name, valid: false, errors: ["Not installed"], warnings: [], infos: [] });
      continue;
    }

    let result = validateSkillDir(skillDir, name);

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

    results.push(result);
  }

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          results: results.map((r) => ({
            skill: r.skill,
            valid: r.valid,
            errors: r.errors,
            warnings: r.warnings,
            infos: r.infos,
            fixed: r.fixed ?? false,
          })),
        },
        null,
        2,
      ),
    );
    if (results.some((r) => !r.valid)) process.exit(1);
    return;
  }

  let passed = 0;
  let warned = 0;
  let failed = 0;
  let fixed = 0;

  for (const r of results) {
    const icon = r.valid ? (r.warnings.length > 0 ? ui.warn("[!!]") : ui.success("[OK]")) : ui.error("[XX]");

    const fixTag = r.fixed ? ui.cyan(" [fixed]") : "";
    console.log(`  ${icon} ${ui.bold(r.skill)}${fixTag}`);

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

  console.log();
  const parts: string[] = [];
  if (passed > 0) parts.push(ui.success(`${passed} passed`));
  if (warned > 0) parts.push(ui.warn(`${warned} warnings`));
  if (failed > 0) parts.push(ui.error(`${failed} failed`));
  if (fixed > 0) parts.push(ui.cyan(`${fixed} fixed`));
  console.log(`  ${parts.join(ui.dim(" | "))}`);
  console.log();

  if (failed > 0) process.exit(1);
}
