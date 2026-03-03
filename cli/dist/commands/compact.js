import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { ui, banner } from "../utils/ui.js";
import { getDirSize } from "../utils/fs.js";
import { PRUNE_DEFAULT_DAYS, PRUNE_SIZE_THRESHOLD_BYTES, PRUNE_KEEP_NEWEST } from "../constants.js";
function analyzeProject(projDir, projName) {
    const now = Date.now();
    const mainFiles = [];
    const agentFiles = [];
    const sessionDirs = [];
    for (const entry of readdirSync(projDir)) {
        const full = join(projDir, entry);
        try {
            const stat = statSync(full);
            if (stat.isDirectory()) {
                if (entry === "memory")
                    continue;
                sessionDirs.push({
                    name: entry,
                    sizeBytes: getDirSize(full),
                    daysOld: Math.floor((now - stat.mtimeMs) / (1000 * 60 * 60 * 24)),
                });
                continue;
            }
            if (!entry.endsWith(".jsonl"))
                continue;
            const info = {
                name: entry,
                sizeBytes: stat.size,
                daysOld: Math.floor((now - stat.mtimeMs) / (1000 * 60 * 60 * 24)),
            };
            if (entry.startsWith("agent-")) {
                agentFiles.push(info);
            }
            else {
                mainFiles.push(info);
            }
        }
        catch {
            continue;
        }
    }
    const totalBytes = mainFiles.reduce((s, f) => s + f.sizeBytes, 0) +
        agentFiles.reduce((s, f) => s + f.sizeBytes, 0) +
        sessionDirs.reduce((s, d) => s + d.sizeBytes, 0);
    // Reclaimable: all agent files + all session dirs
    const reclaimableBytes = agentFiles.reduce((s, f) => s + f.sizeBytes, 0) + sessionDirs.reduce((s, d) => s + d.sizeBytes, 0);
    return { name: projName, mainFiles, agentFiles, sessionDirs, totalBytes, reclaimableBytes };
}
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
/**
 * Prune oversized main session files.
 * Targets files older than pruneDays AND larger than 10 MB.
 * Always keeps the 3 newest sessions per project regardless.
 */
