import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tempHome: string;

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, homedir: () => tempHome };
});

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "arcana-compact-test-"));
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

function createProjectData(projectName: string, files: { name: string; content: string; isDir?: boolean }[]) {
  const projDir = join(tempHome, ".claude", "projects", projectName);
  mkdirSync(projDir, { recursive: true });
  for (const f of files) {
    if (f.isDir) {
      const dir = join(projDir, f.name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "data.jsonl"), f.content, "utf-8");
    } else {
      writeFileSync(join(projDir, f.name), f.content, "utf-8");
    }
  }
  return projDir;
}

describe("compactCommand", () => {
  it("reports no session data when projects dir missing (JSON mode)", async () => {
    const { compactCommand } = await import("./compact.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await compactCommand({ json: true });

    const output = spy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.projects).toEqual([]);
    expect(parsed.totalReclaimed).toBe(0);

    spy.mockRestore();
  });

  it("identifies agent logs as reclaimable in dry run", async () => {
    createProjectData("test-project", [
      { name: "session-abc.jsonl", content: "main session data" },
      { name: "agent-123.jsonl", content: "agent subagent log data" },
      { name: "agent-456.jsonl", content: "another agent log" },
    ]);

    const { compactCommand } = await import("./compact.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await compactCommand({ dryRun: true, json: true });

    const output = spy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.projects.length).toBe(1);
    expect(parsed.projects[0].agentLogs).toBe(2);
    expect(parsed.projects[0].mainSessions).toBe(1);
    expect(parsed.totalReclaimed).toBe(0); // dry run

    spy.mockRestore();
  });

  it("deletes agent logs when not dry run", async () => {
    const projDir = createProjectData("test-project", [
      { name: "session-abc.jsonl", content: "main session data" },
      { name: "agent-123.jsonl", content: "agent log data that should be deleted" },
    ]);

    const { compactCommand } = await import("./compact.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await compactCommand({ dryRun: false, json: true });

    expect(existsSync(join(projDir, "agent-123.jsonl"))).toBe(false);
    expect(existsSync(join(projDir, "session-abc.jsonl"))).toBe(true);

    spy.mockRestore();
  });

  it("deletes session subdirectories", async () => {
    const projDir = createProjectData("test-project", [
      { name: "session-abc.jsonl", content: "main" },
      { name: "subdir-session", content: "session dir data", isDir: true },
    ]);

    const { compactCommand } = await import("./compact.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await compactCommand({ dryRun: false, json: true });

    expect(existsSync(join(projDir, "subdir-session"))).toBe(false);
    expect(existsSync(join(projDir, "session-abc.jsonl"))).toBe(true);

    spy.mockRestore();
  });

  it("preserves memory directory", async () => {
    const projDir = join(tempHome, ".claude", "projects", "test-project");
    mkdirSync(join(projDir, "memory"), { recursive: true });
    writeFileSync(join(projDir, "memory", "MEMORY.md"), "important context", "utf-8");
    writeFileSync(join(projDir, "agent-001.jsonl"), "delete me", "utf-8");

    const { compactCommand } = await import("./compact.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await compactCommand({ dryRun: false, json: true });

    expect(existsSync(join(projDir, "memory", "MEMORY.md"))).toBe(true);

    spy.mockRestore();
  });

  it("handles empty projects dir gracefully", async () => {
    mkdirSync(join(tempHome, ".claude", "projects"), { recursive: true });

    const { compactCommand } = await import("./compact.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await compactCommand({ json: true });

    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed.projects).toEqual([]);

    spy.mockRestore();
  });

  it("produces human-readable output in non-JSON mode", async () => {
    createProjectData("test-project", [
      { name: "session-abc.jsonl", content: "main" },
      { name: "agent-123.jsonl", content: "agent" },
    ]);

    const { compactCommand } = await import("./compact.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await compactCommand({ dryRun: true });

    const output = spy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("DRY RUN");

    spy.mockRestore();
  });
});
