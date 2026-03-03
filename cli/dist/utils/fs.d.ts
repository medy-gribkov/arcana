import type { SkillFile, SkillMeta } from "../types.js";
export declare function getInstallDir(): string;
export declare function getSkillDir(name: string): string;
export declare function getDirSize(dir: string): number;
export declare function installSkill(skillName: string, files: SkillFile[]): string;
export declare function isSkillInstalled(skillName: string): boolean;
export declare function readSkillMeta(skillName: string): SkillMeta | null;
export declare function writeSkillMeta(skillName: string, meta: SkillMeta): void;
export interface SymlinkInfo {
    name: string;
    fullPath: string;
    target: string;
    broken: boolean;
}
/**
 * List files in a directory matching a pattern, optionally filtered by age.
 */
export declare function listFilesByAge(dir: string, ext: string, olderThanDays: number): {
    path: string;
    sizeMB: number;
    daysOld: number;
}[];
/**
 * Check if a Claude project directory's source project still exists on disk.
 *
 * Claude Code encodes paths like "c--Users-User-Coding-Personal-arcana" where
 * hyphens replace path separators. This is ambiguous when folder names contain
 * hyphens (e.g., "lead-scraper" becomes indistinguishable from "lead/scraper").
 *
 * Strategy: try all possible split points to find a path that exists on disk.
 * If ANY interpretation resolves to a real directory, the project is not orphaned.
 */
export declare function isOrphanedProject(projectDirName: string): boolean;
export declare function listSymlinks(): SymlinkInfo[];
