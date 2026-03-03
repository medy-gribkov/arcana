import type { Provider } from "../providers/base.js";
import type { SkillFile, SkillInfo } from "../types.js";
export interface InstallOneResult {
    success: boolean;
    skillName: string;
    files?: SkillFile[];
    sizeKB?: number;
    error?: string;
    scanBlocked?: boolean;
    conflictBlocked?: boolean;
    conflictWarnings?: string[];
    alreadyInstalled?: boolean;
}
export interface InstallBatchResult {
    installed: string[];
    skipped: string[];
    failed: string[];
    failedErrors: Record<string, string>;
}
/** Scan fetched files for security threats. Returns true if install should proceed. */
export declare function preInstallScan(_skillName: string, files: SkillFile[], force?: boolean): {
    proceed: boolean;
    critical: string[];
    high: string[];
};
/** Check for conflicts with existing project context. Returns warnings/blocks. */
export declare function preInstallConflictCheck(skillName: string, remote: SkillInfo | null, files: SkillFile[], force?: boolean): {
    proceed: boolean;
    blocks: string[];
    warnings: string[];
};
/**
 * Core install logic for a single skill. Handles:
 * fetch -> security scan -> conflict check -> write files -> write meta -> update lock
 */
export declare function installOneCore(skillName: string, provider: Provider, opts: {
    force?: boolean;
    noCheck?: boolean;
}): Promise<InstallOneResult>;
/** Compute size warning message if skill exceeds threshold. */
export declare function sizeWarning(sizeKB: number): string | null;
/** Check if a skill can be installed (not already present or force mode). */
export declare function canInstall(skillName: string, force?: boolean): {
    proceed: boolean;
    reason?: string;
};
/** Read existing meta to detect provider change on reinstall. */
export declare function detectProviderChange(skillName: string, newProvider: string): string | null;
