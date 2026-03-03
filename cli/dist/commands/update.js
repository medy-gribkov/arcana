import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import semver from "semver";
import { getInstallDir, installSkill, readSkillMeta, writeSkillMeta } from "../utils/fs.js";
import { getProvider, getProviders } from "../registry.js";
import { ui, banner, spinner, noopSpinner } from "../utils/ui.js";
import { loadConfig } from "../utils/config.js";
import { validateSlug } from "../utils/validate.js";
import { updateLockEntry } from "../utils/integrity.js";
function isNewer(remoteVersion, localVersion) {
    const local = semver.valid(semver.coerce(localVersion)) ?? "0.0.0";
    const remote = semver.valid(semver.coerce(remoteVersion)) ?? "0.0.0";
    return semver.gt(remote, local);
}
/** Fetch, write files, write meta, update lock for a single skill. */
async function applyUpdate(skillName, remote, provider) {
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
    return files;
}
export async function updateCommand(skills, opts) {
    if (!opts.json)
        banner();
    if (skills.length === 0 && !opts.all) {
        if (opts.json) {
            console.log(JSON.stringify({ error: "Specify a skill name or use --all" }));
        }
        else {
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
        }
        else {
            console.log(ui.dim("  No skills installed."));
            console.log();
        }
        return;
    }
    const providerName = opts.provider ?? loadConfig().defaultProvider;
    if (opts.all) {
        await updateBatch(null, installDir, providerName, opts.json, opts.dryRun);
    }
    else if (skills.length === 1) {
        await updateOne(skills[0], installDir, providerName, opts.json, opts.dryRun);
    }
    else {
        await updateBatch(skills, installDir, providerName, opts.json, opts.dryRun);
    }
}
async function updateOne(skillName, installDir, providerName, json, dryRun) {
    try {
        validateSlug(skillName, "skill name");
    }
    catch (err) {
        if (json) {
            console.log(JSON.stringify({
                updated: [],
                upToDate: [],
                failed: [skillName],
                error: err instanceof Error ? err.message : "Invalid name",
            }));
        }
        else {
            console.log(ui.error(`  ${err instanceof Error ? err.message : "Invalid skill name"}`));
            console.log();
        }
        process.exit(1);
    }
    const skillDir = join(installDir, skillName);
    if (!existsSync(skillDir)) {
        if (json) {
            console.log(JSON.stringify({ updated: [], upToDate: [], failed: [skillName], error: "Not installed" }));
        }
        else {
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
                console.log(JSON.stringify({ updated: [], upToDate: [], failed: [skillName], error: `Not found on ${providerName}` }));
            }
            else {
                s.fail(`Skill "${skillName}" not found on ${providerName}`);
                console.log();
            }
            process.exit(1);
        }
        const meta = readSkillMeta(skillName);
        if (!isNewer(remote.version, meta?.version)) {
            if (json) {
                console.log(JSON.stringify({ updated: [], upToDate: [skillName], failed: [] }));
            }
            else {
                s.info(`${ui.bold(skillName)} is already up to date (v${remote.version})`);
                console.log();
            }
            return;
        }
        if (dryRun) {
            if (json) {
                console.log(JSON.stringify({
                    dryRun: true,
                    wouldUpdate: [{ name: skillName, from: meta?.version ?? "unknown", to: remote.version }],
                }));
            }
            else {
                s.info(`${ui.bold(skillName)} would be updated: v${meta?.version ?? "unknown"} -> v${remote.version}`);
                console.log();
            }
            return;
        }
        s.text = `Updating ${ui.bold(skillName)}...`;
        const files = await applyUpdate(skillName, remote, provider);
        if (json) {
            console.log(JSON.stringify({ updated: [skillName], upToDate: [], failed: [] }));
        }
        else {
            s.succeed(`Updated ${ui.bold(skillName)} to v${remote.version} (${files.length} files)`);
            console.log();
        }
    }
    catch (err) {
        if (json) {
            console.log(JSON.stringify({
                updated: [],
                upToDate: [],
                failed: [skillName],
                error: err instanceof Error ? err.message : "Update failed",
            }));
        }
        else {
            s.fail(`Failed to update ${skillName}`);
            if (err instanceof Error)
                console.error(ui.dim(`  ${err.message}`));
            console.log();
        }
        process.exit(1);
    }
}
/**
 * Batch update. If `skillNames` is null, update all installed skills.
 * If `skillNames` is provided, update only those specific skills.
 */
