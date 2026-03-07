import { existsSync, rmSync } from "node:fs";
import { resolve, sep } from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { getSkillDir, listSymlinks, readSkillMeta } from "../utils/fs.js";
import { renderBanner } from "../utils/help.js";
import { validateSlug } from "../utils/validate.js";
import { backupSkill } from "../utils/backup.js";

export async function uninstallCommand(
  skillNames: string[],
  opts: { yes?: boolean; json?: boolean } = {},
): Promise<void> {
  if (opts.json) {
    return uninstallJson(skillNames);
  }

  console.log(renderBanner());
  console.log();

  if (skillNames.length === 0) {
    p.intro(chalk.bold("Uninstall skill"));
    p.cancel("Specify one or more skill names");
    process.exit(1);
  }

  for (const name of skillNames) {
    try {
      validateSlug(name, "skill name");
    } catch (err) {
      p.cancel(err instanceof Error ? err.message : `Invalid skill name: ${name}`);
      process.exit(1);
    }
  }

  if (skillNames.length === 1) {
    await uninstallOneInteractive(skillNames[0]!, opts.yes);
  } else {
    await uninstallMultipleInteractive(skillNames, opts.yes);
  }
}

async function uninstallOneInteractive(skillName: string, skipConfirm?: boolean): Promise<void> {
  p.intro(chalk.bold("Uninstall skill"));

  const skillDir = getSkillDir(skillName);

  if (!existsSync(skillDir)) {
    p.cancel(`Skill "${skillName}" is not installed.`);
    process.exit(1);
  }

  if (!skipConfirm) {
    const shouldContinue = await p.confirm({
      message: `Uninstall ${chalk.bold(skillName)}?`,
    });

    if (!shouldContinue || p.isCancel(shouldContinue)) {
      p.cancel("Cancelled.");
      process.exit(0);
    }
  }

  const spin = p.spinner();
  spin.start(`Backing up and removing ${skillName}...`);

  backupSkill(skillName);
  rmSync(skillDir, { recursive: true, force: true });

  const symlinksRemoved = removeSymlinksFor(skillName);

  // Regenerate skill index and active curation
  try {
    const { regenerateIndex } = await import("./index.js");
    regenerateIndex();
  } catch { /* best-effort */ }
  try {
    const { regenerateActive } = await import("./curate.js");
    regenerateActive();
  } catch { /* best-effort */ }

  spin.stop(`Removed ${chalk.bold(skillName)}`);

  if (symlinksRemoved > 0) {
    p.log.info(`Removed ${symlinksRemoved} symlink${symlinksRemoved > 1 ? "s" : ""}`);
  }

  p.outro(`Next: ${chalk.cyan("arcana list --installed")}`);
}

async function uninstallMultipleInteractive(skillNames: string[], skipConfirm?: boolean): Promise<void> {
  p.intro(chalk.bold(`Uninstall ${skillNames.length} skills`));

  const missing: string[] = [];
  for (const name of skillNames) {
    if (!existsSync(getSkillDir(name))) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    p.log.warn(`Not installed: ${missing.join(", ")}`);
  }

  const toRemove = skillNames.filter((n) => existsSync(getSkillDir(n)));
  if (toRemove.length === 0) {
    p.cancel("No installed skills to remove.");
    process.exit(1);
  }

  if (!skipConfirm) {
    const shouldContinue = await p.confirm({
      message: `Uninstall ${toRemove.length} skills (${toRemove.join(", ")})?`,
    });

    if (!shouldContinue || p.isCancel(shouldContinue)) {
      p.cancel("Cancelled.");
      process.exit(0);
    }
  }

  const spin = p.spinner();
  let totalSymlinks = 0;

  for (let i = 0; i < toRemove.length; i++) {
    const skillName = toRemove[i]!;
    spin.start(`Removing ${chalk.bold(skillName)} (${i + 1}/${toRemove.length})...`);
    backupSkill(skillName);
    rmSync(getSkillDir(skillName), { recursive: true, force: true });
    totalSymlinks += removeSymlinksFor(skillName);
  }

  // Regenerate skill index and active curation
  try {
    const { regenerateIndex } = await import("./index.js");
    regenerateIndex();
  } catch { /* best-effort */ }
  try {
    const { regenerateActive } = await import("./curate.js");
    regenerateActive();
  } catch { /* best-effort */ }

  spin.stop(`Removed ${toRemove.length} skills`);

  if (totalSymlinks > 0) {
    p.log.info(`Removed ${totalSymlinks} symlink${totalSymlinks > 1 ? "s" : ""}`);
  }

  p.outro(`Next: ${chalk.cyan("arcana list --installed")}`);
}

export function removeSymlinksFor(skillName: string): number {
  let removed = 0;
  const expectedTarget = resolve(getSkillDir(skillName));
  for (const link of listSymlinks()) {
    try {
      const normalizedTarget = resolve(link.target);
      if (normalizedTarget === expectedTarget || normalizedTarget.startsWith(expectedTarget + sep)) {
        rmSync(link.fullPath);
        removed++;
      }
    } catch {
      // best-effort
    }
  }
  return removed;
}

function uninstallJson(skillNames: string[]): void {
  if (skillNames.length === 0) {
    console.log(JSON.stringify({ error: "No skill specified" }));
    process.exit(1);
  }

  const results: { name: string; success: boolean; version?: string; error?: string; symlinksRemoved: number }[] = [];

  for (const skillName of skillNames) {
    try {
      validateSlug(skillName, "skill name");
    } catch (err) {
      results.push({
        name: skillName,
        success: false,
        error: err instanceof Error ? err.message : "Invalid name",
        symlinksRemoved: 0,
      });
      continue;
    }

    const skillDir = getSkillDir(skillName);

    if (!existsSync(skillDir)) {
      results.push({ name: skillName, success: false, error: "Not installed", symlinksRemoved: 0 });
      continue;
    }

    // Read meta before deleting
    const meta = readSkillMeta(skillName);

    try {
      rmSync(skillDir, { recursive: true, force: true });
    } catch (err) {
      results.push({
        name: skillName,
        success: false,
        version: meta?.version,
        error: err instanceof Error ? err.message : "Failed to remove",
        symlinksRemoved: 0,
      });
      continue;
    }

    const symlinksRemoved = removeSymlinksFor(skillName);
    results.push({ name: skillName, success: true, version: meta?.version, symlinksRemoved });
  }

  if (results.length === 1) {
    const r = results[0]!;
    const output: Record<string, unknown> = {
      uninstalled: r.name,
      success: r.success,
      symlinksRemoved: r.symlinksRemoved,
    };
    if (r.version) output.version = r.version;
    if (r.error) output.error = r.error;
    console.log(JSON.stringify(output));
  } else {
    console.log(JSON.stringify({ results }));
  }

  if (results.some((r) => !r.success)) process.exit(1);
}
