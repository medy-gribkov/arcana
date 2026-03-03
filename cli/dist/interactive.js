import { existsSync, readdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import semver from "semver";
import { renderBanner } from "./utils/help.js";
import { ui } from "./utils/ui.js";
import { getProvider, getProviders } from "./registry.js";
import { isSkillInstalled, readSkillMeta, installSkill, writeSkillMeta, getInstallDir, getSkillDir, } from "./utils/fs.js";
import { loadConfig } from "./utils/config.js";
import { runDoctorChecks } from "./commands/doctor.js";
import { removeSymlinksFor } from "./commands/uninstall.js";
import { appendHistory } from "./utils/history.js";
import { clearProviderCache } from "./registry.js";
const AMBER = chalk.hex("#d4943a");
// ---------------------------------------------------------------------------
// Category map (7 categories, 4-12 skills each, no orphans)
// ---------------------------------------------------------------------------
const SKILL_CATEGORIES = {
    "Code Quality & Review": [
        "code-reviewer",
        "codebase-dissection",
        "testing-strategy",
        "refactoring-patterns",
        "git-workflow",
        "pre-production-review",
        "frontend-code-review",
        "dependency-audit",
        "performance-optimization",
    ],
    "Security & Infrastructure": [
        "security-review",
        "local-security",
        "container-security",
        "docker-kubernetes",
        "ci-cd-pipelines",
        "ci-cd-automation",
        "monitoring-observability",
        "incident-response",
    ],
    "Languages & Frameworks": [
        "golang-pro",
        "go-linter-configuration",
        "typescript",
        "typescript-advanced",
        "python-best-practices",
        "rust-best-practices",
        "frontend-design",
        "fullstack-developer",
        "remotion-best-practices",
        "npm-package",
    ],
    "API, Data & Docs": [
        "api-design",
        "api-testing",
        "programming-architecture",
        "database-design",
        "env-config",
        "cost-optimization",
        "docx",
        "xlsx",
        "doc-generation",
        "update-docs",
    ],
    "Game Design & Production": [
        "game-design-theory",
        "game-engines",
        "game-programming-languages",
        "gameplay-mechanics",
        "level-design",
        "game-tools-workflows",
        "game-servers",
        "networking-servers",
        "synchronization-algorithms",
        "monetization-systems",
        "publishing-platforms",
        "daw-music",
    ],
    "Graphics, Audio & Performance": [
        "graphics-rendering",
        "shader-techniques",
        "particle-systems",
        "audio-systems",
        "asset-optimization",
        "optimization-performance",
        "memory-management",
    ],
    "Skill Development": ["skill-creation-guide", "skill-creator", "find-skills", "project-migration"],
};
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function cancelAndExit() {
    clearProviderCache();
    p.cancel("Goodbye.");
    process.exit(0);
}
function handleCancel(value) {
    if (p.isCancel(value))
        cancelAndExit();
}
function countInstalled() {
    const dir = getInstallDir();
    if (!existsSync(dir))
        return 0;
    return readdirSync(dir).filter((d) => {
        try {
            return statSync(join(dir, d)).isDirectory();
        }
        catch {
            return false;
        }
    }).length;
}
function truncate(str, max) {
    return str.length > max ? str.slice(0, max) + "..." : str;
}
function getCategoryFor(skillName) {
    for (const [cat, skills] of Object.entries(SKILL_CATEGORIES)) {
        if (skills.includes(skillName))
            return cat;
    }
    return undefined;
}
function getRelatedSkills(skillName, limit = 3) {
    const cat = getCategoryFor(skillName);
    if (!cat)
        return [];
    return (SKILL_CATEGORIES[cat] ?? []).filter((s) => s !== skillName && !isSkillInstalled(s)).slice(0, limit);
}
function getInstalledNames() {
    const dir = getInstallDir();
    if (!existsSync(dir))
        return [];
    return readdirSync(dir)
        .filter((d) => {
        try {
            return statSync(join(dir, d)).isDirectory();
        }
        catch {
            return false;
        }
    })
        .sort();
}
function buildMenuOptions(installedCount, _availableCount) {
    const isNew = installedCount === 0;
    const options = [];
    if (isNew) {
        options.push({ value: "setup", label: AMBER("Get Started"), hint: "detect project, install recommended skills" });
    }
    else {
        options.push({ value: "installed", label: "Manage installed skills", hint: `${installedCount} installed` });
    }
    options.push({ value: "browse", label: "Browse skills by category" });
    options.push({ value: "search", label: "Search for a skill" });
    if (!isNew) {
        options.push({ value: "setup", label: "Get Started", hint: "detect project, add more skills" });
    }
    options.push({ value: "health", label: "Check environment health" });
    options.push({ value: "ref", label: "CLI reference" });
    options.push({ value: "exit", label: "Exit" });
    return options;
}
// ---------------------------------------------------------------------------
// Atomic operations
// ---------------------------------------------------------------------------
async function doInstall(skillName, providerName) {
    const provider = getProvider(providerName);
    const s = p.spinner();
    s.start(`Installing ${chalk.bold(skillName)}...`);
    try {
        const files = await provider.fetch(skillName);
        installSkill(skillName, files);
        const remote = await provider.info(skillName);
        writeSkillMeta(skillName, {
            version: remote?.version ?? "0.0.0",
            installedAt: new Date().toISOString(),
            source: providerName,
            description: remote?.description,
            fileCount: files.length,
            sizeBytes: files.reduce((s2, f) => s2 + f.content.length, 0),
        });
        s.stop(`Installed ${chalk.bold(skillName)} (${files.length} files)`);
        appendHistory("install", skillName);
        return true;
    }
    catch (err) {
        s.stop(`Failed to install ${skillName}`);
        if (err instanceof Error)
            p.log.error(ui.dim(err.message));
        return false;
    }
}
async function doBatchInstall(names, providerName) {
    if (names.length === 0)
        return 0;
    const provider = getProvider(providerName);
    const s = p.spinner();
    s.start(`Installing ${names.length} skill${names.length > 1 ? "s" : ""}...`);
    let installed = 0;
    for (const name of names) {
        try {
            s.message(`Installing ${chalk.bold(name)} (${installed + 1}/${names.length})...`);
            const files = await provider.fetch(name);
            installSkill(name, files);
            const remote = await provider.info(name);
            writeSkillMeta(name, {
                version: remote?.version ?? "0.0.0",
                installedAt: new Date().toISOString(),
                source: providerName,
                description: remote?.description,
                fileCount: files.length,
                sizeBytes: files.reduce((s2, f) => s2 + f.content.length, 0),
            });
            installed++;
        }
        catch (err) {
            s.stop(`Failed: ${name}`);
            if (err instanceof Error)
                p.log.error(ui.dim(err.message));
            if (installed + 1 < names.length)
                s.start(`Installing next...`);
        }
    }
    s.stop(`Installed ${installed} skill${installed !== 1 ? "s" : ""}`);
    return installed;
}
function doUninstall(skillName) {
    const skillDir = getSkillDir(skillName);
    if (!existsSync(skillDir))
        return false;
    try {
        rmSync(skillDir, { recursive: true, force: true });
        removeSymlinksFor(skillName);
        appendHistory("uninstall", skillName);
        return true;
    }
    catch {
        return false;
    }
}
// ---------------------------------------------------------------------------
// Skill Detail View (central action point)
// ---------------------------------------------------------------------------
async function skillDetailFlow(skillName, allSkills, providerName) {
    const info = allSkills.find((s) => s.name === skillName);
    const installed = isSkillInstalled(skillName);
    const meta = installed ? readSkillMeta(skillName) : null;
    // Build info block
    const lines = [];
    lines.push(`${chalk.bold(skillName)} ${info ? `v${info.version}` : ""}`);
    if (info?.description)
        lines.push(info.description);
    lines.push("");
    const category = getCategoryFor(skillName);
    if (category)
        lines.push(`Category: ${category}`);
    if (info?.source)
        lines.push(`Source: ${info.source}`);
    if (installed && meta) {
        const date = meta.installedAt ? new Date(meta.installedAt).toLocaleDateString() : "";
        lines.push(`Status: ${chalk.green("installed")} (v${meta.version}${date ? `, ${date}` : ""})`);
    }
    else {
        lines.push(`Status: ${chalk.dim("not installed")}`);
    }
    const related = getRelatedSkills(skillName);
    if (related.length > 0) {
        lines.push(`Related: ${related.join(", ")}`);
    }
    p.note(lines.join("\n"), skillName);
    // Action menu
    const actions = [];
    if (installed) {
        actions.push({ value: "reinstall", label: "Reinstall (overwrite)" });
        actions.push({ value: "uninstall", label: "Uninstall (remove files)" });
    }
    else {
        actions.push({ value: "install", label: "Install this skill" });
    }
    actions.push({ value: "back", label: "Back" });
    const action = await p.select({ message: "Action", options: actions });
    handleCancel(action);
    switch (action) {
        case "install":
        case "reinstall": {
            await doInstall(skillName, providerName);
            return "back";
        }
        case "uninstall": {
            const ok = await p.confirm({ message: `Uninstall ${chalk.bold(skillName)}?` });
            handleCancel(ok);
            if (ok) {
                const success = doUninstall(skillName);
                if (success) {
                    p.log.success(`Removed ${chalk.bold(skillName)}`);
                }
                else {
                    p.log.error(`Failed to remove ${skillName}`);
                }
            }
            return "back";
        }
        default:
            return "back";
    }
}
// ---------------------------------------------------------------------------
// Browse by Category
// ---------------------------------------------------------------------------
async function browseByCategory(allSkills, providerName) {
    const availableNames = new Set(allSkills.map((s) => s.name));
    while (true) {
        const categoryOptions = Object.entries(SKILL_CATEGORIES).map(([name, skills]) => {
            const valid = skills.filter((s) => availableNames.has(s));
            const installedCount = valid.filter((s) => isSkillInstalled(s)).length;
            return {
                value: name,
                label: name,
                hint: `${valid.length} skills, ${installedCount} installed`,
            };
        });
        const category = await p.select({
            message: "Browse by category",
            options: [...categoryOptions, { value: "__back", label: "Back" }],
        });
        handleCancel(category);
        if (category === "__back")
            return;
        await categorySkillList(category, SKILL_CATEGORIES[category] ?? [], allSkills, providerName);
    }
}
async function categorySkillList(categoryName, skillNames, allSkills, providerName) {
    const availableNames = new Set(allSkills.map((s) => s.name));
    const validSkills = skillNames.filter((s) => availableNames.has(s));
    if (validSkills.length === 0) {
        p.log.warn("No skills found in this category.");
        return;
    }
    while (true) {
        const options = validSkills.map((name) => {
            const info = allSkills.find((s) => s.name === name);
            const installed = isSkillInstalled(name);
            return {
                value: name,
                label: `${name}${installed ? chalk.green(" \u2713") : ""}`,
                hint: truncate(info?.description ?? "", 50),
            };
        });
        const notInstalled = validSkills.filter((s) => !isSkillInstalled(s));
        const extraOptions = [];
        if (notInstalled.length > 0) {
            extraOptions.push({
                value: "__install_all",
                label: `Install all uninstalled`,
                hint: `${notInstalled.length} skill${notInstalled.length > 1 ? "s" : ""}`,
            });
        }
        extraOptions.push({ value: "__back", label: "Back to categories" });
        const picked = await p.select({
            message: `${categoryName} (${validSkills.length} skills)`,
            options: [...options, ...extraOptions],
        });
        handleCancel(picked);
        if (picked === "__back")
            return;
        if (picked === "__install_all") {
            await doBatchInstall(notInstalled, providerName);
            continue;
        }
        const result = await skillDetailFlow(picked, allSkills, providerName);
        if (result === "menu")
            return;
    }
}
// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
async function searchFlow(allSkills, providerName) {
    while (true) {
        const query = await p.text({
            message: "Search for:",
            placeholder: "e.g. testing, review, golang",
            validate: (v) => (!v || v.trim().length === 0 ? "Enter a search term" : undefined),
        });
        handleCancel(query);
        const provider = getProvider(providerName);
        const s = p.spinner();
        s.start(`Searching "${query}"...`);
        let results;
        try {
            results = await provider.search(query);
        }
        catch (err) {
            s.stop("Search failed");
            if (err instanceof Error)
                p.log.error(ui.dim(err.message));
            return;
        }
        s.stop(`${results.length} result${results.length !== 1 ? "s" : ""}`);
        appendHistory("search", query);
        if (results.length === 0) {
            p.log.info("No skills matched. Try a different query.");
            const again = await p.confirm({ message: "Search again?" });
            handleCancel(again);
            if (!again)
                return;
            continue;
        }
        const nav = await searchResultsPicker(results, allSkills, providerName);
        if (nav === "done")
            return;
        // "search" continues the loop
    }
}
async function searchResultsPicker(results, allSkills, providerName) {
    while (true) {
        const options = results.map((skill) => ({
            value: skill.name,
            label: `${skill.name}${isSkillInstalled(skill.name) ? chalk.green(" \u2713") : ""}`,
            hint: truncate(skill.description, 50),
        }));
        const picked = await p.select({
            message: "Pick a skill for details",
            options: [...options, { value: "__search", label: "Search again" }, { value: "__back", label: "Back" }],
        });
        handleCancel(picked);
        if (picked === "__search")
            return "search";
        if (picked === "__back")
            return "done";
        const result = await skillDetailFlow(picked, allSkills, providerName);
        if (result === "menu")
            return "done";
    }
}
// ---------------------------------------------------------------------------
// Quick Setup / Get Started
// ---------------------------------------------------------------------------
async function quickSetup(allSkills, providerName) {
    const { detectProject, SKILL_SUGGESTIONS, SKILL_SUGGESTIONS_DEFAULT } = await import("./commands/init.js");
    const proj = detectProject(process.cwd());
    p.log.step(`Detected: ${chalk.cyan(proj.name)} (${proj.type})`);
    const suggestions = SKILL_SUGGESTIONS[proj.type] ?? SKILL_SUGGESTIONS_DEFAULT;
    const availableNames = new Set(allSkills.map((s) => s.name));
    const validSuggestions = suggestions.filter((s) => availableNames.has(s));
    if (validSuggestions.length === 0) {
        p.log.info("No specific recommendations for this project type.");
        return;
    }
    const notInstalled = validSuggestions.filter((s) => !isSkillInstalled(s));
    if (notInstalled.length === 0) {
        p.log.success("All recommended skills are already installed.");
        return;
    }
    const options = validSuggestions.map((name) => {
        const installed = isSkillInstalled(name);
        return {
            value: name,
            label: `${name}${installed ? chalk.green(" \u2713 installed") : ""}`,
            hint: installed ? "already installed" : "not installed",
        };
    });
    const selected = await p.multiselect({
        message: `Recommended skills for ${proj.type}`,
        options,
        required: false,
    });
    handleCancel(selected);
    const toInstall = selected.filter((s) => !isSkillInstalled(s));
    if (toInstall.length > 0) {
        await doBatchInstall(toInstall, providerName);
    }
    else if (selected.length > 0) {
        p.log.info("All selected skills are already installed.");
    }
    if (!existsSync(join(process.cwd(), "CLAUDE.md"))) {
        p.log.info(`Tip: Run ${chalk.cyan("arcana init")} to create project config files.`);
    }
}
// ---------------------------------------------------------------------------
// Manage Installed Skills
// ---------------------------------------------------------------------------
async function manageInstalled(allSkills, providerName) {
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
            message: `Installed skills (${names.length})`,
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
            message: `${categoryName} (${stillInstalled.length} installed)`,
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
        if (doUninstall(name))
            removed++;
    }
    p.log.success(`Removed ${removed} skill${removed !== 1 ? "s" : ""}`);
}
// ---------------------------------------------------------------------------
// Update All (called from Manage Installed)
// ---------------------------------------------------------------------------
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
            updated++;
        }
        catch (err) {
            if (err instanceof Error)
                p.log.error(`Failed to update ${u.name}: ${err.message}`);
        }
    }
    spin.stop(`Updated ${updated} skill${updated !== 1 ? "s" : ""}`);
}
// ---------------------------------------------------------------------------
// Check Environment Health
// ---------------------------------------------------------------------------
async function checkHealth() {
    const checks = runDoctorChecks();
    p.log.step(chalk.bold("Environment Health Check"));
    for (const check of checks) {
        const icon = check.status === "pass" ? chalk.green("OK") : check.status === "warn" ? chalk.yellow("!!") : chalk.red("XX");
        p.log.info(`${icon}  ${chalk.bold(check.name)}: ${check.message}`);
        if (check.fix)
            p.log.info(chalk.dim(`    Fix: ${check.fix}`));
    }
    const fails = checks.filter((c) => c.status === "fail").length;
    const warns = checks.filter((c) => c.status === "warn").length;
    if (fails > 0) {
        p.log.error(`${fails} issue${fails > 1 ? "s" : ""} found`);
    }
    else if (warns > 0) {
        p.log.warn(`${warns} warning${warns > 1 ? "s" : ""}`);
    }
    else {
        p.log.success("All checks passed");
        return;
    }
    // Offer fixes once - no loop. User can re-enter health check to verify.
    const fixChecks = checks.filter((c) => c.fix && c.status !== "pass");
    if (fixChecks.length === 0)
        return;
    const fixOptions = fixChecks.map((c) => {
        const cmd = c.fix.replace(/^Run:\s*/, "");
        return { value: cmd, label: `Run: ${cmd}`, hint: c.name };
    });
    const fixAction = await p.select({
        message: "Run a fix?",
        options: [...fixOptions, { value: "__skip", label: "Skip" }],
    });
    handleCancel(fixAction);
    if (fixAction !== "__skip") {
        const cmd = fixAction;
        const SAFE_PREFIXES = ["arcana ", "git config "];
        if (!SAFE_PREFIXES.some((pre) => cmd.startsWith(pre))) {
            p.log.warn(`Skipped unsafe command: ${cmd}`);
        }
        else {
            p.log.info(chalk.dim(`Running: ${cmd}`));
            try {
                const { execSync } = await import("node:child_process");
                execSync(cmd, { stdio: "inherit" });
            }
            catch {
                // Non-zero exit expected for some commands
            }
        }
        p.log.info(chalk.dim("Run health check again to verify."));
    }
}
// ---------------------------------------------------------------------------
// Show CLI Reference
// ---------------------------------------------------------------------------
function showCliReference() {
    const ref = [
        "arcana list [--installed] [--all]",
        "arcana search <query>",
        "arcana install <skill> [--all] [--force]",
        "arcana uninstall <skill> [--yes]",
        "arcana update [--all] [--dry-run]",
        "arcana info <skill>",
        "arcana init [--tool <name>]",
        "arcana create <name>",
        "arcana validate [--all] [--fix]",
        "arcana scan [skill] [--all] [--json]",
        "arcana audit [--all]",
        "arcana config [key] [value]",
        "arcana providers [--add owner/repo]",
        "arcana doctor",
        "arcana clean [--dry-run]",
        "arcana stats",
    ].join("\n");
    p.note(ref, "CLI Reference");
}
// ---------------------------------------------------------------------------
// Main session loop
// ---------------------------------------------------------------------------
export async function showInteractiveMenu(version) {
    const config = loadConfig();
    const providerName = config.defaultProvider;
    // Fetch skill list once for the session
    const allSkills = [];
    let availableCount = 0;
    try {
        const providers = getProviders();
        for (const provider of providers) {
            const skills = await provider.list();
            allSkills.push(...skills);
        }
        availableCount = allSkills.length;
    }
    catch {
        // Offline mode
    }
    // Banner (shown once)
    const installedOnEntry = countInstalled();
    console.log();
    console.log(renderBanner());
    console.log();
    console.log(`  ${AMBER.bold("arcana")} ${chalk.dim(`v${version}`)}`);
    console.log(`  ${chalk.dim("Expert skills for AI coding agents. Install what you need.")}`);
    console.log();
    if (availableCount > 0 && installedOnEntry > 0) {
        if (installedOnEntry > availableCount) {
            // More installed than in marketplace (local test skills, etc.)
            console.log(`  ${chalk.dim(`${installedOnEntry} installed (${availableCount} in marketplace) | provider: ${providerName}`)}`);
        }
        else {
            const pct = Math.round((installedOnEntry / availableCount) * 100);
            console.log(`  ${chalk.dim(`${installedOnEntry}/${availableCount} installed (${pct}%) | provider: ${providerName}`)}`);
        }
    }
    else if (availableCount > 0) {
        console.log(`  ${chalk.dim(`${availableCount} skills across ${Object.keys(SKILL_CATEGORIES).length} categories`)}`);
    }
    else {
        console.log(`  ${chalk.dim(`${installedOnEntry} installed | offline mode`)}`);
    }
    console.log();
    // First-time guided setup
    if (installedOnEntry === 0 && availableCount > 0) {
        const wantsSetup = await p.confirm({
            message: "First time? Let's find the right skills for your project.",
            initialValue: true,
        });
        if (!p.isCancel(wantsSetup) && wantsSetup) {
            await quickSetup(allSkills, providerName);
        }
    }
    // Main loop - simple re-render, no double menus
    while (true) {
        const installedCount = countInstalled();
        const options = buildMenuOptions(installedCount, availableCount);
        const selected = await p.select({
            message: "What would you like to do?",
            options,
        });
        if (p.isCancel(selected) || selected === "exit") {
            clearProviderCache();
            p.outro(chalk.dim("Until next time."));
            return;
        }
        console.log();
        try {
            switch (selected) {
                case "browse":
                    await browseByCategory(allSkills, providerName);
                    break;
                case "search":
                    await searchFlow(allSkills, providerName);
                    break;
                case "setup":
                    await quickSetup(allSkills, providerName);
                    break;
                case "installed":
                    await manageInstalled(allSkills, providerName);
                    break;
                case "health":
                    await checkHealth();
                    break;
                case "ref":
                    showCliReference();
                    break;
            }
        }
        catch (err) {
            if (err instanceof Error) {
                p.log.error(err.message);
            }
        }
    }
}
