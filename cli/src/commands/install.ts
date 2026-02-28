import type { Provider } from "../providers/base.js";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { printErrorWithHint } from "../utils/ui.js";
import { installSkill, isSkillInstalled, writeSkillMeta, readSkillMeta } from "../utils/fs.js";
import { getProvider, getProviders } from "../registry.js";
import { loadConfig } from "../utils/config.js";
import { renderBanner } from "../utils/help.js";
import { validateSlug } from "../utils/validate.js";
import { scanSkillContent } from "../utils/scanner.js";
import type { SkillFile } from "../types.js";
import { updateLockEntry } from "../utils/integrity.js";
import { checkConflicts } from "../utils/conflict-check.js";
import { detectProjectContext } from "../utils/project-context.js";

/**
 * Scan fetched skill files for security threats before installing.
 * Returns true if install should proceed, false to block.
 */
function preInstallScan(skillName: string, files: SkillFile[], force?: boolean): boolean {
  const skillMd = files.find((f) => f.path.endsWith("SKILL.md"));
  if (!skillMd) return true;

  const issues = scanSkillContent(skillMd.content);
  if (issues.length === 0) return true;

  const critical = issues.filter((i) => i.level === "critical");
  const high = issues.filter((i) => i.level === "high");

  if (critical.length > 0) {
    p.log.error(`Security scan blocked ${chalk.bold(skillName)}:`);
    for (const issue of critical) {
      p.log.error(`  [CRIT] ${issue.category}: ${issue.detail} (line ${issue.line})`);
    }
    for (const issue of high) {
      p.log.warn(`  [HIGH] ${issue.category}: ${issue.detail} (line ${issue.line})`);
    }
    if (!force) {
      p.log.info(chalk.dim("Use --force to install anyway (not recommended)."));
      return false;
    }
    p.log.warn("Installing despite security issues (--force).");
  } else if (high.length > 0) {
    p.log.warn(`Security warnings for ${chalk.bold(skillName)}:`);
    for (const issue of high) {
      p.log.warn(`  [HIGH] ${issue.category}: ${issue.detail} (line ${issue.line})`);
    }
  }

  return true;
}

export async function installCommand(
  skillNames: string[],
  opts: { provider?: string; all?: boolean; force?: boolean; dryRun?: boolean; json?: boolean; noCheck?: boolean },
): Promise<void> {
  if (opts.json) {
    return installJson(skillNames, opts);
  }

  console.log(renderBanner());
  console.log();

  if (skillNames.length === 0 && !opts.all) {
    p.intro(chalk.bold("Install skill"));
    p.cancel("Specify a skill name or use --all");
    p.log.info("Usage: arcana install <skill-name> [skill2 ...]");
    p.log.info("       arcana install --all");
    process.exit(1);
  }

  const providerName = opts.provider ?? loadConfig().defaultProvider;
  const providers = opts.all ? getProviders() : [getProvider(providerName)];

  if (providers.length === 0) {
    p.cancel("No providers configured. Run: arcana providers --add owner/repo");
    process.exit(1);
  }

  if (opts.all) {
    await installAllInteractive(providers, opts.dryRun, opts.force, opts.noCheck);
  } else if (skillNames.length === 1) {
    await installOneInteractive(skillNames[0]!, providers[0]!, opts.dryRun, opts.force, opts.noCheck);
  } else {
    await installMultipleInteractive(skillNames, providers[0]!, opts.dryRun, opts.force, opts.noCheck);
  }
}