function pruneMainSessions(analyses, projectsDir, pruneDays, dryRun, json) {
    const pruned = [];
    let reclaimedBytes = 0;
    for (const a of analyses) {
        // Sort main files by age (newest first) to protect the 3 newest
        const sorted = [...a.mainFiles].sort((x, y) => x.daysOld - y.daysOld);
        const candidates = sorted.slice(PRUNE_KEEP_NEWEST); // Skip the 3 newest
        for (const f of candidates) {
            if (f.daysOld > pruneDays && f.sizeBytes > PRUNE_SIZE_THRESHOLD_BYTES) {
                const sizeMB = (f.sizeBytes / (1024 * 1024)).toFixed(1);
                if (!json) {
                    console.log(`    ${ui.warn("Prune:")} ${f.name} ${ui.dim(`(${sizeMB} MB, ${f.daysOld}d old)`)}`);
                }
                if (!dryRun) {
                    try {
                        rmSync(join(projectsDir, a.name, f.name), { force: true });
                    }
                    catch {
                        /* skip */
                    }
                }
                pruned.push({ project: a.name, file: f.name, sizeMB, daysOld: f.daysOld });
                reclaimedBytes += f.sizeBytes;
            }
        }
    }
    return { pruned, reclaimedBytes };
}
export async function compactCommand(opts) {
    if (!opts.json)
        banner();
    const dryRun = opts.dryRun ?? false;
    if (dryRun && !opts.json)
        console.log(ui.warn("  DRY RUN - no files will be deleted\n"));
    const projectsDir = join(homedir(), ".claude", "projects");
    if (!existsSync(projectsDir)) {
        if (opts.json) {
            console.log(JSON.stringify({ projects: [], totalReclaimed: 0 }));
        }
        else {
            console.log(ui.dim("  No session data found."));
            console.log();
        }
        return;
    }
    const analyses = [];
    for (const entry of readdirSync(projectsDir)) {
        const projDir = join(projectsDir, entry);
        if (!statSync(projDir).isDirectory())
            continue;
        if (entry === "memory" || entry.startsWith("."))
            continue;
        const analysis = analyzeProject(projDir, entry);
        if (analysis.totalBytes > 0) {
            analyses.push(analysis);
        }
    }
    analyses.sort((a, b) => b.totalBytes - a.totalBytes);
    if (opts.json) {
        const jsonResult = {
            projects: analyses.map((a) => ({
                name: a.name,
                totalBytes: a.totalBytes,
                reclaimableBytes: a.reclaimableBytes,
                mainSessions: a.mainFiles.length,
                agentLogs: a.agentFiles.length,
                sessionDirs: a.sessionDirs.length,
            })),
            totalReclaimed: dryRun ? 0 : analyses.reduce((s, a) => s + a.reclaimableBytes, 0),
        };
        if (!dryRun) {
            for (const a of analyses) {
                const projDir = join(projectsDir, a.name);
                for (const f of a.agentFiles) {
                    try {
                        rmSync(join(projDir, f.name), { force: true });
                    }
                    catch {
                        /* skip */
                    }
                }
                for (const d of a.sessionDirs) {
                    try {
                        rmSync(join(projDir, d.name), { recursive: true, force: true });
                    }
                    catch {
                        /* skip */
                    }
                }
            }
        }
        if (opts.prune) {
            const pruneDays = opts.pruneDays ?? PRUNE_DEFAULT_DAYS;
            const pruneResult = pruneMainSessions(analyses, projectsDir, pruneDays, dryRun, true);
            jsonResult.pruned = pruneResult.pruned;
            jsonResult.prunedBytes = pruneResult.reclaimedBytes;
            if (!dryRun) {
                jsonResult.totalReclaimed = jsonResult.totalReclaimed + pruneResult.reclaimedBytes;
            }
        }
        console.log(JSON.stringify(jsonResult, null, 2));
        return;
    }
    if (!opts.json)
        console.log(ui.bold("  Session Compaction Report\n"));
    let totalReclaimed = 0;
    const hasWork = analyses.some((a) => a.reclaimableBytes > 0);
    for (const a of analyses) {
        if (a.totalBytes < 1024)
            continue; // Skip tiny projects
        const truncName = a.name.length > 50 ? a.name.slice(0, 47) + "..." : a.name;
        console.log(`  ${ui.bold(truncName)}  ${ui.dim(formatBytes(a.totalBytes))}`);
        // Main sessions
        const mainSize = a.mainFiles.reduce((s, f) => s + f.sizeBytes, 0);
        console.log(`    ${ui.success("Keep:")} ${a.mainFiles.length} main session${a.mainFiles.length !== 1 ? "s" : ""} ${ui.dim(`(${formatBytes(mainSize)})`)}`);
        // Agent logs
        if (a.agentFiles.length > 0) {
            const agentSize = a.agentFiles.reduce((s, f) => s + f.sizeBytes, 0);
            console.log(`    ${ui.warn("Remove:")} ${a.agentFiles.length} agent log${a.agentFiles.length !== 1 ? "s" : ""} ${ui.dim(`(${formatBytes(agentSize)})`)}`);
            if (!dryRun) {
                const projDir = join(projectsDir, a.name);
                for (const f of a.agentFiles) {
                    try {
                        rmSync(join(projDir, f.name), { force: true });
                    }
                    catch {
                        /* skip */
                    }
                }
            }
            totalReclaimed += agentSize;
        }
        // Session dirs
        if (a.sessionDirs.length > 0) {
            const dirSize = a.sessionDirs.reduce((s, d) => s + d.sizeBytes, 0);
            if (dirSize > 0) {
                console.log(`    ${ui.warn("Remove:")} ${a.sessionDirs.length} session dir${a.sessionDirs.length !== 1 ? "s" : ""} ${ui.dim(`(${formatBytes(dirSize)})`)}`);
                if (!dryRun) {
                    const projDir = join(projectsDir, a.name);
                    for (const d of a.sessionDirs) {
                        try {
                            rmSync(join(projDir, d.name), { recursive: true, force: true });
                        }
                        catch {
                            /* skip */
                        }
                    }
                }
                totalReclaimed += dirSize;
            }
        }
        console.log();
    }
    // Prune oversized main sessions if requested
    if (opts.prune) {
        const pruneDays = opts.pruneDays ?? PRUNE_DEFAULT_DAYS;
        console.log(ui.bold(`  Pruning main sessions (>${pruneDays}d old AND >10 MB, keeping 3 newest per project)\n`));
        const pruneResult = pruneMainSessions(analyses, projectsDir, pruneDays, dryRun, false);
        totalReclaimed += pruneResult.reclaimedBytes;
        if (pruneResult.pruned.length === 0) {
            console.log(ui.dim("    No oversized sessions to prune."));
        }
        console.log();
    }
    // Summary
    if (!hasWork && !opts.prune) {
        console.log(ui.success("  Already compact. No agent logs to remove."));
    }
    else {
        const verb = dryRun ? "Would reclaim" : "Reclaimed";
        console.log(ui.success(`  ${verb} ${formatBytes(totalReclaimed)} by removing agent logs and session dirs.`));
        console.log(ui.dim("  Main session files preserved for history."));
    }
    console.log();
}
