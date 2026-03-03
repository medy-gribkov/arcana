import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { getInstallDir } from "../utils/fs.js";
import { scanSkillContent, formatScanResults } from "../utils/scanner.js";
import { ui, banner } from "../utils/ui.js";

export async function scanCommand(skill: string | undefined, opts: { all?: boolean; json?: boolean }): Promise<void> {
  if (!opts.json) {
    banner();
    console.log(ui.bold("  Security Scan\n"));
  }

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
      console.log(ui.dim("  Usage: arcana scan <skill>"));
      console.log(ui.dim("         arcana scan --all [--json]"));
      console.log();
    }
    process.exit(1);
  }

  interface SkillScanResult {
    skill: string;
    issues: ReturnType<typeof scanSkillContent>;
    error?: string;
  }

  const results: SkillScanResult[] = [];
  let totalIssues = 0;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let cleanCount = 0;

  for (const name of skills) {
    const skillMd = join(installDir, name, "SKILL.md");
    if (!existsSync(skillMd)) {
      results.push({ skill: name, issues: [], error: "Missing SKILL.md" });
      continue;
    }

    try {
      const content = readFileSync(skillMd, "utf-8");
      const issues = scanSkillContent(content);
      results.push({ skill: name, issues });

      if (issues.length === 0) {
        cleanCount++;
      } else {
        totalIssues += issues.length;
        criticalCount += issues.filter((i) => i.level === "critical").length;
        highCount += issues.filter((i) => i.level === "high").length;
        mediumCount += issues.filter((i) => i.level === "medium").length;
      }
    } catch (err) {
      results.push({ skill: name, issues: [], error: err instanceof Error ? err.message : "Read failed" });
    }
  }

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          summary: {
            total: skills.length,
            clean: cleanCount,
            issues: totalIssues,
            critical: criticalCount,
            high: highCount,
            medium: mediumCount,
          },
          results: results.map((r) => ({
            skill: r.skill,
            ...(r.error ? { error: r.error } : {}),
            issues: r.issues.map((i) => ({ level: i.level, category: i.category, detail: i.detail, line: i.line })),
          })),
        },
        null,
        2,
      ),
    );
    if (criticalCount > 0) process.exit(1);
    return;
  }

  // Display results
  for (const r of results) {
    if (r.error) {
      console.log(`  ${ui.warn("[!!]")} ${ui.bold(r.skill)}: ${r.error}`);
      continue;
    }
    console.log(formatScanResults(r.skill, r.issues));
  }

  console.log();
  const parts: string[] = [];
  if (cleanCount > 0) parts.push(ui.success(`${cleanCount} clean`));
  if (criticalCount > 0) parts.push(ui.error(`${criticalCount} critical`));
  if (highCount > 0) parts.push(ui.warn(`${highCount} high`));
  if (mediumCount > 0) parts.push(ui.dim(`${mediumCount} medium`));
  console.log(`  ${parts.join(ui.dim(" | "))}`);

  if (totalIssues === 0) {
    console.log(ui.success("  No security issues detected."));
  }
  console.log();

  if (criticalCount > 0) process.exit(1);
}
