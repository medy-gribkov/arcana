import * as p from "@clack/prompts";
import chalk from "chalk";
import semver from "semver";
import { isSkillInstalled, readSkillMeta, installSkill, writeSkillMeta } from "../utils/fs.js";
import { getProvider } from "../registry.js";
import { ui } from "../utils/ui.js";
import { updateLockEntry } from "../utils/integrity.js";
import { handleCancel, getInstalledNames } from "./helpers.js";
import { SKILL_CATEGORIES } from "./categories.js";
import { skillDetailFlow, doUninstall } from "./skill-detail.js";
export async function manageInstalled(allSkills, providerName) {
    while (true) {
        const names = getInstalledNames();
        if (names.length === 0) {
            p.log.info("No skills installed.");
            return;
        }
        // Group installed skills by category
        const groups = [];
        const categorized = new Set();
        for (const [cat, catSkills] of Object.entries(SKILL_CATEGORIES)) {
            const installed = catSkills.filter((s) => names.includes(s));
            if (installed.length > 0) {
                groups.push({ cat, skills: installed });
                installed.forEach((s) => categorized.add(s));
            }
        }
        const uncategorized = names.filter((s) => !categorized.has(s));
        if (uncategorized.length > 0) {
            groups.push({ cat: "Other", skills: uncategorized });
        }
        const options = groups.map((g) => ({
            value: g.cat,
            label: g.cat,
            hint: `${g.skills.length} installed`,
        }));
        const picked = await p.select({
            message: `Your skills > Select category`,
            options: [
                ...options,
                { value: "__update", label: chalk.cyan("Check for updates") },
                { value: "__bulk_uninstall", label: "Uninstall multiple..." },
                { value: "__back", label: "Back" },
            ],
        });
        handleCancel(picked);
        if (picked === "__back")
            return;
        if (picked === "__update") {
            await updateAll(providerName);
            continue;
        }
        if (picked === "__bulk_uninstall") {
            await bulkUninstall(names);
            continue;
        }
        const group = groups.find((g) => g.cat === picked);
        if (group) {
            await installedCategoryList(group.cat, group.skills, allSkills, providerName);
        }
    }
}
async function installedCategoryList(categoryName, installedNames, allSkills, providerName) {
    while (true) {
        const stillInstalled = installedNames.filter((s) => isSkillInstalled(s));
        if (stillInstalled.length === 0) {
            p.log.info("No skills remaining in this category.");
            return;
        }
        const options = stillInstalled.map((name) => {
            const meta = readSkillMeta(name);
            const ver = meta ? `v${meta.version}` : "";
            const date = meta?.installedAt ? new Date(meta.installedAt).toLocaleDateString() : "";
            return {
                value: name,
                label: name,
                hint: `${ver}${date ? `  ${date}` : ""}`,
            };
        });
        const picked = await p.select({
            message: `Your skills > ${categoryName}`,
            options: [...options, { value: "__back", label: "Back" }],
        });
        handleCancel(picked);
        if (picked === "__back")
            return;
        const result = await skillDetailFlow(picked, allSkills, providerName);
        if (result === "menu")
            return;
    }
}
async function bulkUninstall(installedNames) {
    const selected = await p.multiselect({
        message: "Select skills to uninstall",
        options: installedNames.map((name) => ({ value: name, label: name })),
        required: false,
        maxItems: 15,
    });
    handleCancel(selected);
    const names = selected;
    if (names.length === 0)
        return;
    const ok = await p.confirm({
        message: `Uninstall ${names.length} skill${names.length > 1 ? "s" : ""}?`,
    });
    handleCancel(ok);
    if (!ok)
        return;
    let removed = 0;
    for (const name of names) {
        if (doUninstall(name).success)
            removed++;
    }
    p.log.success(`Removed ${removed} skill${removed !== 1 ? "s" : ""}`);
}
async function updateAll(providerName) {
    const installed = getInstalledNames();
    if (installed.length === 0) {
        p.log.info("No skills installed.");
        return;
    }
    const s = p.spinner();
    s.start(`Checking ${installed.length} skill${installed.length !== 1 ? "s" : ""} for updates...`);
    const provider = getProvider(providerName);
    let remoteSkills;
    try {
        remoteSkills = await provider.list();
    }
    catch (err) {
        s.stop("Failed to fetch remote skill list");
        if (err instanceof Error)
            p.log.error(ui.dim(err.message));
        return;
    }
    const remoteMap = new Map(remoteSkills.map((rs) => [rs.name, rs]));
    const updates = [];
    for (const name of installed) {
        const remote = remoteMap.get(name);
        if (!remote)
            continue;
        const meta = readSkillMeta(name);
        const localVer = semver.valid(semver.coerce(meta?.version)) ?? "0.0.0";
        const remoteVer = semver.valid(semver.coerce(remote.version)) ?? "0.0.0";
        if (semver.gt(remoteVer, localVer)) {
            updates.push({ name, from: meta?.version ?? "0.0.0", to: remote.version });
        }
    }
    s.stop(`Checked ${installed.length} skills`);
    if (updates.length === 0) {
        p.log.success("All skills are up to date.");
        return;
    }
    p.log.step(`${updates.length} update${updates.length !== 1 ? "s" : ""} available:`);
    for (const u of updates) {
        p.log.info(`  ${chalk.bold(u.name)}: v${u.from} -> v${u.to}`);
    }
    const ok = await p.confirm({ message: "Apply updates?" });
    handleCancel(ok);
    if (!ok)
        return;
    const spin = p.spinner();
    spin.start("Updating...");
    let updated = 0;
    for (const u of updates) {
        try {
            spin.message(`Updating ${chalk.bold(u.name)}...`);
            const files = await provider.fetch(u.name);
            installSkill(u.name, files);
            const remote = remoteMap.get(u.name);
            writeSkillMeta(u.name, {
                version: remote.version,
                installedAt: new Date().toISOString(),
                source: providerName,
                description: remote.description,
                fileCount: files.length,
                sizeBytes: files.reduce((s2, f) => s2 + f.content.length, 0),
            });
            updateLockEntry(u.name, remote.version, providerName, files);
            updated++;
        }
        catch (err) {
            if (err instanceof Error)
                p.log.error(`Failed to update ${u.name}: ${err.message}`);
        }
    }
    spin.stop(`Updated ${updated} skill${updated !== 1 ? "s" : ""}`);
}
