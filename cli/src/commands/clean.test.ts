import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tempHome: string;

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, homedir: () => tempHome };
});

// Mock fs utilities that depend on config
vi.mock("../utils/fs.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/fs.js")>();
  return {
    ...actual,
    getInstallDir: () => join(tempHome, ".agents", "skills"),
    listSymlinks: () => [], // No symlinks in test
    isOrphanedProject: () => false, // No orphans by default
  };
});

// Mock history utility
vi.mock("../utils/history.js", () => ({
  clearHistory: () => {},
}));

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "arcana-clean-test-"));
});

afterEach(() => {
  if (tempHome && existsSync(tempHome)) {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {
      /* skip */
    }
  }
});

function setFileAge(filePath: string, daysOld: number) {
  const past = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  utimesSync(filePath, past, past);
}

function createProjectWithLogs(projectName: string, logs: { name: string; content: string; daysOld: number }[]) {
  const projDir = join(tempHome, ".claude", "projects", projectName);
  mkdirSync(projDir, { recursive: true });
  for (const log of logs) {
    const fullPath = join(projDir, log.name);
    writeFileSync(fullPath, log.content, "utf-8");
    setFileAge(fullPath, log.daysOld);
  }
  return projDir;
}

describe("cleanCommand", () => {
  it("reports nothing to clean when no data exists (JSON mode)", async () => {
    const { cleanCommand } = await import("./clean.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cleanCommand({ json: true, dryRun: true });

    const output = spy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.removedSessionLogs).toEqual([]);
    expect(parsed.removedProjects).toEqual([]);

    spy.mockRestore();
  });

  it("removes old agent logs (>7 days) in dry run", async () => {
    createProjectWithLogs("test-proj", [
      { name: "agent-old.jsonl", content: "old agent log", daysOld: 10 },
      { name: "agent-new.jsonl", content: "new agent log", daysOld: 2 },
      { name: "main-session.jsonl", content: "main session", daysOld: 5 },
    ]);

    const { cleanCommand } = await import("./clean.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cleanCommand({ json: true, dryRun: true });

    const output = spy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);
    const agentLogs = parsed.removedSessionLogs.filter((l: { reason: string }) => l.reason === "agent log");
    expect(agentLogs.length).toBe(1);
    expect(agentLogs[0].file).toBe("agent-old.jsonl");

    spy.mockRestore();
  });

  it("removes old main sessions (>30 days default) in dry run", async () => {
    createProjectWithLogs("test-proj", [
      { name: "old-session.jsonl", content: "old main session", daysOld: 35 },
      { name: "recent-session.jsonl", content: "recent main session", daysOld: 10 },
    ]);

    const { cleanCommand } = await import("./clean.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cleanCommand({ json: true, dryRun: true });

    const output = spy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);
    const mainLogs = parsed.removedSessionLogs.filter((l: { reason: string }) => l.reason === "main session");
    expect(mainLogs.length).toBe(1);
    expect(mainLogs[0].file).toBe("old-session.jsonl");

    spy.mockRestore();
  });

  it("aggressive mode removes everything regardless of age", async () => {
    createProjectWithLogs("test-proj", [
      { name: "agent-new.jsonl", content: "new agent", daysOld: 1 },
      { name: "main-new.jsonl", content: "new main", daysOld: 1 },
    ]);

    const { cleanCommand } = await import("./clean.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cleanCommand({ json: true, dryRun: true, aggressive: true });

    const output = spy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.removedSessionLogs.length).toBe(2);

    spy.mockRestore();
  });

  it("respects custom keepDays for main sessions", async () => {
    createProjectWithLogs("test-proj", [{ name: "session.jsonl", content: "main session", daysOld: 15 }]);

    const { cleanCommand } = await import("./clean.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cleanCommand({ json: true, dryRun: true, keepDays: 10 });

    const output = spy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);
    const mainLogs = parsed.removedSessionLogs.filter((l: { reason: string }) => l.reason === "main session");
    expect(mainLogs.length).toBe(1);

    spy.mockRestore();
  });

  it("purges auxiliary directories", async () => {
    const debugDir = join(tempHome, ".claude", "debug");
    mkdirSync(debugDir, { recursive: true });
    writeFileSync(join(debugDir, "log.txt"), "debug data", "utf-8");

    const { cleanCommand } = await import("./clean.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cleanCommand({ json: true, dryRun: true });

    const output = spy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.purgedDirs.some((d: { name: string }) => d.name === "debug")).toBe(true);

    spy.mockRestore();
  });

  it("actually deletes files when not dry run", async () => {
    const projDir = createProjectWithLogs("test-proj", [
      { name: "agent-old.jsonl", content: "delete me", daysOld: 10 },
      { name: "main-keep.jsonl", content: "keep me", daysOld: 2 },
    ]);

    const { cleanCommand } = await import("./clean.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cleanCommand({ json: true, dryRun: false });

    expect(existsSync(join(projDir, "agent-old.jsonl"))).toBe(false);
    expect(existsSync(join(projDir, "main-keep.jsonl"))).toBe(true);

    spy.mockRestore();
  });

  it("cleans arcana cache files", async () => {
    const cacheDir = join(tempHome, ".arcana", "cache");
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, "cached.json"), "{}", "utf-8");

    const { cleanCommand } = await import("./clean.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cleanCommand({ json: true, dryRun: false });

    expect(existsSync(join(cacheDir, "cached.json"))).toBe(false);

    spy.mockRestore();
  });

  it("produces human-readable output", async () => {
    const { cleanCommand } = await import("./clean.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cleanCommand({ dryRun: true });

    const output = spy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("DRY RUN");

    spy.mockRestore();
  });
});
