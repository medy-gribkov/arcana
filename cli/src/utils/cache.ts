import { existsSync, mkdirSync, readFileSync, unlinkSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { atomicWriteSync } from "./atomic.js";
import { CACHE_MAX_AGE_MS } from "../constants.js";

const CACHE_DIR = join(homedir(), ".arcana", "cache");

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function cacheFile(key: string): string {
  return join(CACHE_DIR, `${key}.json`);
}

export function readCache<T>(key: string, maxAgeMs: number = CACHE_MAX_AGE_MS): T | null {
  const file = cacheFile(key);
  if (!existsSync(file)) return null;
  try {
    const stat = statSync(file);
    if (Date.now() - stat.mtimeMs > maxAgeMs) return null;
    return JSON.parse(readFileSync(file, "utf-8")) as T;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  try {
    ensureCacheDir();
    atomicWriteSync(cacheFile(key), JSON.stringify(data, null, 2) + "\n", 0o644);
  } catch {
    // Best-effort cache write, don't crash on disk full or permission errors
  }
}

export function clearCacheFile(key: string): void {
  const file = cacheFile(key);
  if (existsSync(file)) {
    try {
      unlinkSync(file);
    } catch {
      /* best-effort */
    }
  }
}
