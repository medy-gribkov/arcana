import { describe, it, expect } from "vitest";

// Import rules to register them
import "./git.js";
import "./npm.js";
import "./tsc.js";
import "./test-runner.js";
import "./generic.js";
import { compress } from "../engine.js";

// Helper: exactly 40 hex char hashes
// Each is 8 groups of 5 = 40 chars
const HASH_A = "abcde12345abcde12345abcde12345abcde12345";
const HASH_B = "12345abcde12345abcde12345abcde12345abcde";
const HASH_C = "aabbc11223aabbc11223aabbc11223aabbc11223";

// ──────────────────────────────────────────
// git-status rule
// ──────────────────────────────────────────

describe("git-status rule", () => {
  it("compresses git status output with unstaged changes", () => {
    const input = [
      "On branch master",
      "Changes not staged for commit:",
      '  (use "git add <file>..." to update what will be committed)',
      "",
      "\tmodified:   src/index.ts",
      "\tmodified:   src/cli.ts",
      "\tmodified:   src/utils.ts",
      "",
      "Untracked files:",
      '  (use "git add <file>..." to include in what will be committed)',
      "\tnew-file.ts",
      "\tanother.ts",
    ].join("\n");

    const result = compress(input, "git");
    expect(result).toContain("branch: master");
    expect(result).toContain("modified");
  });

  it("compresses staged changes", () => {
    const input = [
      "On branch feature",
      "Changes to be committed:",
      '  (use "git restore --staged <file>..." to unstage)',
      "",
      "\tnew file:   src/new.ts",
      "\tmodified:   src/old.ts",
    ].join("\n");

    const result = compress(input, "git");
    expect(result).toContain("branch: feature");
    expect(result).toContain("staged (2)");
    expect(result).toContain("src/new.ts");
    expect(result).toContain("src/old.ts");
  });

  it("compresses deleted and renamed file types", () => {
    const input = [
      "On branch main",
      "Changes not staged for commit:",
      "",
      "\tdeleted:    old-file.ts",
      "\trenamed:    src/a.ts -> src/b.ts",
      "\tcopied:     src/c.ts -> src/d.ts",
    ].join("\n");

    const result = compress(input, "git");
    expect(result).toContain("branch: main");
    expect(result).toContain("modified (3)");
  });

  it("truncates staged files when > 5", () => {
    const stagedFiles = Array.from({ length: 8 }, (_, i) => `\tnew file:   file${i}.ts`);
    const input = [
      "On branch main",
      "Changes to be committed:",
      "",
      ...stagedFiles,
    ].join("\n");

    const result = compress(input, "git");
    expect(result).toContain("staged (8)");
    expect(result).toContain("+3"); // 8 - 5 = 3 truncated
  });

  it("truncates unstaged files when > 5", () => {
    const unstagedFiles = Array.from({ length: 7 }, (_, i) => `\tmodified:   src/file${i}.ts`);
    const input = [
      "On branch main",
      "Changes not staged for commit:",
      "",
      ...unstagedFiles,
    ].join("\n");

    const result = compress(input, "git");
    expect(result).toContain("modified (7)");
    expect(result).toContain("+2"); // 7 - 5 = 2 truncated
  });

  it("truncates untracked files when > 3", () => {
    const untrackedFiles = Array.from({ length: 6 }, (_, i) => `\tuntk${i}.ts`);
    const input = [
      "On branch main",
      "Untracked files:",
      '  (use "git add <file>..." to include)',
      ...untrackedFiles,
    ].join("\n");

    const result = compress(input, "git");
    expect(result).toContain("untracked (6)");
    expect(result).toContain("+3"); // 6 - 3 = 3 truncated
  });

  it("outputs branch info when no changes detected", () => {
    const input = [
      "On branch main",
      "nothing to commit, working tree clean",
    ].join("\n");

    const result = compress(input, "git");
    expect(result).toContain("branch: main");
  });

  it("passes through non-git output unchanged", () => {
    const input = "hello world\nfoo bar";
    const result = compress(input, "git");
    expect(result).toContain("hello world");
  });

  it("handles mixed staged and unstaged changes", () => {
    const input = [
      "On branch develop",
      "Changes to be committed:",
      "",
      "\tnew file:   added.ts",
      "",
      "Changes not staged for commit:",
      "",
      "\tmodified:   changed.ts",
      "",
      "Untracked files:",
      "",
      "\tnew.ts",
    ].join("\n");

    const result = compress(input, "git");
    expect(result).toContain("branch: develop");
    expect(result).toContain("staged (1)");
    expect(result).toContain("modified (1)");
    expect(result).toContain("untracked (1)");
  });
});

