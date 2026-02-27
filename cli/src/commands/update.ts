import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import semver from "semver";
import { getInstallDir, installSkill, readSkillMeta, writeSkillMeta } from "../utils/fs.js";
import { getProvider, getProviders } from "../registry.js";
import { ui, banner, spinner, noopSpinner } from "../utils/ui.js";
import { loadConfig } from "../utils/config.js";
import { validateSlug } from "../utils/validate.js";
import { updateLockEntry } from "../utils/integrity.js";

function isNewer(remoteVersion: string, localVersion: string | undefined): boolean {
  const local = semver.valid(semver.coerce(localVersion)) ?? "0.0.0";
  const remote = semver.valid(semver.coerce(remoteVersion)) ?? "0.0.0";
  return semver.gt(remote, local);
}

export async function updateCommand(
  skills: string[],
  opts: { all?: boolean; provider?: string; dryRun?: boolean; json?: boolean },
): Promise<void> {
  if (!opts.json) {
    banner();
  }

  if (skills.length === 0 && !opts.all) {
    if (opts.json) {
      console.log(JSON.stringify({ error: "Specify a skill name or use --all" }));
    } else {
      console.log(ui.error("  Specify a skill name or use --all"));
      console.log(ui.dim("  Usage: arcana update <skill> [skill2 ...]"));
      console.log(ui.dim("         arcana update --all"));
      console.log();
    }
    process.exit(1);
  }

  const installDir = getInstallDir();
  if (!existsSync(installDir)) {
    if (opts.json) {
      console.log(JSON.stringify({ updated: [], upToDate: [], failed: [] }));
    } else {
      console.log(ui.dim("  No skills installed."));
      console.log();
    }
    return;
  }

  const providerName = opts.provider ?? loadConfig().defaultProvider;

  if (opts.all) {
    await updateAll(installDir, providerName, opts.json, opts.dryRun);
  } else if (skills.length === 1) {
    await updateOne(skills[0]!, installDir, providerName, opts.json, opts.dryRun);
  } else {
    await updateMultiple(skills, installDir, providerName, opts.json, opts.dryRun);
  }
}

async function updateOne(
  skillName: string,
  installDir: string,
  providerName: string,
  json?: boolean,
  dryRun?: boolean,
): Promise<void> {
  try {
    validateSlug(skillName, "skill name");
  } catch (err) {
    if (json) {
      console.log(
        JSON.stringify({
          updated: [],
          upToDate: [],
          failed: [skillName],
          error: err instanceof Error ? err.message : "Invalid name",
        }),
      );
    } else {
      console.log(ui.error(`  ${err instanceof Error ? err.message : "Invalid skill name"}`));
      console.log();
    }
    process.exit(1);
  }

  const skillDir = join(installDir, skillName);
  if (!existsSync(skillDir)) {
    if (json) {
      console.log(JSON.stringify({ updated: [], upToDate: [], failed: [skillName], error: "Not installed" }));
    } else {
      console.log(ui.error(`  Skill "${skillName}" is not installed.`));
      console.log();
    }
    process.exit(1);
  }

  const s = json ? noopSpinner() : spinner(`Checking ${ui.bold(skillName)} for updates...`);
  s.start();

  try {
    const provider = getProvider(providerName);
    const remote = await provider.info(skillName);

    if (!remote) {
      if (json) {
        console.log(
          JSON.stringify({ updated: [], upToDate: [], failed: [skillName], error: `Not found on ${providerName}` }),
        );
      } else {
        s.fail(`Skill "${skillName}" not found on ${providerName}`);
        console.log();
      }
      process.exit(1);
    }

    const meta = readSkillMeta(skillName);
    if (!isNewer(remote.version, meta?.version)) {
      if (json) {
        console.log(JSON.stringify({ updated: [], upToDate: [skillName], failed: [] }));
      } else {
        s.info(`${ui.bold(skillName)} is already up to date (v${remote.version})`);
        console.log();
      }
      return;
    }

    if (dryRun) {
      if (json) {
        console.log(
          JSON.stringify({
            dryRun: true,
            wouldUpdate: [{ name: skillName, from: meta?.version ?? "unknown", to: remote.version }],
          }),
        );
      } else {
        s.info(`${ui.bold(skillName)} would be updated: v${meta?.version ?? "unknown"} -> v${remote.version}`);
        console.log();
      }
      return;
    }

    s.text = `Updating ${ui.bold(skillName)}...`;
    const files = await provider.fetch(skillName);
    installSkill(skillName, files);
    writeSkillMeta(skillName, {
      version: remote.version,
      installedAt: new Date().toISOString(),
      source: providerName,
      description: remote.description,
      fileCount: files.length,
    });
    updateLockEntry(skillName, remote.version, providerName, files);

    if (json) {
      console.log(JSON.stringify({ updated: [skillName], upToDate: [], failed: [] }));
    } else {
      s.succeed(`Updated ${ui.bold(skillName)} to v${remote.version} (${files.length} files)`);
      console.log();
    }
  } catch (err) {
    if (json) {
      console.log(
        JSON.stringify({
          updated: [],
          upToDate: [],
          failed: [skillName],
          error: err instanceof Error ? err.message : "Update failed",
        }),
      );
    } else {
      s.fail(`Failed to update ${skillName}`);
      if (err instanceof Error) console.error(ui.dim(`  ${err.message}`));
      console.log();
    }
    process.exit(1);
  }
}

