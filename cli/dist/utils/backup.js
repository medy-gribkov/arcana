import { existsSync, mkdirSync, cpSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { getSkillDir } from "./fs.js";
const BACKUP_DIR = join(homedir(), ".arcana", "backups");
const MAX_BACKUPS_PER_SKILL = 10;
export function getBackupDir() {
    return BACKUP_DIR;
}
export function backupSkill(skillName) {
    const skillDir = getSkillDir(skillName);
    if (!existsSync(skillDir))
        return null;
    mkdirSync(BACKUP_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dest = join(BACKUP_DIR, `${skillName}_${timestamp}`);
    cpSync(skillDir, dest, { recursive: true });
    pruneOldBackups(skillName);
    return dest;
}
export function pruneOldBackups(skillName) {
    if (!existsSync(BACKUP_DIR))
        return;
    const prefix = `${skillName}_`;
    const entries = readdirSync(BACKUP_DIR)
        .filter((d) => d.startsWith(prefix))
        .sort();
    while (entries.length > MAX_BACKUPS_PER_SKILL) {
        const oldest = entries.shift();
        rmSync(join(BACKUP_DIR, oldest), { recursive: true, force: true });
    }
}