// ──────────────────────────────────────────
// git-log rule
// ──────────────────────────────────────────

describe("git-log rule", () => {
  it("compresses git log output to short format", () => {
    const input = [
      `commit ${HASH_A}`,
      "Author: Test User <test@test.com>",
      "Date:   Mon Mar 7 10:00:00 2026 +0000",
      "",
      "    First commit message",
      "",
      `commit ${HASH_B}`,
      "Author: Test User <test@test.com>",
      "Date:   Sun Mar 6 09:00:00 2026 +0000",
      "",
      "    Second commit message",
    ].join("\n");

    const result = compress(input, "git");
    expect(result).toContain("abcde12");
    expect(result).toContain("First commit message");
    expect(result).toContain("12345ab");
    expect(result).toContain("Second commit message");
  });

  it("handles single commit in log", () => {
    const input = [
      `commit ${HASH_C}`,
      "Author: Dev <dev@dev.com>",
      "Date:   Fri Mar 7 08:00:00 2026 +0000",
      "",
      "    Initial commit",
    ].join("\n");

    const result = compress(input, "git");
    expect(result).toContain("aabbc11");
    expect(result).toContain("Initial commit");
  });

  it("handles merge commits (Merge: line is skipped)", () => {
    const input = [
      `commit ${HASH_A}`,
      "Merge: aaa1111111 bbb2222222",
      "Author: Dev <dev@dev.com>",
      "Date:   Fri Mar 7 08:00:00 2026 +0000",
      "",
      "    Merge branch feature into main",
    ].join("\n");

    const result = compress(input, "git");
    expect(result).toContain("abcde12");
    expect(result).toContain("Merge branch feature into main");
  });

  it("passes through non-log output unchanged", () => {
    const input = "not a git log\njust some text";
    const result = compress(input, "git");
    expect(result).toContain("not a git log");
    expect(result).toContain("just some text");
  });

  it("handles commits with empty message bodies", () => {
    const input = [
      `commit ${HASH_A}`,
      "Author: Dev <dev@dev.com>",
      "Date:   Fri Mar 7 08:00:00 2026 +0000",
      "",
      `commit ${HASH_B}`,
      "Author: Dev <dev@dev.com>",
      "Date:   Sun Mar 6 09:00:00 2026 +0000",
      "",
      "    Has a message",
    ].join("\n");

    const result = compress(input, "git");
    // First commit has no message, so it shouldn't produce a compressed line
    // Second commit should appear
    expect(result).toContain("12345ab");
    expect(result).toContain("Has a message");
  });

  it("uses first non-metadata line as commit message", () => {
    const input = [
      `commit ${HASH_A}`,
      "Author: Dev <dev@dev.com>",
      "Date:   Fri Mar 7 08:00:00 2026 +0000",
      "",
      "    feat: add new feature",
      "    This is a longer description",
    ].join("\n");

    const result = compress(input, "git");
    // Should contain compressed hash + first message line
    expect(result).toContain("abcde12");
    expect(result).toContain("feat: add new feature");
  });
});

// ──────────────────────────────────────────
// git-diff-stat rule
// ──────────────────────────────────────────

