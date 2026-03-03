import { existsSync, rmSync } from "node:fs";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { isSkillInstalled, readSkillMeta, getSkillDir, getDirSize } from "../utils/fs.js";
import { appendHistory } from "../utils/history.js";
import { installOneCore } from "../utils/install-core.js";
import { backupSkill } from "../utils/backup.js";
import { removeSymlinksFor } from "../commands/uninstall.js";
import { ui } from "../utils/ui.js";
import { getProvider } from "../registry.js";
import { handleCancel } from "./helpers.js";
import { getCategoryFor, getRelatedSkills } from "./categories.js";
async function doInstall(skillName, providerName) {
    const provider = getProvider(providerName);
    const s = p.spinner();
    s.start(`Installing ${chalk.bold(skillName)}...`);
    try {
        const result = await installOneCore(skillName, provider, {});
        if (!result.success) {
            s.stop(`Failed to install ${skillName}`);
            if (result.error)
                p.log.error(ui.dim(result.error));
            return false;
        }
        s.stop(`Installed ${chalk.bold(skillName)} (${result.files?.length ?? 0} files)`);
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
function doUninstall(skillName) {
    const skillDir = getSkillDir(skillName);
    if (!existsSync(skillDir))
        return { success: false };
    try {
        const backupPath = backupSkill(skillName);
        rmSync(skillDir, { recursive: true, force: true });
        removeSymlinksFor(skillName);
        appendHistory("uninstall", skillName);
        return { success: true, backupPath: backupPath ?? undefined };
    }
    catch {
        return { success: false };
    }
}
function getTokenEstimate(skillName) {
    const dir = getSkillDir(skillName);
    if (!existsSync(dir))
        return { tokens: 0, kb: 0 };
    const bytes = getDirSize(dir);
    return { tokens: Math.round(bytes / 4), kb: Math.round(bytes / 1024) };
}
export async function skillDetailFlow(skillName, allSkills, providerName) {
    const info = allSkills.find((s) => s.name === skillName);
    const installed = isSkillInstalled(skillName);
    const meta = installed ? readSkillMeta(skillName) : null;
    // Build info block with visual hierarchy
    const lines = [];
    // Header
    lines.push(`${chalk.bold(skillName)} ${info ? chalk.dim(`v${info.version}`) : ""}`);
    if (info?.description)
        lines.push(chalk.dim(info.description));
    lines.push("");
    // Status (most important, shown first)
    if (installed && meta) {
        const date = meta.installedAt ? new Date(meta.installedAt).toLocaleDateString() : "";
        const est = getTokenEstimate(skillName);
        const tokenStr = est.tokens > 0 ? `  ~${(est.tokens / 1000).toFixed(1)}K tokens` : "";
        lines.push(`${chalk.green("Installed")}  v${meta.version}${date ? `  ${date}` : ""}${tokenStr}`);
    }
    else {
        lines.push(chalk.dim("Not installed"));
    }
    lines.push("");
    // Aligned metadata
    const metadata = [];
    if (info?.verified)
        metadata.push(["Trust", chalk.green("Verified (official)")]);
    else
        metadata.push(["Trust", "Community"]);
    if (info?.author)
        metadata.push(["Author", info.author]);
    if (info?.tags && info.tags.length > 0)
        metadata.push(["Tags", info.tags.join(", ")]);
    const category = getCategoryFor(skillName);
    if (category)
        metadata.push(["Category", category]);
    const maxLabel = Math.max(...metadata.map(([k]) => k.length));
    for (const [key, val] of metadata) {
        lines.push(`${chalk.dim(key.padEnd(maxLabel + 1))} ${val}`);
    }
    // Relations
    const related = getRelatedSkills(skillName);
    const hasRelations = (info?.companions && info.companions.length > 0) ||
        (info?.conflicts && info.conflicts.length > 0) ||
        related.length > 0;
    if (hasRelations) {
        lines.push("");
        if (info?.companions && info.companions.length > 0) {
            lines.push(`${chalk.dim("Works with:")} ${info.companions.join(", ")}`);
        }
        if (info?.conflicts && info.conflicts.length > 0) {
            lines.push(`${chalk.red("Conflicts:")}  ${info.conflicts.join(", ")}`);
        }
        if (related.length > 0) {
            lines.push(`${chalk.dim("Related:")}    ${related.join(", ")}`);
        }
    }
    p.note(lines.join("\n"), skillName);
    // Action menu
    const actions = [];
    if (installed) {
        actions.push({ value: "reinstall", label: "Update to latest" });
        actions.push({ value: "uninstall", label: "Uninstall" });
    }
    else {
        actions.push({ value: "install", label: "Install this skill" });
    }
    actions.push({ value: "__back", label: "Back" });
    const action = await p.select({ message: `${skillName} > Action`, options: actions });
    handleCancel(action);
    switch (action) {
        case "install":
        case "reinstall": {
            await doInstall(skillName, providerName);
            return "back";
        }
        case "uninstall": {
            // Dry-run preview
            const skillDir = getSkillDir(skillName);
            const size = getDirSize(skillDir);
            p.log.info(chalk.dim(`  Will remove: ${skillDir}`));
            p.log.info(chalk.dim(`  Size: ${(size / 1024).toFixed(0)} KB (${meta?.fileCount ?? "?"} files)`));
            p.log.info(chalk.dim(`  A backup will be created before removal.`));
            const ok = await p.confirm({ message: `Uninstall ${chalk.bold(skillName)}?` });
            handleCancel(ok);
            if (ok) {
                const result = doUninstall(skillName);
                if (result.success) {
                    p.log.success(`Removed ${chalk.bold(skillName)}`);
                    if (result.backupPath) {
                        p.log.info(chalk.dim(`  Backup: ${result.backupPath}`));
                    }
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
export { doInstall, doUninstall };
