import * as p from "@clack/prompts";
import { installSkill, isSkillInstalled, writeSkillMeta, readSkillMeta } from "./fs.js";
import { scanSkillContent } from "./scanner.js";
import { updateLockEntry } from "./integrity.js";
import { checkConflicts } from "./conflict-check.js";
import { detectProjectContext } from "./project-context.js";
import { LARGE_SKILL_KB_THRESHOLD, TOKENS_PER_KB } from "../constants.js";
/** Scan fetched files for security threats. Returns true if install should proceed. */
export function preInstallScan(_skillName, files, force) {
    const skillMd = files.find((f) => f.path.endsWith("SKILL.md"));
    if (!skillMd)
        return { proceed: true, critical: [], high: [] };
    const issues = scanSkillContent(skillMd.content);
    if (issues.length === 0)
        return { proceed: true, critical: [], high: [] };
    const critical = issues
        .filter((i) => i.level === "critical")
        .map((i) => `${i.category}: ${i.detail} (line ${i.line})`);
    const high = issues.filter((i) => i.level === "high").map((i) => `${i.category}: ${i.detail} (line ${i.line})`);
    if (critical.length > 0 && !force) {
        return { proceed: false, critical, high };
    }
    // When force is true with critical findings, proceed but return the findings
    // so the caller can prompt for confirmation
    return { proceed: true, critical, high };
}
/** Check for conflicts with existing project context. Returns warnings/blocks. */
export function preInstallConflictCheck(skillName, remote, files, force) {
    const context = detectProjectContext(process.cwd());
    const skillMd = files.find((f) => f.path.endsWith("SKILL.md"));
    const warnings = checkConflicts(skillName, remote, skillMd?.content ?? null, context);
    const blocks = warnings.filter((w) => w.severity === "block").map((w) => w.message);
    const warns = warnings.filter((w) => w.severity === "warn").map((w) => w.message);
    if (blocks.length > 0 && !force) {
        return { proceed: false, blocks, warnings: warns };
    }
    return { proceed: true, blocks, warnings: warns };
}
/**
 * Core install logic for a single skill. Handles:
 * fetch -> security scan -> conflict check -> write files -> write meta -> update lock
 */
export async function installOneCore(skillName, provider, opts) {
    const files = await provider.fetch(skillName);
    // Security scan
    const scan = preInstallScan(skillName, files, opts.force);
    if (!scan.proceed) {
        return { success: false, skillName, scanBlocked: true, error: "Blocked by security scan" };
    }
    // When --force bypasses critical findings, require interactive confirmation
    if (opts.force && scan.critical.length > 0 && process.stdout.isTTY) {
        const confirmed = await p.confirm({
            message: `${skillName} has ${scan.critical.length} CRITICAL finding(s). Install anyway?`,
            initialValue: false,
        });
        if (!confirmed || p.isCancel(confirmed)) {
            return { success: false, skillName, scanBlocked: true, error: "User declined forced install" };
        }
    }
    // Conflict detection
    let conflictWarnings = [];
    if (!opts.noCheck) {
        const remote = await provider.info(skillName);
        const conflict = preInstallConflictCheck(skillName, remote, files, opts.force);
        conflictWarnings = conflict.warnings;
        if (!conflict.proceed) {
            return { success: false, skillName, conflictBlocked: true, error: "Blocked by conflict detection" };
        }
    }
    // Install
    installSkill(skillName, files);
    const remote = await provider.info(skillName);
    const version = remote?.version ?? "0.0.0";
    const sizeBytes = files.reduce((s, f) => s + f.content.length, 0);
    writeSkillMeta(skillName, {
        version,
        installedAt: new Date().toISOString(),
        source: provider.name,
        description: remote?.description,
        fileCount: files.length,
        sizeBytes,
    });
    updateLockEntry(skillName, version, provider.name, files);
    const sizeKB = sizeBytes / 1024;
    return { success: true, skillName, files, sizeKB, conflictWarnings };
}
/** Compute size warning message if skill exceeds threshold. */
export function sizeWarning(sizeKB) {
    if (sizeKB <= LARGE_SKILL_KB_THRESHOLD)
        return null;
    return `Large skill (${sizeKB.toFixed(0)} KB, ~${Math.round(sizeKB * TOKENS_PER_KB)} tokens). May use significant context.`;
}
/** Check if a skill can be installed (not already present or force mode). */
export function canInstall(skillName, force) {
    if (!isSkillInstalled(skillName))
        return { proceed: true };
    if (force)
        return { proceed: true };
    return { proceed: false, reason: `${skillName} is already installed. Use --force to reinstall.` };
}
/** Read existing meta to detect provider change on reinstall. */
export function detectProviderChange(skillName, newProvider) {
    const meta = readSkillMeta(skillName);
    if (meta?.source && meta.source !== newProvider) {
        return `Overwriting ${skillName} (was from ${meta.source}, now from ${newProvider})`;
    }
    return null;
}