describe("git-diff-stat rule", () => {
  it("compresses git diff stat output", () => {
    const lines = [
      " src/index.ts | 10 +++--",
      " src/cli.ts   |  5 ++-",
      " 2 files changed, 10 insertions(+), 5 deletions(-)",
      "diff --git a/src/index.ts b/src/index.ts",
      "@@ -1,5 +1,10 @@",
      " line 1",
      " line 2",
      " line 3",
      " line 4",
      " line 5",
      " line 6",
    ].join("\n");

    const result = compress(lines, "git");
    expect(result).toContain("2 files changed");
  });

  it("keeps stat summary and diff/hunk headers", () => {
    const lines = [
      " src/a.ts | 3 +++",
      " 1 file changed, 3 insertions(+)",
      "diff --git a/src/a.ts b/src/a.ts",
      "@@ -1,3 +1,6 @@",
      "+new line alpha",
      "+new line beta",
      "+new line gamma",
    ].join("\n");

    const result = compress(lines, "git");
    expect(result).toContain("1 file changed");
    expect(result).toContain("diff --git a/src/a.ts b/src/a.ts");
    expect(result).toContain("@@ -1,3 +1,6 @@");
  });

  it("truncates hunk content after 3 lines", () => {
    // Use very different lines to avoid groupLines collapsing them
    const lines = [
      " src/big.ts | 20 +++++++++++",
      " 1 file changed, 20 insertions(+)",
      "diff --git a/src/big.ts b/src/big.ts",
      "@@ -1,5 +1,25 @@",
      "+import React from 'react';",
      "+const foo = 42;",
      "+export default foo;",
      "+const bar = 99;",
      "+function baz() { return true; }",
      "+type Config = { key: string };",
    ].join("\n");

    const result = compress(lines, "git");
    expect(result).toContain("1 file changed");
    expect(result).toContain("+import React from 'react';");
    expect(result).toContain("+const foo = 42;");
    expect(result).toContain("+export default foo;");
    expect(result).not.toContain("const bar = 99");
    expect(result).not.toContain("function baz()");
    expect(result).not.toContain("type Config");
  });

  it("resets hunk line counter at new hunk header", () => {
    // Use distinctly different lines to avoid groupLines collapsing
    const lines = [
      " src/multi.ts | 10 +++++",
      " 1 file changed, 10 insertions(+)",
      "diff --git a/src/multi.ts b/src/multi.ts",
      "@@ -1,3 +1,6 @@",
      "+import fs from 'node:fs';",
      "+import path from 'node:path';",
      "+import os from 'node:os';",
      "+const shouldBeTruncated = true;",
      "@@ -20,3 +23,6 @@",
      "+export function main() {}",
      "+export function helper() {}",
      "+export function util() {}",
      "+export const TRUNCATED_CONST = false;",
    ].join("\n");

    const result = compress(lines, "git");
    // First hunk: 3 lines kept, 4th truncated
    expect(result).toContain("+import os from 'node:os';");
    expect(result).not.toContain("shouldBeTruncated");
    // Second hunk: counter resets, 3 lines kept
    expect(result).toContain("@@ -20,3 +23,6 @@");
    expect(result).toContain("+export function util() {}");
    expect(result).not.toContain("TRUNCATED_CONST");
  });

  it("resets hunk line counter at new diff header", () => {
    const lines = [
      " 2 files changed, 10 insertions(+)",
      "diff --git a/src/alpha.ts b/src/alpha.ts",
      "@@ -1,3 +1,6 @@",
      "+const alpha = 'first';",
      "+const bravo = 'second';",
      "+const charlie = 'third';",
      "+const delta_truncated = 'fourth';",
      "diff --git a/src/beta.ts b/src/beta.ts",
      "@@ -1,3 +1,6 @@",
      "+const echo = 'fifth';",
      "+const foxtrot = 'sixth';",
      "+const golf = 'seventh';",
      "+const hotel_truncated = 'eighth';",
    ].join("\n");

    const result = compress(lines, "git");
    expect(result).toContain("+const charlie = 'third';");
    expect(result).not.toContain("delta_truncated");
    expect(result).toContain("diff --git a/src/beta.ts b/src/beta.ts");
    expect(result).toContain("+const golf = 'seventh';");
    expect(result).not.toContain("hotel_truncated");
  });

  it("passes through non-diff output unchanged", () => {
    const input = "no diff here\njust regular output";
    const result = compress(input, "git");
    expect(result).toContain("no diff here");
    expect(result).toContain("just regular output");
  });

  it("keeps pre-stat lines as-is", () => {
    const lines = [
      " README.md | 2 +-",
      " src/app.ts | 50 ++++++++++++++++++++",
      " 2 files changed, 51 insertions(+), 1 deletion(-)",
    ].join("\n");

    const result = compress(lines, "git");
    expect(result).toContain("README.md | 2 +-");
    expect(result).toContain("2 files changed");
  });

  it("handles diff with stat but no hunks after it", () => {
    const lines = [
      " 1 file changed, 1 insertion(+)",
    ].join("\n");

    const result = compress(lines, "git");
    expect(result).toContain("1 file changed");
  });
});

// ──────────────────────────────────────────
// npm rules
// ──────────────────────────────────────────

