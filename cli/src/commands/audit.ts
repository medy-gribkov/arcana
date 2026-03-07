import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { getInstallDir } from "../utils/fs.js";
import { extractFrontmatter, parseFrontmatter } from "../utils/frontmatter.js";
import { ui, banner } from "../utils/ui.js";
import { SKILL_MAX_LINES } from "../constants.js";

export interface AuditResult {
  skill: string;
  rating: "PERFECT" | "STRONG" | "ADEQUATE" | "WEAK";
  score: number;
  checks: { name: string; passed: boolean; detail?: string }[];
}

export function auditSkill(skillDir: string, skillName: string): AuditResult {
  const checks: AuditResult["checks"] = [];
  let score = 0;

  const skillMd = join(skillDir, "SKILL.md");
  if (!existsSync(skillMd)) {
    return { skill: skillName, rating: "WEAK", score: 0, checks: [{ name: "SKILL.md exists", passed: false }] };
  }

  let content: string;
  try {
    content = readFileSync(skillMd, "utf-8");
  } catch {
    return { skill: skillName, rating: "WEAK", score: 0, checks: [{ name: "SKILL.md readable", passed: false }] };
  }
  const extracted = extractFrontmatter(content);
  const parsed = extracted ? parseFrontmatter(extracted.raw) : null;
  const body = extracted?.body || "";
  const lines = body.split("\n");
  const lineCount = lines.length;

  // 1. Has frontmatter with name and description
  const hasFrontmatter = !!parsed?.name && !!parsed?.description;
  checks.push({ name: "Valid frontmatter", passed: hasFrontmatter });
  if (hasFrontmatter) score += 10;

  // 2. Description length (80-1024)
  const descLen = parsed?.description?.length || 0;
  const goodDesc = descLen >= 80 && descLen <= 1024;
  checks.push({ name: "Description length (80-1024)", passed: goodDesc, detail: `${descLen} chars` });
  if (goodDesc) score += 10;

  // 3. Has ## headings
  const headingCount = (body.match(/^## /gm) || []).length;
  const hasHeadings = headingCount >= 2;
  checks.push({ name: "Has ## headings (2+)", passed: hasHeadings, detail: `${headingCount} headings` });
  if (hasHeadings) score += 10;

  // 4. Has code examples
  const codeBlockCount = (body.match(/```/g) || []).length / 2;
  const hasCode = codeBlockCount >= 2;
  checks.push({ name: "Has code examples (2+)", passed: hasCode, detail: `${Math.floor(codeBlockCount)} blocks` });
  if (hasCode) score += 20;

  // 5. Has BAD/GOOD or BEFORE/AFTER patterns
  const hasBadGood = /\b(BAD|GOOD|BEFORE|AFTER|DON'T|DO)\b/i.test(body);
  checks.push({ name: "Has BAD/GOOD or BEFORE/AFTER pairs", passed: hasBadGood });
  if (hasBadGood) score += 15;

  // 6. Not a capabilities list (detects pattern of many "- " lines with no code between them)
  const bulletLines = (body.match(/^- /gm) || []).length;
  const isCapabilityList = bulletLines > 20 && codeBlockCount < 3;
  checks.push({
    name: "Not a capabilities list",
    passed: !isCapabilityList,
    detail: isCapabilityList ? `${bulletLines} bullets, ${Math.floor(codeBlockCount)} code blocks` : undefined,
  });
  if (!isCapabilityList) score += 15;

  // 7. Reasonable length (50-300 lines)
  const goodLength = lineCount >= 50 && lineCount <= SKILL_MAX_LINES;
  checks.push({ name: `Reasonable length (50-${SKILL_MAX_LINES} lines)`, passed: goodLength, detail: `${lineCount} lines` });
  if (goodLength) score += 10;
  if (lineCount > SKILL_MAX_LINES) score -= 10;

  // 8. Has scripts/ or references/ directory (bonus)
  const hasScripts = existsSync(join(skillDir, "scripts"));
  const hasRefs = existsSync(join(skillDir, "references")) || existsSync(join(skillDir, "rules"));
  const hasExtras = hasScripts || hasRefs;
  checks.push({
    name: "Has scripts/ or references/",
    passed: hasExtras,
    detail: hasExtras ? [hasScripts && "scripts", hasRefs && "references"].filter(Boolean).join(", ") : "none",
  });
  if (hasExtras) score += 10;

  // 9. Section diversity (3+ unique ## headings)
  const uniqueHeadings = new Set((body.match(/^## .+$/gm) || []).map((h) => h.toLowerCase()));
  const goodDiversity = uniqueHeadings.size >= 3;
  checks.push({
    name: "Section diversity (3+ unique headings)",
    passed: goodDiversity,
    detail: `${uniqueHeadings.size} unique sections`,
  });
  if (goodDiversity) score += 5;

  // 10. Numbered steps (task decomposition signal)
  const numberedSteps = (body.match(/^\d+\.\s/gm) || []).length;
  const hasSteps = numberedSteps >= 3;
  checks.push({ name: "Has numbered steps (3+)", passed: hasSteps, detail: `${numberedSteps} steps` });
  if (hasSteps) score += 5;

  // Rating (max possible: 110, penalty can reduce below 0)
  let rating: AuditResult["rating"];
  if (score >= 90) rating = "PERFECT";
  else if (score >= 65) rating = "STRONG";
  else if (score >= 40) rating = "ADEQUATE";
  else rating = "WEAK";

  return { skill: skillName, rating, score, checks };
}

export async function auditCommand(
  skill: string | undefined,
  opts: { all?: boolean; json?: boolean; source?: string },
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
      console.log(ui.dim("  Usage: arcana audit <skill>"));
      console.log(ui.dim("         arcana audit --all [--json]"));
      console.log();
    }
    process.exit(1);
  }

  const results: AuditResult[] = [];

  for (const name of skills.sort()) {
    const skillDir = join(baseDir, name);
    if (!existsSync(skillDir)) {
      results.push({ skill: name, rating: "WEAK", score: 0, checks: [{ name: "Exists", passed: false }] });
      continue;
    }
    results.push(auditSkill(skillDir, name));
  }

  if (opts.json) {
    console.log(JSON.stringify({ results }, null, 2));
    return;
  }

  const counts = { PERFECT: 0, STRONG: 0, ADEQUATE: 0, WEAK: 0 };

  for (const r of results) {
    counts[r.rating]++;
    const ratingColor =
      r.rating === "PERFECT"
        ? ui.success
        : r.rating === "STRONG"
          ? ui.cyan
          : r.rating === "ADEQUATE"
            ? ui.warn
            : ui.error;

    console.log(`  ${ratingColor(`[${r.rating}]`)} ${ui.bold(r.skill)} ${ui.dim(`(${r.score}/110)`)}`);

    for (const check of r.checks) {
      if (!check.passed) {
        const detail = check.detail ? ` ${ui.dim(`(${check.detail})`)}` : "";
        console.log(`    ${ui.error("x")} ${check.name}${detail}`);
      }
    }
  }

  console.log();
  const parts: string[] = [];
  if (counts.PERFECT > 0) parts.push(ui.success(`${counts.PERFECT} perfect`));
  if (counts.STRONG > 0) parts.push(ui.cyan(`${counts.STRONG} strong`));
  if (counts.ADEQUATE > 0) parts.push(ui.warn(`${counts.ADEQUATE} adequate`));
  if (counts.WEAK > 0) parts.push(ui.error(`${counts.WEAK} weak`));
  console.log(`  ${parts.join(ui.dim(" | "))}`);
  console.log();
}
