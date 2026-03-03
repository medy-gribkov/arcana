import { existsSync, mkdirSync, readFileSync, unlinkSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { atomicWriteSync } from "./atomic.js";
const CACHE_DIR = join(homedir(), ".arcana", "cache");
const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour
function ensureCacheDir() {
    if (!existsSync(CACHE_DIR)) {
        mkdirSync(CACHE_DIR, { recursive: true });
    }
}
function cacheFile(key) {
    return join(CACHE_DIR, `${key}.json`);
}
export function readCache(key, maxAgeMs = DEFAULT_TTL) {
    const file = cacheFile(key);
    if (!existsSync(file))
        return null;
    try {
        const stat = statSync(file);
        if (Date.now() - stat.mtimeMs > maxAgeMs)
            return null;
        return JSON.parse(readFileSync(file, "utf-8"));
    }
    catch {
        return null;
    }
}
export function writeCache(key, data) {
    try {
        ensureCacheDir();
        atomicWriteSync(cacheFile(key), JSON.stringify(data, null, 2) + "\n", 0o644);
    }
    catch {
        // Best-effort cache write, don't crash on disk full or permission errors
    }
}
export function clearCacheFile(key) {
    const file = cacheFile(key);
    if (existsSync(file)) {
        try {
            unlinkSync(file);
        }
        catch {
            /* best-effort */
        }
    }
}