describe("npm rules", () => {
  it("compresses npm install output", () => {
    const input = [
      "npm warn deprecated something",
      "npm warn deprecated another",
      "added 150 packages in 3s",
    ].join("\n");

    const result = compress(input, "npm");
    expect(result).toContain("added 150 packages");
  });

  it("keeps dependency section lines in npm install", () => {
    const input = [
      "dependencies:",
      "  lodash 4.17.21",
      "devDependencies:",
      "  vitest 1.0.0",
      "added 10 packages in 1s",
    ].join("\n");

    const result = compress(input, "npm");
    expect(result).toContain("dependencies:");
    expect(result).toContain("devDependencies:");
    expect(result).toContain("added 10 packages");
  });

  it("keeps + package@version lines in npm install", () => {
    const input = [
      "+ lodash@4.17.21",
      "+ express@4.18.2",
      "added 50 packages in 2s",
    ].join("\n");

    const result = compress(input, "npm");
    expect(result).toContain("+ lodash@4.17.21");
    expect(result).toContain("+ express@4.18.2");
  });

  it("compresses npm audit output", () => {
    const input = [
      "# npm audit report",
      "",
      "lodash  <4.17.21",
      "Severity: high",
      "Prototype Pollution",
      "",
      "2 vulnerabilities (1 moderate, 1 high)",
    ].join("\n");

    const result = compress(input, "npm");
    expect(result).toContain("vulnerabilit");
  });

  it("keeps severity breakdown lines in npm audit", () => {
    const input = [
      "# npm audit report",
      "high | 3",
      "moderate | 2",
      "5 vulnerabilities (2 moderate, 3 high)",
    ].join("\n");

    const result = compress(input, "npm");
    expect(result).toContain("high | 3");
    expect(result).toContain("moderate | 2");
    expect(result).toContain("5 vulnerabilities");
  });

  it("compresses npm test output", () => {
    const input = [
      "PASS src/utils.test.ts",
      "PASS src/cli.test.ts",
      "FAIL src/broken.test.ts",
      "",
      "Tests  3 total",
    ].join("\n");

    const result = compress(input, "npm");
    expect(result).toContain("FAIL");
    expect(result).toContain("Tests");
  });

  it("keeps error details in npm test output", () => {
    const input = [
      "FAIL src/broken.test.ts",
      "Error: something went wrong",
      "Expected: true",
      "Received: false",
      "at Object.<anonymous> (src/broken.test.ts:5:3)",
      "Tests  1 failed, 1 total",
    ].join("\n");

    const result = compress(input, "npm");
    expect(result).toContain("Error: something went wrong");
    expect(result).toContain("Expected: true");
    expect(result).toContain("Received: false");
    expect(result).toContain("at Object.<anonymous>");
  });

  it("keeps Duration/Time lines in npm test output", () => {
    const input = [
      "PASS src/utils.test.ts",
      "Duration  3.5s",
      "Time:     5.2s",
      "Tests  10 passed, 10 total",
    ].join("\n");

    const result = compress(input, "npm");
    expect(result).toContain("Duration");
    expect(result).toContain("Time:");
  });

  it("returns original npm test lines when no patterns match", () => {
    // hasSummary matches but no individual lines match keep conditions
    const input = [
      "random preamble",
      "1 passed",
      "random epilogue",
    ].join("\n");

    const result = compress(input, "npm");
    expect(result).toContain("1 passed");
  });

  it("returns original npm audit lines when no summary found", () => {
    const input = [
      "# npm audit report",
      "checking packages",
      "1 vulnerability found",
    ].join("\n");

    const result = compress(input, "npm");
    expect(result).toContain("1 vulnerability found");
  });
});

// ──────────────────────────────────────────
// tsc rule
// ──────────────────────────────────────────

describe("tsc rule", () => {
  it("compresses TypeScript errors", () => {
    const input = [
      "src/index.ts:10:5 - error TS2322: Type 'string' is not assignable to type 'number'.",
      "src/index.ts:15:3 - error TS2345: Argument of type 'string' is not assignable.",
      "src/index.ts:20:7 - error TS2339: Property 'foo' does not exist on type 'Bar'.",
      "src/cli.ts:5:1 - error TS2304: Cannot find name 'foo'.",
      "",
      "Found 4 errors.",
    ].join("\n");

    const result = compress(input, "tsc");
    expect(result).toContain("src/index.ts");
    expect(result).toContain("Found 4 error");
  });

  it("passes through clean tsc output", () => {
    const input = "no output";
    const result = compress(input, "tsc");
    expect(result).toContain("no output");
  });
});

// ──────────────────────────────────────────
// test-runner rules
// ──────────────────────────────────────────

