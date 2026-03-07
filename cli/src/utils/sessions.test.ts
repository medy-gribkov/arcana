import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";

/**
 * We test findLatestSession by creating temp directories that mimic
 * the ~/.claude/projects/<encoded-cwd>/ structure. Since findLatestSession
 * uses homedir() to locate projects, we test by calling it with a cwd
 * that, once encoded, matches a directory we create under the real homedir.
 *
 * To avoid polluting the real homedir, we instead use a direct test approach:
 * create a temp dir, put .jsonl files in it, and verify the logic via
 * a re-import with a mocked homedir.
 */

describe("findLatestSession", () => {
  let tempDir: string;
  let projectsDir: string;
  let homedirOriginal: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "arcana-sessions-test-"));
    projectsDir = join(tempDir, ".claude", "projects");
    mkdirSync(projectsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper: imports findLatestSession with a mocked homedir so it looks
   * in our temp directory instead of the real home.
   */
  async function importWithMockedHome(): Promise<typeof import("./sessions.js")> {
    const { vi } = await import("vitest");
    vi.resetModules();
    vi.doMock("node:os", () => ({
      homedir: () => tempDir,
    }));
    return import("./sessions.js");
  }

  it("returns null when projects directory does not exist", async () => {
    // Use a tempDir that has no .claude/projects
    const emptyTemp = mkdtempSync(join(tmpdir(), "arcana-sessions-empty-"));
    const { vi } = await import("vitest");
    vi.resetModules();
    vi.doMock("node:os", () => ({
      homedir: () => emptyTemp,
    }));
    const { findLatestSession } = await import("./sessions.js");

    const result = findLatestSession("/some/project");
    expect(result).toBeNull();

    rmSync(emptyTemp, { recursive: true, force: true });
    vi.resetModules();
  });

  it("returns null when no matching project directory exists", async () => {
    const { findLatestSession } = await importWithMockedHome();

    // projectsDir exists but has no subdirectory matching the encoded cwd
    const result = findLatestSession("/no/such/project");
    expect(result).toBeNull();
  });

  it("finds the newest .jsonl file in the matching project directory", async () => {
    // Encode "/test/project" -> "test-project"
    const encoded = "test-project";
    const projDir = join(projectsDir, encoded);
    mkdirSync(projDir, { recursive: true });

    // Create two .jsonl files with different mtimes
    const oldFile = join(projDir, "old-session.jsonl");
    const newFile = join(projDir, "new-session.jsonl");
    writeFileSync(oldFile, '{"type":"message"}\n');

    // Ensure different mtime by using a small delay via utimes
    const { utimesSync } = await import("node:fs");
    const oldTime = new Date(Date.now() - 60000);
    utimesSync(oldFile, oldTime, oldTime);

    writeFileSync(newFile, '{"type":"message"}\n');

    const { findLatestSession } = await importWithMockedHome();
    // The cwd "/test/project" gets encoded: replace /:\\ with -, strip leading -
    // "/test/project" -> "-test-project" -> "test-project"
    const result = findLatestSession("/test/project");
    expect(result).toBe(newFile);
  });

  it("ignores non-.jsonl files", async () => {
    const encoded = "my-project";
    const projDir = join(projectsDir, encoded);
    mkdirSync(projDir, { recursive: true });

    writeFileSync(join(projDir, "notes.txt"), "not a session");
    writeFileSync(join(projDir, "data.json"), "{}");

    const { findLatestSession } = await importWithMockedHome();
    const result = findLatestSession("/my/project");
    expect(result).toBeNull();
  });

  it("returns the only .jsonl file when there is one", async () => {
    const encoded = "single-project";
    const projDir = join(projectsDir, encoded);
    mkdirSync(projDir, { recursive: true });

    const sessionFile = join(projDir, "session-001.jsonl");
    writeFileSync(sessionFile, '{"type":"init"}\n');

    const { findLatestSession } = await importWithMockedHome();
    const result = findLatestSession("/single/project");
    expect(result).toBe(sessionFile);
  });

  it("tries lowercase variant of encoded path", async () => {
    // "C:/Users/Test" encodes: replace [:/\\] with "-" -> "C--Users-Test"
    // lowercase variant -> "c--users-test"
    // On Windows, filesystem is case-insensitive so both variants match.
    // On Linux, only the lowercase directory would be found via the second variant.
    // We verify the function finds the session file regardless.
    const encoded = "c--users-test";
    const projDir = join(projectsDir, encoded);
    mkdirSync(projDir, { recursive: true });

    const sessionFile = join(projDir, "session.jsonl");
    writeFileSync(sessionFile, '{"type":"init"}\n');

    const { findLatestSession } = await importWithMockedHome();
    const result = findLatestSession("C:/Users/Test");
    expect(result).not.toBeNull();
    expect(result!.endsWith("session.jsonl")).toBe(true);
  });
});
