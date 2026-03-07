import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { atomicWriteSync } from "../utils/atomic.js";

interface ToolStats {
  calls: number;
  savedTokens: number;
}

interface CompressionStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalSaved: number;
  byTool: Record<string, ToolStats>;
}

function statsPath(): string {
  return join(homedir(), ".arcana", "compression-stats.json");
}

function readStats(): CompressionStats {
  const p = statsPath();
  if (!existsSync(p)) {
    return { totalInputTokens: 0, totalOutputTokens: 0, totalSaved: 0, byTool: {} };
  }
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as CompressionStats;
  } catch {
    return { totalInputTokens: 0, totalOutputTokens: 0, totalSaved: 0, byTool: {} };
  }
}

function writeStats(stats: CompressionStats): void {
  const dir = join(homedir(), ".arcana");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  atomicWriteSync(statsPath(), JSON.stringify(stats, null, 2));
}

export function recordCompression(tool: string, inputTokens: number, outputTokens: number): void {
  const stats = readStats();
  stats.totalInputTokens += inputTokens;
  stats.totalOutputTokens += outputTokens;
  stats.totalSaved += inputTokens - outputTokens;

  if (!stats.byTool[tool]) {
    stats.byTool[tool] = { calls: 0, savedTokens: 0 };
  }
  stats.byTool[tool]!.calls++;
  stats.byTool[tool]!.savedTokens += inputTokens - outputTokens;

  writeStats(stats);
}

export function getCompressionStats(): CompressionStats & { savingsPct: number } {
  const stats = readStats();
  const savingsPct = stats.totalInputTokens > 0
    ? Math.round((stats.totalSaved / stats.totalInputTokens) * 100)
    : 0;
  return { ...stats, savingsPct };
}

export function resetCompressionStats(): void {
  writeStats({ totalInputTokens: 0, totalOutputTokens: 0, totalSaved: 0, byTool: {} });
}