async function updateBatch(skillNames, installDir, providerName, json, dryRun) {
    // Validate explicit skill names
    if (skillNames) {
        for (const name of skillNames) {
            try {
                validateSlug(name, "skill name");
            }
            catch (err) {
                if (json) {
                    console.log(JSON.stringify({
                        updated: [],
                        upToDate: [],
                        failed: skillNames,
                        error: err instanceof Error ? err.message : "Invalid name",
                    }));
                }
                else {
                    console.log(ui.error(`  ${err instanceof Error ? err.message : "Invalid skill name"}`));
                    console.log();
                }
                process.exit(1);
            }
        }
    }
    const installed = skillNames ?? readdirSync(installDir).filter((d) => statSync(join(installDir, d)).isDirectory());
    if (installed.length === 0) {
        if (json) {
            console.log(JSON.stringify({ updated: [], upToDate: [], failed: [] }));
        }
        else {
            console.log(ui.dim("  No skills installed."));
            console.log();
        }
        return;
    }
    const s = json ? noopSpinner() : spinner(`Checking ${installed.length} skills for updates...`);
    s.start();
    const updatedList = [];
    const upToDateList = [];
    const failedList = [];
    const skippedList = [];
    const dryRunUpdates = [];
    // For --all mode, use all providers and pre-fetch skill lists (avoids N+1 info() calls)
    // For explicit names, use single provider with per-skill info() calls
    const isAllMode = skillNames === null;
    const providers = isAllMode ? getProviders(providerName === "arcana" ? undefined : providerName) : [];
    const singleProvider = isAllMode ? null : getProvider(providerName);
    // Pre-fetch provider skill maps for --all mode
    const providerSkillMaps = new Map();
    if (isAllMode) {
        for (const provider of providers) {
            try {
                const skills = await provider.list();
                const map = new Map();
                for (const skill of skills) {
                    map.set(skill.name, { version: skill.version, description: skill.description });
                }
                providerSkillMaps.set(provider.name, map);
            }
            catch (err) {
                if (err instanceof Error && !json)
                    console.error(ui.dim(`  Failed to list ${provider.name}: ${err.message}`));
            }
        }
    }
    const total = installed.length;
    for (let i = 0; i < total; i++) {
        const name = installed[i];
        // Check installation exists (for explicit names)
        if (!isAllMode) {
            const skillDir = join(installDir, name);
            if (!existsSync(skillDir)) {
                failedList.push(name);
                if (!json)
                    console.error(ui.dim(`  ${name} is not installed`));
                continue;
            }
        }
        try {
            if (isAllMode) {
                // Find across all providers
                let found = false;
                for (const provider of providers) {
                    const skillMap = providerSkillMaps.get(provider.name);
                    const remote = skillMap?.get(name) ?? null;
                    if (!remote)
                        continue;
                    found = true;
                    const meta = readSkillMeta(name);
                    if (!isNewer(remote.version, meta?.version)) {
                        upToDateList.push(name);
                        break;
                    }
                    if (dryRun) {
                        dryRunUpdates.push({ name, from: meta?.version ?? "unknown", to: remote.version });
                        break;
                    }
                    s.text = `Updating ${ui.bold(name)} (${i + 1}/${total})...`;
                    await applyUpdate(name, remote, provider);
                    updatedList.push(name);
                    break;
                }
                if (!found)
                    skippedList.push(name);
            }
            else {
                // Single provider mode
                const remote = await singleProvider.info(name);
                if (!remote) {
                    failedList.push(name);
                    continue;
                }
                const meta = readSkillMeta(name);
                if (!isNewer(remote.version, meta?.version)) {
                    upToDateList.push(name);
                    continue;
                }
                if (dryRun) {
                    dryRunUpdates.push({ name, from: meta?.version ?? "unknown", to: remote.version });
                    continue;
                }
                s.text = `Updating ${ui.bold(name)} (${i + 1}/${total})...`;
                await applyUpdate(name, remote, singleProvider);
                updatedList.push(name);
            }
        }
        catch (err) {
            failedList.push(name);
            if (err instanceof Error && !json)
                console.error(ui.dim(`  Failed to update ${name}: ${err.message}`));
        }
    }
    // Output results
    if (dryRun) {
        if (json) {
            console.log(JSON.stringify({
                dryRun: true,
                wouldUpdate: dryRunUpdates,
                upToDate: upToDateList,
                ...(isAllMode ? { skipped: skippedList } : {}),
                failed: failedList,
            }));
        }
        else {
            s.stop();
            if (dryRunUpdates.length === 0) {
                console.log(ui.dim("  All skills are up to date."));
            }
            else {
                if (isAllMode) {
                    console.log(ui.bold(`  ${dryRunUpdates.length} of ${total} skills have updates available:`));
                    console.log();
                }
                for (const u of dryRunUpdates) {
                    console.log(`  ${ui.bold(u.name)}: v${u.from} -> v${u.to}`);
                }
            }
            console.log();
        }
        return;
    }
    if (json) {
        console.log(JSON.stringify({
            updated: updatedList,
            upToDate: upToDateList,
            ...(isAllMode ? { skipped: skippedList } : {}),
            failed: failedList,
        }));
    }
    else {
        s.succeed(`Update complete`);
        const parts = [`${updatedList.length} updated`, `${upToDateList.length} up to date`];
        if (skippedList.length > 0)
            parts.push(`${skippedList.length} skipped (not on provider)`);
        if (failedList.length > 0)
            parts.push(`${failedList.length} failed`);
        console.log(ui.dim(`  ${parts.join(", ")}`));
        console.log();
    }
    if (failedList.length > 0)
        process.exit(1);
}
