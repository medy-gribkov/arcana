import { registerRule } from "../engine.js";

registerRule({
  name: "npm-install",
  tools: ["npm", "pnpm", "yarn"],
  compress(lines: string[]): string[] {
    // Compact npm/pnpm install output
    const isInstall = lines.some((l) => /^(added|removed|up to date|Packages:|Progress:)/.test(l.trim()));
    if (!isInstall) return lines;

    const result: string[] = [];
    const warnings: string[] = [];
    let summary = "";

    for (const line of lines) {
      const trimmed = line.trim();
      // Keep summary lines
      if (/^(added|removed|up to date|Done in)/.test(trimmed)) {
        summary = trimmed;
      }
      // Keep dependency sections
      else if (/^(dependencies|devDependencies|peerDependencies):/.test(trimmed)) {
        result.push(trimmed);
      }
      // Keep actual package additions (+ package@version)
      else if (trimmed.startsWith("+ ")) {
        result.push(trimmed);
      }
      // Collect warnings
      else if (/^(WARN|warn|npm warn)/.test(trimmed)) {
        if (warnings.length < 3) warnings.push(trimmed);
      }
      // Skip progress bars, http lines, timing
    }

    if (warnings.length > 0) {
      result.push(`warnings (${warnings.length}): ${warnings[0]}`);
    }
    if (summary) result.push(summary);

    return result.length > 0 ? result : lines;
  },
});

registerRule({
  name: "npm-test",
  tools: ["npm", "pnpm"],
  compress(lines: string[]): string[] {
    // Compact test runner output: keep failures and summary
    const hasSummary = lines.some((l) => /Tests?\s+\d+/.test(l) || /\d+ (passed|failed|skipped)/.test(l));
    if (!hasSummary) return lines;

    const result: string[] = [];
    const failures: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Keep summary lines
      if (/Tests?\s+\d+/.test(trimmed) || /\d+ (passed|failed|skipped)/.test(trimmed)) {
        result.push(line);
      }
      // Keep test file results
      else if (/^[✓✗×]|PASS|FAIL/.test(trimmed)) {
        if (/FAIL|✗|×/.test(trimmed)) {
          failures.push(line);
        }
        // Skip individual passing tests
      }
      // Keep error details
      else if (/^(Error|AssertionError|Expected|Received|at )/.test(trimmed)) {
        result.push(line);
      }
      // Keep duration
      else if (/Duration|Time/.test(trimmed)) {
        result.push(line);
      }
    }

    // Show failures first, then summary
    return [...failures, ...result].length > 0 ? [...failures, ...result] : lines;
  },
});

registerRule({
  name: "npm-audit",
  tools: ["npm", "pnpm"],
  compress(lines: string[]): string[] {
    const isAudit = lines.some((l) => /vulnerabilit/.test(l));
    if (!isAudit) return lines;

    const result: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      // Keep vulnerability summary
      if (/\d+ vulnerabilit/.test(trimmed) || /found 0/.test(trimmed)) {
        result.push(trimmed);
      }
      // Keep severity breakdown
      else if (/^(critical|high|moderate|low)\s*\|?\s*\d+/.test(trimmed)) {
        result.push(trimmed);
      }
    }

    return result.length > 0 ? result : lines;
  },
});