describe("test-runner rules", () => {
  it("compresses vitest output", () => {
    const input = [
      " Test Files  55 passed (55)",
      "      Tests  588 passed (588)",
      "   Start at  12:00:00",
      "   Duration  3.5s",
    ].join("\n");

    const result = compress(input, "vitest");
    expect(result).toContain("Test Files");
    expect(result).toContain("Tests");
  });

  it("keeps vitest FAIL file-level results", () => {
    const input = [
      "FAIL src/broken.test.ts > suite > should work",
      " Test Files  1 failed | 2 passed (3)",
      "      Tests  1 failed | 10 passed (11)",
      "   Duration  2.1s",
    ].join("\n");

    const result = compress(input, "vitest");
    expect(result).toContain("FAIL src/broken.test.ts");
    expect(result).toContain("Test Files");
  });

  it("keeps vitest assertion error lines", () => {
    const input = [
      "AssertionError: expected 1 to be 2",
      "Expected: 2",
      "Received: 1",
      " Test Files  1 failed (1)",
      "      Tests  1 failed (1)",
    ].join("\n");

    const result = compress(input, "vitest");
    expect(result).toContain("AssertionError");
    expect(result).toContain("Expected: 2");
    expect(result).toContain("Received: 1");
  });

  it("keeps vitest check-mark failure lines", () => {
    const input = [
      "\u2717 src/bad.test.ts > should pass",
      " Test Files  1 failed (1)",
      "      Tests  1 failed (1)",
    ].join("\n");

    const result = compress(input, "vitest");
    expect(result).toContain("src/bad.test.ts");
  });

  it("returns original lines when vitest produces no matched output", () => {
    // This triggers isVitest (due to Tests pattern) but no lines match the keep conditions
    const input = [
      "some random preamble output",
      "Tests 0",
      "more random output",
    ].join("\n");

    const result = compress(input, "vitest");
    expect(result).toContain("Tests 0");
  });

  it("compresses jest output", () => {
    const input = [
      "PASS src/test1.test.ts",
      "FAIL src/test2.test.ts",
      "  . should work",
      "Test Suites: 1 failed, 1 passed, 2 total",
      "Tests:       1 failed, 5 passed, 6 total",
    ].join("\n");

    const result = compress(input, "jest");
    expect(result).toContain("FAIL");
    expect(result).toContain("Test Suites");
  });

  it("keeps jest bullet failure markers", () => {
    const input = [
      "FAIL src/broken.test.ts",
      "  \u25cf suite > should work",
      "    expect(received).toBe(expected)",
      "Test Suites: 1 failed, 1 total",
      "Tests:       1 failed, 1 total",
    ].join("\n");

    const result = compress(input, "jest");
    expect(result).toContain("\u25cf suite > should work");
    expect(result).toContain("FAIL src/broken.test.ts");
  });

  it("returns original jest lines when no patterns match", () => {
    // isJest matches (has "Tests:") but nothing else matches keep conditions
    const input = [
      "some preamble",
      "Tests: 0",
      "end",
    ].join("\n");

    const result = compress(input, "jest");
    expect(result).toContain("Tests: 0");
  });

  it("compresses pytest output", () => {
    const input = [
      "test_one.py::test_thing PASSED",
      "test_two.py::test_other FAILED",
      "FAILED test_two.py::test_other",
      "==================== 1 failed, 1 passed ====================",
    ].join("\n");

    const result = compress(input, "pytest");
    expect(result).toContain("failed");
    expect(result).toContain("passed");
  });

  it("keeps pytest SHORT TEST SUMMARY section header", () => {
    const input = [
      "FAILED test_a.py::test_x",
      "SHORT TEST SUMMARY INFO",
      "==================== 1 failed, 1 passed ====================",
    ].join("\n");

    const result = compress(input, "pytest");
    expect(result).toContain("SHORT TEST SUMMARY");
    expect(result).toContain("FAILED test_a.py::test_x");
  });

  it("keeps pytest ERRORS section header", () => {
    const input = [
      "ERRORS",
      "==================== 1 failed ====================",
    ].join("\n");

    const result = compress(input, "pytest");
    expect(result).toContain("ERRORS");
  });

  it("compresses go test output", () => {
    const input = [
      "--- FAIL: TestSomething (0.01s)",
      "ok  \tgithub.com/user/pkg\t0.5s",
      "FAIL\tgithub.com/user/pkg2\t1.0s",
    ].join("\n");

    const result = compress(input, "go");
    expect(result).toContain("FAIL");
    expect(result).toContain("ok");
  });

  it("passes through non-go-test output unchanged", () => {
    // Input doesn't match isGoTest (no "ok", "FAIL", or "---" prefix)
    const input = [
      "building package",
      "compilation complete",
    ].join("\n");

    const result = compress(input, "go");
    expect(result).toContain("building package");
    expect(result).toContain("compilation complete");
  });
});

// ──────────────────────────────────────────
// generic rule
// ──────────────────────────────────────────

describe("generic rule", () => {
  it("passes through lines unchanged", () => {
    const input = "hello world\nfoo bar baz\nthe quick fox";
    const result = compress(input);
    expect(result).toContain("hello world");
    expect(result).toContain("foo bar baz");
  });
});