async function updateMultiple(
  skillNames: string[],
  installDir: string,
  providerName: string,
  json?: boolean,
  dryRun?: boolean,
): Promise<void> {
  for (const name of skillNames) {
    try {
      validateSlug(name, "skill name");
    } catch (err) {
      if (json) {
        console.log(
          JSON.stringify({
            updated: [],
            upToDate: [],
            failed: skillNames,
            error: err instanceof Error ? err.message : "Invalid name",
          }),
        );
      } else {
        console.log(ui.error(`  ${err instanceof Error ? err.message : "Invalid skill name"}`));
        console.log();
      }
      process.exit(1);
    }
  }

  const s = json ? noopSpinner() : spinner(`Checking ${skillNames.length} skills for updates...`);
  s.start();

  const provider = getProvider(providerName);
  const updatedList: string[] = [];
  const upToDateList: string[] = [];
  const failedList: string[] = [];
  const dryRunUpdates: { name: string; from: string; to: string }[] = [];

  for (let i = 0; i < skillNames.length; i++) {
    const skillName = skillNames[i]!;
    const skillDir = join(installDir, skillName);

    if (!existsSync(skillDir)) {
      failedList.push(skillName);
      if (!json) console.error(ui.dim(`  ${skillName} is not installed`));
      continue;
    }

    try {
      const remote = await provider.info(skillName);
      if (!remote) {
        failedList.push(skillName);
        continue;
      }

      const meta = readSkillMeta(skillName);
      if (!isNewer(remote.version, meta?.version)) {
        upToDateList.push(skillName);
        continue;
      }

      if (dryRun) {
        dryRunUpdates.push({ name: skillName, from: meta?.version ?? "unknown", to: remote.version });
        continue;
      }

      s.text = `Updating ${ui.bold(skillName)} (${i + 1}/${skillNames.length})...`;
      const files = await provider.fetch(skillName);
      installSkill(skillName, files);
      writeSkillMeta(skillName, {
        version: remote.version,
        installedAt: new Date().toISOString(),
        source: providerName,
        description: remote.description,
        fileCount: files.length,
      });
      updateLockEntry(skillName, remote.version, providerName, files);
      updatedList.push(skillName);
    } catch (err) {
      failedList.push(skillName);
      if (err instanceof Error && !json) console.error(ui.dim(`  Failed to update ${skillName}: ${err.message}`));
    }
  }

  if (dryRun) {
    if (json) {
      console.log(
        JSON.stringify({ dryRun: true, wouldUpdate: dryRunUpdates, upToDate: upToDateList, failed: failedList }),
      );
    } else {
      s.stop();
      if (dryRunUpdates.length === 0) {
        console.log(ui.dim("  All skills are up to date."));
      } else {
        for (const u of dryRunUpdates) {
          console.log(`  ${ui.bold(u.name)}: v${u.from} -> v${u.to}`);
        }
      }
      console.log();
    }
    return;
  }

  if (json) {
    console.log(JSON.stringify({ updated: updatedList, upToDate: upToDateList, failed: failedList }));
  } else {
    s.succeed(`Update complete`);
    console.log(
      ui.dim(
        `  ${updatedList.length} updated, ${upToDateList.length} up to date${failedList.length > 0 ? `, ${failedList.length} failed` : ""}`,
      ),
    );
    console.log();
  }
  if (failedList.length > 0) process.exit(1);
}

