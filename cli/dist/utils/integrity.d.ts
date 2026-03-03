export interface LockEntry {
    skill: string;
    version: string;
    hash: string;
    source: string;
    installedAt: string;
}
export declare function computeHash(content: string): string;
export declare function getLockfilePath(): string;
export declare function readLockfile(): LockEntry[];
export declare function writeLockfile(entries: LockEntry[]): void;
export declare function updateLockEntry(skill: string, version: string, source: string, files: Array<{
    path: string;
    content: string;
}>): void;
export declare function removeLockEntry(skill: string): void;
export declare function verifySkillIntegrity(skillName: string, installDir: string): "ok" | "modified" | "missing";
