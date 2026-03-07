import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { atomicWriteSync } from "../utils/atomic.js";

export interface TrimResult {
  originalLines: number;
  trimmedLines: number;
  originalBytes: number;
  trimmedBytes: number;
  savedBytes: number;
  savedPct: number;
  toolResultsTrimmed: number;
  base64Removed: number;
}

/** Threshold for tool result bodies (chars). Results larger than this get stubbed. */
const RESULT_THRESHOLD = 500;

/**
 * Analyze a session JSONL for trimmable content.
 * Returns stats without modifying the file.
 */
export function analyzeSession(filePath: string): TrimResult {
  if (!existsSync(filePath)) {
    return { originalLines: 0, trimmedLines: 0, originalBytes: 0, trimmedBytes: 0, savedBytes: 0, savedPct: 0, toolResultsTrimmed: 0, base64Removed: 0 };
  }

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  let toolResultsTrimmed = 0;
  let base64Removed = 0;
  let trimmedSize = 0;

  for (const line of lines) {
    try {
      const msg = JSON.parse(line) as Record<string, unknown>;
      const role = msg.role as string | undefined;

      // Tool results: stub if too large
      if (role === "tool" || (msg.type === "tool_result")) {
        const content = JSON.stringify(msg);
        if (content.length > RESULT_THRESHOLD) {
          toolResultsTrimmed++;
          trimmedSize += 100; // stub size
          continue;
        }
      }

      // Base64 encoded content
      const lineStr = JSON.stringify(msg);
      if (lineStr.includes("base64,") || lineStr.includes('"type":"image"')) {
        base64Removed++;
        trimmedSize += 50; // stub size
        continue;
      }

      trimmedSize += line.length;
    } catch {
      trimmedSize += line.length;
    }
  }

  const originalBytes = content.length;
  const savedBytes = originalBytes - trimmedSize;
  const savedPct = originalBytes > 0 ? Math.round((savedBytes / originalBytes) * 100) : 0;

  return {
    originalLines: lines.length,
    trimmedLines: lines.length - toolResultsTrimmed - base64Removed,
    originalBytes,
    trimmedBytes: trimmedSize,
    savedBytes,
    savedPct,
    toolResultsTrimmed,
    base64Removed,
  };
}

/**
 * Trim a session JSONL and write trimmed copy.
 * NEVER modifies the original file.
 */
export function trimSession(filePath: string): { destPath: string; result: TrimResult } | null {
  if (!existsSync(filePath)) return null;

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const trimmedLines: string[] = [];
  let toolResultsTrimmed = 0;
  let base64Removed = 0;

  for (const line of lines) {
    try {
      const msg = JSON.parse(line) as Record<string, unknown>;
      const role = msg.role as string | undefined;

      // Tool results: stub if too large
      if (role === "tool" || msg.type === "tool_result") {
        const msgStr = JSON.stringify(msg);
        if (msgStr.length > RESULT_THRESHOLD) {
          toolResultsTrimmed++;
          // Replace with stub preserving structure
          const stubbed = { ...msg, content: `[trimmed: ${Math.round(msgStr.length / 1024)}KB]` };
          trimmedLines.push(JSON.stringify(stubbed));
          continue;
        }
      }

      // Base64 encoded content
      const lineStr = JSON.stringify(msg);
      if (lineStr.includes("base64,") || lineStr.includes('"type":"image"')) {
        base64Removed++;
        const stubbed = { ...msg, content: "[base64 image removed]" };
        trimmedLines.push(JSON.stringify(stubbed));
        continue;
      }

      trimmedLines.push(line);
    } catch {
      trimmedLines.push(line);
    }
  }

  // Write to ~/.arcana/trimmed/
  const trimmedDir = join(homedir(), ".arcana", "trimmed");
  if (!existsSync(trimmedDir)) mkdirSync(trimmedDir, { recursive: true });

  const trimmedContent = trimmedLines.join("\n") + "\n";
  const destPath = join(trimmedDir, `trimmed-${Date.now()}.jsonl`);
  atomicWriteSync(destPath, trimmedContent);

  const originalBytes = content.length;
  const trimmedBytes = trimmedContent.length;

  return {
    destPath,
    result: {
      originalLines: lines.length,
      trimmedLines: trimmedLines.length,
      originalBytes,
      trimmedBytes,
      savedBytes: originalBytes - trimmedBytes,
      savedPct: originalBytes > 0 ? Math.round(((originalBytes - trimmedBytes) / originalBytes) * 100) : 0,
      toolResultsTrimmed,
      base64Removed,
    },
  };
}