async function installOneInteractive(
  skillName: string,
  provider: Provider,
  dryRun?: boolean,
  force?: boolean,
  noCheck?: boolean,
): Promise<void> {
  p.intro(chalk.bold("Install skill"));

  try {
    validateSlug(skillName, "skill name");
  } catch (err) {
    p.cancel(err instanceof Error ? err.message : "Invalid skill name");
    process.exit(1);
  }

  if (isSkillInstalled(skillName)) {
    if (dryRun) {
      p.log.info(`${skillName} is already installed.`);
      p.outro("Dry run complete.");
      return;
    }
    if (!force) {
      p.cancel(`${skillName} is already installed. Use --force to reinstall.`);
      process.exit(0);
    }
    const existingMeta = readSkillMeta(skillName);
    if (existingMeta?.source && existingMeta.source !== provider.name) {
      p.log.warn(`Overwriting ${skillName} (was from ${existingMeta.source}, now from ${provider.name})`);
    }
    p.log.warn(`${skillName} is already installed. Reinstalling...`);
  }

  if (dryRun) {
    p.log.info(`Would install ${chalk.bold(skillName)} from ${provider.name}`);
    p.outro("Dry run complete.");
    return;
  }

  const spin = p.spinner();
  spin.start(`Fetching ${chalk.bold(skillName)} from ${provider.name}...`);

  try {
    const files = await provider.fetch(skillName);
    spin.stop("Fetched.");

    if (!preInstallScan(skillName, files, force)) {
      process.exit(1);
    }

    // Conflict detection
    if (!noCheck) {
      const context = detectProjectContext(process.cwd());
      const remote = await provider.info(skillName);
      const skillMd = files.find((f) => f.path.endsWith("SKILL.md"));
      const warnings = checkConflicts(skillName, remote, skillMd?.content ?? null, context);
      const blocks = warnings.filter((w) => w.severity === "block");
      const warns = warnings.filter((w) => w.severity === "warn");

      if (blocks.length > 0) {
        for (const b of blocks) p.log.error(`  [CONFLICT] ${b.message}`);
        if (!force) {
          p.log.info("Use --force to install anyway or --no-check to skip conflict detection.");
          process.exit(1);
        }
      }
      if (warns.length > 0) {
        for (const w of warns) p.log.warn(`  [WARN] ${w.message}`);
      }
    }

    const spin2 = p.spinner();
    spin2.start(`Installing ${chalk.bold(skillName)}...`);
    const dir = installSkill(skillName, files);

    const remote = await provider.info(skillName);
    const version = remote?.version ?? "0.0.0";
    writeSkillMeta(skillName, {
      version,
      installedAt: new Date().toISOString(),
      source: provider.name,
      description: remote?.description,
      fileCount: files.length,
      sizeBytes: files.reduce((s, f) => s + f.content.length, 0),
    });
    updateLockEntry(skillName, version, provider.name, files);

    const sizeKB = files.reduce((s, f) => s + f.content.length, 0) / 1024;
    spin2.stop(`Installed ${chalk.bold(skillName)} (${files.length} files, ${sizeKB.toFixed(1)} KB)`);
    if (sizeKB > 50) {
      p.log.warn(
        `Large skill (${sizeKB.toFixed(0)} KB, ~${Math.round(sizeKB * 256)} tokens). May use significant context.`,
      );
    }
    p.log.info(`Location: ${dir}`);
    p.outro(`Next: ${chalk.cyan("arcana validate " + skillName)}`);
  } catch (err) {
    p.log.error(`Failed to install ${skillName}`);
    printErrorWithHint(err, true);
    process.exit(1);
  }
}

