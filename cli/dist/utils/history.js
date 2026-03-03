import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { atomicWriteSync } from "./atomic.js";
const MAX_ENTRIES = 50;
function historyPath() {
    return join(homedir(), ".arcana", "history.json");
}
export function readHistory() {
    const p = historyPath();
    if (!existsSync(p))
        return [];
    try {
        const data = JSON.parse(readFileSync(p, "utf-8"));
        return Array.isArray(data) ? data : [];
    }
    catch {
        return [];
    }
}
export function appendHistory(action, target) {
    const entries = readHistory();
    entries.push({ action, target, timestamp: new Date().toISOString() });
    while (entries.length > MAX_ENTRIES)
        entries.shift();
    const dir = join(homedir(), ".arcana");
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    try {
        atomicWriteSync(historyPath(), JSON.stringify(entries, null, 2));
    }
    catch {
        // Best effort
    }
}
export function clearHistory() {
    const dir = join(homedir(), ".arcana");
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    try {
        atomicWriteSync(historyPath(), "[]");
    }
    catch {
        // Best effort
    }
}
export function getRecentSkills(limit = 5) {
    const entries = readHistory();
    const skills = [];
    for (let i = entries.length - 1; i >= 0 && skills.length < limit; i--) {
        const e = entries[i];
        if (e.target && (e.action === "install" || e.action === "search") && !skills.includes(e.target)) {
            skills.push(e.target);
        }
    }
    return skills;
}
