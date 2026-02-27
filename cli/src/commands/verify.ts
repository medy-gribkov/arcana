import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { getInstallDir, isSkillInstalled } from "../utils/fs.js";
import { verifySkillIntegrity } from "../utils/integrity.js";
import { validateSlug } from "../utils/validate.js";
import { renderBanner } from "../utils/help.js";

interface VerifyResult {
  skill: string;
  status: "ok" | "modified" | "missing";
}

export async function verifyCommand(
  skillNames: string[],
  opts: { all?: boolean; json?: boolean },
): Promise<void> {
  if (opts.json) {
    return verifyJson(skillNames, opts);
  }

  console.log(renderBanner());
  console.log();

  const installDir = getInstallDir();

  if (skillNames.length === 0 && !opts.all) {
    p.intro(chalk.bold("Verify skill integrity"));
    p.cancel("Specify a skill name or use --all");
    p.log.info("Usage: arcana verify <skill-name> [skill2 ...]");
    p.log.info("       arcana verify --all");
    process.exit(1);
  }

  let skills: string[];

  if (opts.all) {
    try {
      skills = readdirSync(installDir).filter((d) => statSync(join(installDir, d)).isDirectory());
    } catch {
      skills = [];
    }

    if (skills.length === 0) {
      p.intro(chalk.bold("Verify skill integrity"));
      p.log.info("No installed skills found.");
      p.outro("Nothing to verify.");
      return;
    }
  } else {
    for (const name of skillNames) {
      try {
        validateSlug(name, "skill name");
      } catch (err) {
        p.log.error(err instanceof Error ? err.message : `Invalid skill name: ${name}`);
        process.exit(1);
      }
    }

    for (const name of skillNames) {
      if (!isSkillInstalled(name)) {
        p.log.error(`Skill ${chalk.bold(name)} is not installed.`);
        process.exit(1);
      }
    }

    skills = skillNames;
  }

  p.intro(chalk.bold("Verify skill integrity"));

  const results: VerifyResult[] = [];

  for (const skill of skills) {
    const status = verifySkillIntegrity(skill, installDir);
    results.push({ skill, status });

    if (status === "ok") {
      p.log.info(`${chalk.green("[OK]")} ${skill}`);
    } else if (status === "modified") {
      p.log.warn(`${chalk.yellow("[MODIFIED]")} ${skill}`);
    } else {
      p.log.info(`${chalk.dim("[MISSING]")} ${skill}`);
    }
  }

  const total = results.length;
  const okCount = results.filter((r) => r.status === "ok").length;
  const modifiedCount = results.filter((r) => r.status === "modified").length;
  const missingCount = results.filter((r) => r.status === "missing").length;

  console.log();
  p.outro(
    `${total} skills verified, ${okCount} OK, ${modifiedCount} modified, ${missingCount} not tracked`,
  );

  if (modifiedCount > 0) {
    process.exit(1);
  }
}

async function verifyJson(
  skillNames: string[],
  opts: { all?: boolean },
): Promise<void> {
  const installDir = getInstallDir();

  let skills: string[];

  if (opts.all) {
    try {
      skills = readdirSync(installDir).filter((d) => statSync(join(installDir, d)).isDirectory());
    } catch {
      skills = [];
    }
  } else if (skillNames.length === 0) {
    console.log(JSON.stringify({ error: "Specify a skill name or use --all" }));
    process.exit(1);
    return;
  } else {
    skills = skillNames;
  }

  const results: VerifyResult[] = [];

  for (const skill of skills) {
    const status = verifySkillIntegrity(skill, installDir);
    results.push({ skill, status });
  }

  const total = results.length;
  const ok = results.filter((r) => r.status === "ok").length;
  const modified = results.filter((r) => r.status === "modified").length;
  const missing = results.filter((r) => r.status === "missing").length;

  console.log(
    JSON.stringify({
      results: results.map((r) => ({ skill: r.skill, status: r.status })),
      summary: { total, ok, modified, missing },
    }),
  );

  if (modified > 0) {
    process.exit(1);
  }
}
