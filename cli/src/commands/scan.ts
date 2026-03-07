import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { getInstallDir } from "../utils/fs.js";
import { scanSkillContentFull, formatScanResults } from "../utils/scanner.js";
import type { ScanIssue } from "../utils/scanner.js";
import { ui, banner } from "../utils/ui.js";

export async function scanCommand(
  skill: string | undefined,
  opts: { all?: boolean; json?: boolean; strict?: boolean; verbose?: boolean },
): Promise<void> {
  /* v8 ignore start */
  if (!opts.json) {
    banner();
    console.log(ui.bold("  Security Scan") + (opts.strict ? ui.dim(" (strict mode)") : "") + "\n");
  }
  /* v8 ignore stop */

  const installDir = getInstallDir();
  if (!existsSync(installDir)) {
    if (opts.json) {
      console.log(JSON.stringify({ results: [] }));
    } else {
      /* v8 ignore start */
      console.log(ui.dim("  No skills installed."));
      console.log();
      /* v8 ignore stop */
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
      /* v8 ignore start */
      console.log(ui.error("  Specify a skill name or use --all"));
      console.log(ui.dim("  Usage: arcana scan <skill>"));
      console.log(ui.dim("         arcana scan --all [--json]"));
      console.log();
      /* v8 ignore stop */
    }
    process.exit(1);
  }

  interface SkillScanResult {
    skill: string;
    issues: ScanIssue[];
    suppressed: ScanIssue[];
    error?: string;
  }

  const results: SkillScanResult[] = [];
  let totalIssues = 0;
  let totalSuppressed = 0;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let cleanCount = 0;

  for (const name of skills) {
    const skillMd = join(installDir, name, "SKILL.md");
    if (!existsSync(skillMd)) {
      results.push({ skill: name, issues: [], suppressed: [], error: "Missing SKILL.md" });
      continue;
    }

    try {
      const content = readFileSync(skillMd, "utf-8");
      const { issues, suppressed } = scanSkillContentFull(content, { strict: opts.strict });
      results.push({ skill: name, issues, suppressed });

      if (issues.length === 0) {
        cleanCount++;
      } else {
        totalIssues += issues.length;
        criticalCount += issues.filter((i) => i.level === "critical").length;
        highCount += issues.filter((i) => i.level === "high").length;
        mediumCount += issues.filter((i) => i.level === "medium").length;
      }
      totalSuppressed += suppressed.length;
    } catch (err) {
      results.push({
        skill: name,
        issues: [],
        suppressed: [],
        error: err instanceof Error ? err.message : "Read failed",
      });
    }
  }

  if (opts.json) {
    const jsonOutput: Record<string, unknown> = {
      summary: {
        total: skills.length,
        clean: cleanCount,
        issues: totalIssues,
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        ...(opts.verbose ? { suppressed: totalSuppressed } : {}),
      },
      results: results.map((r) => ({
        skill: r.skill,
        ...(r.error ? { error: r.error } : {}),
        issues: r.issues.map((i) => ({ level: i.level, category: i.category, detail: i.detail, line: i.line })),
        ...(opts.verbose
          ? {
              suppressed: r.suppressed.map((i) => ({
                level: i.level,
                category: i.category,
                detail: i.detail,
                line: i.line,
              })),
            }
          : {}),
      })),
    };
    console.log(JSON.stringify(jsonOutput, null, 2));
    if (criticalCount > 0) process.exit(1);
    return;
  }

  /* v8 ignore start */
  // Display results
  for (const r of results) {
    if (r.error) {
      console.log(`  ${ui.warn("[!!]")} ${ui.bold(r.skill)}: ${r.error}`);
      continue;
    }
    console.log(formatScanResults(r.skill, r.issues));
    if (opts.verbose && !opts.strict && r.suppressed.length > 0) {
      for (const s of r.suppressed) {
        const icon = s.level === "critical" ? "CRIT" : s.level === "high" ? "HIGH" : "MED";
        console.log(`    ${ui.dim(`[SKIP] [${icon}] ${s.category}: ${s.detail} (line ${s.line})`)}`);
      }
    }
  }

  console.log();
  const parts: string[] = [];
  if (cleanCount > 0) parts.push(ui.success(`${cleanCount} clean`));
  if (criticalCount > 0) parts.push(ui.error(`${criticalCount} critical`));
  if (highCount > 0) parts.push(ui.warn(`${highCount} high`));
  if (mediumCount > 0) parts.push(ui.dim(`${mediumCount} medium`));
  if (totalSuppressed > 0 && !opts.strict) parts.push(ui.dim(`${totalSuppressed} suppressed`));
  console.log(`  ${parts.join(ui.dim(" | "))}`);

  if (totalIssues === 0) {
    console.log(ui.success("  No security issues detected."));
  }
  if (!opts.strict) {
    console.log(ui.dim("  Note: BAD/DON'T example blocks are skipped. Use --strict to scan everything."));
  }
  console.log();

  if (criticalCount > 0) process.exit(1);
  /* v8 ignore stop */
}