async function installMultipleInteractive(
  skillNames: string[],
  provider: Provider,
  dryRun?: boolean,
  force?: boolean,
  _noCheck?: boolean,
): Promise<void> {
  p.intro(chalk.bold(`Install ${skillNames.length} skills`));

  for (const name of skillNames) {
    try {
      validateSlug(name, "skill name");
    } catch (err) {
      p.log.error(err instanceof Error ? err.message : `Invalid skill name: ${name}`);
      process.exit(1);
    }
  }

  if (dryRun) {
    const wouldInstall: string[] = [];
    const alreadyInstalled: string[] = [];
    for (const skillName of skillNames) {
      if (isSkillInstalled(skillName) && !force) {
        alreadyInstalled.push(skillName);
      } else {
        wouldInstall.push(skillName);
      }
    }
    if (wouldInstall.length > 0) {
      p.log.info(`Would install: ${wouldInstall.join(", ")}`);
    }
    if (alreadyInstalled.length > 0) {
      p.log.info(`Already installed: ${alreadyInstalled.join(", ")}`);
    }
    p.outro("Dry run complete.");
    return;
  }

  const spin = p.spinner();
  spin.start(`Processing ${skillNames.length} skills...`);
  const installedList: string[] = [];
  const skippedList: string[] = [];
  const failedList: string[] = [];

  for (let i = 0; i < skillNames.length; i++) {
    const skillName = skillNames[i]!;

    if (isSkillInstalled(skillName) && !force) {
      skippedList.push(skillName);
      continue;
    }

    spin.message(`Installing ${chalk.bold(skillName)} (${i + 1}/${skillNames.length}) from ${provider.name}...`);

    try {
      const files = await provider.fetch(skillName);

      if (!preInstallScan(skillName, files, force)) {
        failedList.push(skillName);
        continue;
      }

      installSkill(skillName, files);
      const remote = await provider.info(skillName);
      const ver = remote?.version ?? "0.0.0";
      writeSkillMeta(skillName, {
        version: ver,
        installedAt: new Date().toISOString(),
        source: provider.name,
        description: remote?.description,
        fileCount: files.length,
        sizeBytes: files.reduce((s, f) => s + f.content.length, 0),
      });
      updateLockEntry(skillName, ver, provider.name, files);
      installedList.push(skillName);
    } catch (err) {
      failedList.push(skillName);
      if (err instanceof Error) p.log.warn(`Failed to install ${skillName}: ${err.message}`);
    }
  }

  spin.stop(`Done`);

  p.log.info(
    `${installedList.length} installed${skippedList.length > 0 ? `, ${skippedList.length} skipped (already installed)` : ""}${failedList.length > 0 ? `, ${failedList.length} failed` : ""}`,
  );
  p.outro(`Next: ${chalk.cyan("arcana doctor")}`);

  if (failedList.length > 0) process.exit(1);
}

async function installAllInteractive(
  providers: Provider[],
  dryRun?: boolean,
  force?: boolean,
  _noCheck?: boolean,
): Promise<void> {
  p.intro(chalk.bold("Install all skills"));

  const spin = p.spinner();
  spin.start("Fetching skill list...");

  if (dryRun) {
    let total = 0;
    for (const provider of providers) {
      try {
        const skills = await provider.list();
        total += skills.length;
      } catch (err) {
        if (err instanceof Error) p.log.warn(`Failed to list ${provider.name}: ${err.message}`);
      }
    }
    spin.stop(`Would install ${total} skills`);
    p.outro("Dry run complete.");
    return;
  }

  const installedList: string[] = [];
  const skippedList: string[] = [];
  const failedList: string[] = [];

  for (const provider of providers) {
    let skills;
    try {
      skills = await provider.list();
    } catch (err) {
      if (err instanceof Error) p.log.warn(`Failed to list ${provider.name}: ${err.message}`);
      continue;
    }

    const total = skills.length;
    for (let i = 0; i < total; i++) {
      const skill = skills[i]!;
      if (isSkillInstalled(skill.name) && !force) {
        skippedList.push(skill.name);
        continue;
      }
      try {
        spin.message(`Installing ${chalk.bold(skill.name)} (${i + 1}/${total}) from ${provider.name}...`);
        const files = await provider.fetch(skill.name);

        if (!preInstallScan(skill.name, files, force)) {
          failedList.push(skill.name);
          continue;
        }

        installSkill(skill.name, files);
        writeSkillMeta(skill.name, {
          version: skill.version,
          installedAt: new Date().toISOString(),
          source: provider.name,
          description: skill.description,
          fileCount: files.length,
          sizeBytes: files.reduce((s, f) => s + f.content.length, 0),
        });
        updateLockEntry(skill.name, skill.version, provider.name, files);
        installedList.push(skill.name);
      } catch (err) {
        failedList.push(skill.name);
        if (err instanceof Error) p.log.warn(`Failed to install ${skill.name}: ${err.message}`);
      }
    }
  }

  spin.stop(`Installed ${installedList.length} skills${failedList.length > 0 ? `, ${failedList.length} failed` : ""}`);

  if (skippedList.length > 0) {
    p.log.info(`Skipped ${skippedList.length} already installed${force ? "" : " (use --force to reinstall)"}`);
  }

  p.outro(`Next: ${chalk.cyan("arcana doctor")}`);

  if (failedList.length > 0) process.exit(1);
}

