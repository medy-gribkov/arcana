import { registerRule } from "../engine.js";

registerRule({
  name: "vitest",
  tools: ["vitest"],
  compress(lines: string[]): string[] {
    const isVitest = lines.some((l) => /Test Files|Tests\s+\d+/.test(l));
    if (!isVitest) return lines;

    const result: string[] = [];
    const failures: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Keep file-level results
      if (/^[✓✗×].*\.test\./.test(trimmed) || /FAIL/.test(trimmed)) {
        if (/✗|×|FAIL/.test(trimmed)) failures.push(line);
      }
      // Keep summary
      else if (/Test Files|Tests\s+\d+|Duration|Start at/.test(trimmed)) {
        result.push(line);
      }
      // Keep assertion errors
      else if (/^(AssertionError|Error|Expected|Received|expect\()/.test(trimmed)) {
        result.push(line);
      }
    }

    return [...failures, ...result].length > 0 ? [...failures, ...result] : lines;
  },
});

registerRule({
  name: "jest",
  tools: ["jest"],
  compress(lines: string[]): string[] {
    const isJest = lines.some((l) => /Test Suites:|Tests:/.test(l));
    if (!isJest) return lines;

    const result: string[] = [];
    const failures: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^(FAIL|PASS)/.test(trimmed)) {
        if (trimmed.startsWith("FAIL")) failures.push(line);
      } else if (/Test Suites:|Tests:|Snapshots:|Time:/.test(trimmed)) {
        result.push(line);
      } else if (/●/.test(line)) {
        // Jest failure markers
        failures.push(line);
      }
    }

    return [...failures, ...result].length > 0 ? [...failures, ...result] : lines;
  },
});

registerRule({
  name: "pytest",
  tools: ["pytest", "python"],
  compress(lines: string[]): string[] {
    const isPytest = lines.some((l) => /passed|failed|error/.test(l) && /=+/.test(l));
    if (!isPytest) return lines;

    const result: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      // Keep summary line
      if (/^=+.*=+$/.test(trimmed) && /(passed|failed|error|warning)/.test(trimmed)) {
        result.push(line);
      }
      // Keep FAILED markers
      else if (/^FAILED/.test(trimmed)) {
        result.push(line);
      }
      // Keep short test results section
      else if (/^(ERRORS|FAILURES|SHORT TEST SUMMARY)/.test(trimmed)) {
        result.push(line);
      }
    }

    return result.length > 0 ? result : lines;
  },
});

registerRule({
  name: "go-test",
  tools: ["go"],
  compress(lines: string[]): string[] {
    const isGoTest = lines.some((l) => /^(ok|FAIL|---)\s/.test(l.trim()));
    if (!isGoTest) return lines;

    const result: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      // Keep package results
      if (/^(ok|FAIL)\s/.test(trimmed)) {
        result.push(line);
      }
      // Keep individual test failures
      else if (/^--- FAIL/.test(trimmed)) {
        result.push(line);
      }
    }

    return result.length > 0 ? result : lines;
  },
});