async function updateAll(installDir: string, providerName: string, json?: boolean, dryRun?: boolean): Promise<void> {
  const installed = readdirSync(installDir).filter((d) => statSync(join(installDir, d)).isDirectory());

  if (installed.length === 0) {
    if (json) {
      console.log(JSON.stringify({ updated: [], upToDate: [], failed: [] }));
    } else {
      console.log(ui.dim("  No skills installed."));
      console.log();
    }
    return;
  }

  const s = json ? noopSpinner() : spinner(`Checking ${installed.length} skills for updates...`);
  s.start();

  const updatedList: string[] = [];
  const upToDateList: string[] = [];
  const failedList: string[] = [];
  const skippedList: string[] = [];
  const dryRunUpdates: { name: string; from: string; to: string }[] = [];

  const providers = getProviders(providerName === "arcana" ? undefined : providerName);

  // Pre-fetch skill lists to avoid N+1 info() calls
  const providerSkillMaps = new Map<string, Map<string, { version: string; description: string }>>();
  for (const provider of providers) {
    try {
      const skills = await provider.list();
      const map = new Map<string, { version: string; description: string }>();
      for (const skill of skills) {
        map.set(skill.name, { version: skill.version, description: skill.description });
      }
      providerSkillMaps.set(provider.name, map);
    } catch (err) {
      if (err instanceof Error && !json) console.error(ui.dim(`  Failed to list ${provider.name}: ${err.message}`));
    }
  }

  const total = installed.length;
  for (let i = 0; i < total; i++) {
    const skillName = installed[i]!;
    let found = false;

    try {
      for (const provider of providers) {
        const skillMap = providerSkillMaps.get(provider.name);
        const remote = skillMap?.get(skillName) ?? null;
        if (!remote) continue;
        found = true;

        const meta = readSkillMeta(skillName);
        if (!isNewer(remote.version, meta?.version)) {
          upToDateList.push(skillName);
          break;
        }

        if (dryRun) {
          dryRunUpdates.push({ name: skillName, from: meta?.version ?? "unknown", to: remote.version });
          break;
        }

        s.text = `Updating ${ui.bold(skillName)} (${i + 1}/${total})...`;
        const files = await provider.fetch(skillName);
        installSkill(skillName, files);
        writeSkillMeta(skillName, {
          version: remote.version,
          installedAt: new Date().toISOString(),
          source: provider.name,
          description: remote.description,
          fileCount: files.length,
        });
        updateLockEntry(skillName, remote.version, provider.name, files);
        updatedList.push(skillName);
        break;
      }
    } catch (err) {
      failedList.push(skillName);
      if (err instanceof Error && !json) console.error(ui.dim(`  Failed to update ${skillName}: ${err.message}`));
      continue;
    }

    if (!found) skippedList.push(skillName);
  }

  if (dryRun) {
    if (json) {
      console.log(
        JSON.stringify({
          dryRun: true,
          wouldUpdate: dryRunUpdates,
          upToDate: upToDateList,
          skipped: skippedList,
          failed: failedList,
        }),
      );
    } else {
      s.stop();
      if (dryRunUpdates.length === 0) {
        console.log(ui.dim("  All skills are up to date."));
      } else {
        console.log(ui.bold(`  ${dryRunUpdates.length} of ${total} skills have updates available:`));
        console.log();
        for (const u of dryRunUpdates) {
          console.log(`  ${ui.bold(u.name)}: v${u.from} -> v${u.to}`);
        }
      }
      console.log();
    }
    return;
  }

  if (json) {
    console.log(
      JSON.stringify({ updated: updatedList, upToDate: upToDateList, skipped: skippedList, failed: failedList }),
    );
  } else {
    s.succeed(`Update complete`);
    console.log(
      ui.dim(
        `  ${updatedList.length} updated, ${upToDateList.length} up to date${skippedList.length > 0 ? `, ${skippedList.length} skipped (not on provider)` : ""}${failedList.length > 0 ? `, ${failedList.length} failed` : ""}`,
      ),
    );
    console.log();
  }
  if (failedList.length > 0) process.exit(1);
}