async function installJson(
  skillNames: string[],
  opts: { provider?: string; all?: boolean; force?: boolean; dryRun?: boolean },
): Promise<void> {
  if (skillNames.length === 0 && !opts.all) {
    console.log(JSON.stringify({ installed: [], skipped: [], failed: [], error: "No skill specified" }));
    process.exit(1);
  }

  const providerName = opts.provider ?? loadConfig().defaultProvider;
  const providers = opts.all ? getProviders() : [getProvider(providerName)];

  if (opts.all) {
    if (opts.dryRun) {
      const wouldInstall: string[] = [];
      const errors: string[] = [];
      for (const provider of providers) {
        try {
          const skills = await provider.list();
          wouldInstall.push(...skills.map((s) => s.name));
        } catch (err) {
          errors.push(`Failed to list ${provider.name}: ${err instanceof Error ? err.message : "unknown error"}`);
        }
      }
      const result: Record<string, unknown> = { dryRun: true, wouldInstall };
      if (errors.length > 0) result.errors = errors;
      console.log(JSON.stringify(result));
      return;
    }

    const installedList: string[] = [];
    const skippedList: string[] = [];
    const failedList: string[] = [];
    const failedErrors: Record<string, string> = {};

    const errors: string[] = [];
    for (const provider of providers) {
      let skills;
      try {
        skills = await provider.list();
      } catch (err) {
        errors.push(`Failed to list ${provider.name}: ${err instanceof Error ? err.message : "unknown error"}`);
        continue;
      }

      for (const skill of skills) {
        if (isSkillInstalled(skill.name) && !opts.force) {
          skippedList.push(skill.name);
          continue;
        }
        try {
          const files = await provider.fetch(skill.name);

          if (!preInstallScan(skill.name, files, opts.force)) {
            failedList.push(skill.name);
            failedErrors[skill.name] = "Blocked by security scan";
            continue;
          }

          installSkill(skill.name, files);
          writeSkillMeta(skill.name, {
            version: skill.version,
            installedAt: new Date().toISOString(),
            source: provider.name,
            description: skill.description,
            fileCount: files.length,
            sizeBytes: files.reduce((s, f) => s + f.content.length, 0),
          });
          updateLockEntry(skill.name, skill.version, provider.name, files);
          installedList.push(skill.name);
        } catch (err) {
          failedList.push(skill.name);
          failedErrors[skill.name] = err instanceof Error ? err.message : "unknown";
        }
      }
    }
    const result: Record<string, unknown> = { installed: installedList, skipped: skippedList, failed: failedList };
    if (errors.length > 0) result.errors = errors;
    if (Object.keys(failedErrors).length > 0) result.failedErrors = failedErrors;
    console.log(JSON.stringify(result));
    if (failedList.length > 0) process.exit(1);
  } else {
    const provider = providers[0]!;

    if (opts.dryRun) {
      console.log(JSON.stringify({ dryRun: true, wouldInstall: skillNames }));
      return;
    }

    const installedList: string[] = [];
    const skippedList: string[] = [];
    const failedList: string[] = [];

    for (const skillName of skillNames) {
      try {
        validateSlug(skillName, "skill name");

        if (isSkillInstalled(skillName) && !opts.force) {
          skippedList.push(skillName);
          continue;
        }

        const files = await provider.fetch(skillName);

        if (!preInstallScan(skillName, files, opts.force)) {
          failedList.push(skillName);
          continue;
        }

        installSkill(skillName, files);
        const remote = await provider.info(skillName);
        const ver = remote?.version ?? "0.0.0";
        writeSkillMeta(skillName, {
          version: ver,
          installedAt: new Date().toISOString(),
          source: provider.name,
          description: remote?.description,
          fileCount: files.length,
          sizeBytes: files.reduce((s, f) => s + f.content.length, 0),
        });
        updateLockEntry(skillName, ver, provider.name, files);
        installedList.push(skillName);
      } catch (_err) {
        failedList.push(skillName);
      }
    }
    console.log(JSON.stringify({ installed: installedList, skipped: skippedList, failed: failedList }));
    if (failedList.length > 0) process.exit(1);
  }
}
