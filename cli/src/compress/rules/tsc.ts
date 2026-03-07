import { registerRule } from "../engine.js";

registerRule({
  name: "tsc-errors",
  tools: ["tsc", "typescript"],
  compress(lines: string[]): string[] {
    // Compact TypeScript compiler errors: group by file, show first error per file
    const isTs = lines.some((l) => /\.tsx?:\d+:\d+/.test(l) || /error TS\d+/.test(l));
    if (!isTs) return lines;

    const byFile = new Map<string, string[]>();
    let summary = "";

    for (const line of lines) {
      const match = line.match(/^(.+\.tsx?)[:(\s]+(\d+)/);
      if (match) {
        const file = match[1]!;
        if (!byFile.has(file)) byFile.set(file, []);
        byFile.get(file)!.push(line.trim());
      }
      if (/Found \d+ error/.test(line)) {
        summary = line.trim();
      }
    }

    const result: string[] = [];
    for (const [file, errors] of byFile) {
      result.push(`${file} (${errors.length} error${errors.length > 1 ? "s" : ""}):`);
      // Show first 2 errors per file
      for (const err of errors.slice(0, 2)) {
        result.push(`  ${err}`);
      }
      if (errors.length > 2) {
        result.push(`  ...+${errors.length - 2} more`);
      }
    }
    if (summary) result.push(summary);

    return result.length > 0 ? result : lines;
  },
});
