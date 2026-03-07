/**
 * Output compression engine (RTK concept).
 * 4-stage pipeline: filter -> group -> truncate -> dedup
 */

export interface CompressRule {
  name: string;
  /** Tool names this rule applies to (e.g. "git", "npm") */
  tools: string[];
  /** Apply compression to lines of output */
  compress(lines: string[]): string[];
}

const rules: CompressRule[] = [];

export function registerRule(rule: CompressRule): void {
  rules.push(rule);
}

/** Strip ANSI escape codes */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Stage 1: Filter - remove noise lines */
function filterLines(lines: string[]): string[] {
  return lines.filter((line) => {
    const clean = stripAnsi(line).trim();
    // Remove empty lines in sequences of 2+
    if (clean === "") return true; // keep single blanks, dedup handles runs
    // Remove progress bars and spinners
    if (/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏\|\\\/\-]/.test(clean)) return false;
    // Remove timing-only lines
    if (/^\s*\d+(\.\d+)?\s*(ms|s|sec|seconds)\s*$/.test(clean)) return false;
    return true;
  });
}

/** Stage 2: Group - collapse similar consecutive lines */
function groupLines(lines: string[]): string[] {
  const result: string[] = [];
  let lastPattern = "";
  let count = 0;

  for (const line of lines) {
    // Normalize for grouping: strip numbers, hashes, timestamps
    const pattern = stripAnsi(line)
      .replace(/\b[0-9a-f]{7,40}\b/g, "<hash>")
      .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/g, "<time>")
      .replace(/\d+/g, "<n>")
      .trim();

    if (pattern === lastPattern && count < 100) {
      count++;
    } else {
      if (count > 1) {
        result.push(`  ... (${count}x similar)`);
      }
      result.push(line);
      lastPattern = pattern;
      count = 1;
    }
  }
  if (count > 1) {
    result.push(`  ... (${count}x similar)`);
  }
  return result;
}

/** Stage 3: Truncate - cap output length */
function truncateLines(lines: string[], maxLines: number): string[] {
  if (lines.length <= maxLines) return lines;
  const head = lines.slice(0, Math.floor(maxLines * 0.6));
  const tail = lines.slice(-Math.floor(maxLines * 0.3));
  const omitted = lines.length - head.length - tail.length;
  return [...head, `\n... ${omitted} lines omitted ...\n`, ...tail];
}

/** Stage 4: Dedup - collapse consecutive blank lines */
function dedupBlanks(lines: string[]): string[] {
  const result: string[] = [];
  let lastBlank = false;
  for (const line of lines) {
    const isBlank = stripAnsi(line).trim() === "";
    if (isBlank && lastBlank) continue;
    result.push(line);
    lastBlank = isBlank;
  }
  return result;
}

/** Run the full 4-stage compression pipeline. */
export function compress(input: string, tool?: string, maxLines = 80): string {
  let lines = input.split("\n");

  // Apply tool-specific rules first
  if (tool) {
    const matching = rules.filter((r) => r.tools.includes(tool));
    for (const rule of matching) {
      lines = rule.compress(lines);
    }
  }

  // Generic pipeline
  lines = filterLines(lines);
  lines = groupLines(lines);
  lines = truncateLines(lines, maxLines);
  lines = dedupBlanks(lines);

  return lines.join("\n");
}

/** Calculate compression stats. */
export function compressionStats(original: string, compressed: string): {
  originalTokens: number;
  compressedTokens: number;
  savedTokens: number;
  savedPct: number;
} {
  // ~4 chars per token approximation
  const originalTokens = Math.round(original.length / 4);
  const compressedTokens = Math.round(compressed.length / 4);
  const savedTokens = originalTokens - compressedTokens;
  const savedPct = originalTokens > 0 ? Math.round((savedTokens / originalTokens) * 100) : 0;
  return { originalTokens, compressedTokens, savedTokens, savedPct };
}
