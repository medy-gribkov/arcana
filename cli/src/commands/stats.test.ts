import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Normalize paths for cross-platform testing
const normPath = (p: string) => p.replace(/\\/g, "/");

// Mock modules at top level
vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/fake/home"),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  openSync: vi.fn(),
  readSync: vi.fn(),
  closeSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock("../utils/fs.js", () => ({
  getDirSize: vi.fn(),
}));

vi.mock("../utils/history.js", () => ({
  readHistory: vi.fn(() => []),
}));

vi.mock("../utils/ui.js", () => ({
  ui: {
    dim: (s: string) => s,
    bold: (s: string) => s,
    warn: (s: string) => s,
  },
  banner: vi.fn(),
  table: vi.fn(),
}));

describe("statsCommand", () => {
  let mockFs: typeof import("node:fs");
  let mockFsUtils: typeof import("../utils/fs.js");
  let mockUi: typeof import("../utils/ui.js");
  let mockOs: typeof import("node:os");
  let statsCommand: (opts: Record<string, unknown>) => Promise<void>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFs = await import("node:fs");
    mockFsUtils = await import("../utils/fs.js");
    mockUi = await import("../utils/ui.js");
    mockOs = await import("node:os");
    const statsModule = await import("./stats.js");
    statsCommand = statsModule.statsCommand;

    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty stats in JSON mode when no sessions found", async () => {
    mockFs.existsSync.mockReturnValue(false);

    await statsCommand({ json: true });

    const calls = vi.mocked(console.log).mock.calls;
    expect(calls[0]![0]).toBe(JSON.stringify({ totalSessions: 0, totalProjects: 0 }));
  });

  it("returns full JSON structure with sessions", async () => {
    // Mock file system with sessions
    mockFs.existsSync.mockImplementation((path: string) => {
      const normalized = normPath(path);
      if (normalized.includes(".claude/projects")) return true;
      if (normalized.includes(".claude/file-history")) return true;
      if (normalized.includes(".claude/debug")) return true;
      return false;
    });

    mockFs.readdirSync.mockImplementation((path: string) => {
      const normalized = normPath(path);
      if (normalized === "/fake/home/.claude/projects") return ["proj-a", "proj-b"];
      if (normalized === "/fake/home/.claude/projects/proj-a") return ["session1.jsonl", "session2.jsonl"];
      if (normalized === "/fake/home/.claude/projects/proj-b") return ["session3.jsonl"];
      if (normalized === "/fake/home/.claude") return ["projects", "file-history", "debug"];
      return [];
    });

    mockFs.statSync.mockImplementation((path: string) => {
      const normalized = normPath(path);
      if (normalized.endsWith(".jsonl")) {
        return {
          size: 2048,
          mtime: new Date("2025-01-15"),
          isDirectory: () => false,
        };
      }
      return { isDirectory: () => true };
    });

    // Track which file descriptor we're reading
    const fdMap = new Map<number, number>();
    let nextFd = 1;

    mockFs.openSync.mockImplementation(() => {
      const fd = nextFd++;
      fdMap.set(fd, 0); // Read count for this fd
      return fd;
    });

    mockFs.readSync.mockImplementation((fd: number, buffer: Buffer) => {
      const readCount = fdMap.get(fd) || 0;
      fdMap.set(fd, readCount + 1);

      if (readCount === 0) {
        // First read: return some data with newlines
        const data = Buffer.from("line1\nline2\nline3\n");
        data.copy(buffer);
        return data.length;
      }
      return 0; // EOF on subsequent reads
    });

    mockFs.closeSync.mockImplementation((fd: number) => {
      fdMap.delete(fd);
    });

    mockFsUtils.getDirSize.mockImplementation((path: string) => {
      const normalized = normPath(path);
      if (normalized.includes("proj-a")) return 4096;
      if (normalized.includes("proj-b")) return 2048;
      if (normalized.includes("projects") && !normalized.includes("proj-")) return 10240;
      if (normalized.includes("file-history")) return 5120;
      if (normalized.includes("debug")) return 2048;
      return 0;
    });

    await statsCommand({ json: true });

    const calls = vi.mocked(console.log).mock.calls;
    const output = calls[0]![0] as string;
    const parsed = JSON.parse(output);

    expect(parsed).toHaveProperty("totalSessions");
    expect(parsed).toHaveProperty("totalProjects");
    expect(parsed).toHaveProperty("totalSizeBytes");
    expect(parsed).toHaveProperty("estimatedTokens");
    expect(parsed).toHaveProperty("avgLinesPerSession");
    expect(parsed).toHaveProperty("topProjects");
    expect(parsed).toHaveProperty("diskBreakdown");
    expect(parsed).toHaveProperty("projectBreakdown");
    expect(parsed).toHaveProperty("reclaimableBytes");

    expect(parsed.totalSessions).toBeGreaterThan(0);
    expect(parsed.totalProjects).toBeGreaterThan(0);
    expect(parsed.totalSizeBytes).toBeGreaterThan(0);
    expect(parsed.estimatedTokens).toBeGreaterThan(0);
    expect(Array.isArray(parsed.topProjects)).toBe(true);
    expect(Array.isArray(parsed.diskBreakdown)).toBe(true);
    expect(Array.isArray(parsed.projectBreakdown)).toBe(true);
  });

  it("formats bytes correctly via JSON output", async () => {
    mockFs.existsSync.mockImplementation((path: string) => {
      const normalized = normPath(path);
      return normalized.includes(".claude/projects");
    });

    mockFs.readdirSync.mockImplementation((path: string) => {
      const normalized = normPath(path);
      if (normalized === "/fake/home/.claude/projects") return ["test-proj"];
      if (normalized === "/fake/home/.claude/projects/test-proj") return ["session.jsonl"];
      if (normalized === "/fake/home/.claude") return ["projects"];
      return [];
    });

    mockFs.statSync.mockImplementation((path: string) => {
      const normalized = normPath(path);
      if (normalized.endsWith(".jsonl")) {
        return {
          size: 1024 * 1024 * 5, // 5 MB
          mtime: new Date(),
          isDirectory: () => false,
        };
      }
      return { isDirectory: () => true };
    });

    const fdMap = new Map<number, number>();
    let nextFd = 1;

    mockFs.openSync.mockImplementation(() => {
      const fd = nextFd++;
      fdMap.set(fd, 0);
      return fd;
    });

    mockFs.readSync.mockImplementation((fd: number, buffer: Buffer) => {
      const readCount = fdMap.get(fd) || 0;
      fdMap.set(fd, readCount + 1);

      if (readCount === 0) {
        const data = Buffer.from("line\n");
        data.copy(buffer);
        return data.length;
      }
      return 0;
    });

    mockFs.closeSync.mockImplementation((fd: number) => {
      fdMap.delete(fd);
    });

    mockFsUtils.getDirSize.mockReturnValue(1024 * 1024 * 5);

    await statsCommand({ json: true });

    const calls = vi.mocked(console.log).mock.calls;
    const parsed = JSON.parse(calls[0]![0] as string);

    expect(parsed.totalSizeBytes).toBe(1024 * 1024 * 5);
  });

  it("getDiskBreakdown reads subdirectories with correct sizes", async () => {
    mockFs.existsSync.mockImplementation((path: string) => {
      const normalized = normPath(path);
      if (normalized.includes(".claude/projects")) return true;
      if (normalized.includes(".claude/file-history")) return true;
      if (normalized.includes(".claude/debug")) return true;
      return false;
    });

    mockFs.readdirSync.mockImplementation((path: string) => {
      const normalized = normPath(path);
      if (normalized === "/fake/home/.claude/projects") return ["proj"];
      if (normalized === "/fake/home/.claude/projects/proj") return ["s.jsonl"];
      if (normalized === "/fake/home/.claude") return ["projects", "file-history", "debug"];
      return [];
    });

    mockFs.statSync.mockImplementation((path: string) => {
      const normalized = normPath(path);
      if (normalized.endsWith(".jsonl")) {
        return { size: 1024, mtime: new Date(), isDirectory: () => false };
      }
      return { isDirectory: () => true };
    });

    const fdMap = new Map<number, number>();
    let nextFd = 1;

    mockFs.openSync.mockImplementation(() => {
      const fd = nextFd++;
      fdMap.set(fd, 0);
      return fd;
    });

    mockFs.readSync.mockImplementation((fd: number, buffer: Buffer) => {
      const readCount = fdMap.get(fd) || 0;
      fdMap.set(fd, readCount + 1);

      if (readCount === 0) {
        const data = Buffer.from("line\n");
        data.copy(buffer);
        return data.length;
      }
      return 0;
    });

    mockFs.closeSync.mockImplementation((fd: number) => {
      fdMap.delete(fd);
    });

    mockFsUtils.getDirSize.mockImplementation((path: string) => {
      const normalized = normPath(path);
      if (normalized === "/fake/home/.claude/projects") return 10000;
      if (normalized.includes("file-history")) return 5000;
      if (normalized.includes("debug")) return 3000;
      return 0;
    });

    await statsCommand({ json: true });

    const calls = vi.mocked(console.log).mock.calls;
    const parsed = JSON.parse(calls[0]![0] as string);

    expect(parsed.diskBreakdown).toBeDefined();
    expect(parsed.diskBreakdown.length).toBeGreaterThan(0);

    const projectsEntry = parsed.diskBreakdown.find((d: { name: string; sizeBytes: number }) => d.name === "projects");
    expect(projectsEntry).toBeDefined();
    expect(projectsEntry.sizeBytes).toBe(10000);
  });

  it("getProjectBreakdown returns correct project data", async () => {
    mockFs.existsSync.mockReturnValue(true);

    mockFs.readdirSync.mockImplementation((path: string) => {
      const normalized = normPath(path);
      if (normalized === "/fake/home/.claude/projects") return ["proj-alpha", "proj-beta"];
      if (normalized === "/fake/home/.claude/projects/proj-alpha") return ["s1.jsonl", "s2.jsonl"];
      if (normalized === "/fake/home/.claude/projects/proj-beta") return ["s3.jsonl"];
      if (normalized === "/fake/home/.claude") return ["projects"];
      return [];
    });

    mockFs.statSync.mockImplementation((path: string) => {
      const normalized = normPath(path);
      if (normalized.endsWith(".jsonl")) {
        return { size: 512, mtime: new Date(), isDirectory: () => false };
      }
      return { isDirectory: () => true };
    });

    const fdMap = new Map<number, number>();
    let nextFd = 1;

    mockFs.openSync.mockImplementation(() => {
      const fd = nextFd++;
      fdMap.set(fd, 0);
      return fd;
    });

    mockFs.readSync.mockImplementation((fd: number, buffer: Buffer) => {
      const readCount = fdMap.get(fd) || 0;
      fdMap.set(fd, readCount + 1);

      if (readCount === 0) {
        const data = Buffer.from("line\n");
        data.copy(buffer);
        return data.length;
      }
      return 0;
    });

    mockFs.closeSync.mockImplementation((fd: number) => {
      fdMap.delete(fd);
    });

    mockFsUtils.getDirSize.mockImplementation((path: string) => {
      const normalized = normPath(path);
      if (normalized.includes("proj-alpha")) return 8192;
      if (normalized.includes("proj-beta")) return 4096;
      if (normalized === "/fake/home/.claude/projects") return 12288;
      return 0;
    });

    await statsCommand({ json: true });

    const calls = vi.mocked(console.log).mock.calls;
    const parsed = JSON.parse(calls[0]![0] as string);

    expect(parsed.projectBreakdown).toBeDefined();
    expect(parsed.projectBreakdown.length).toBe(2);

    const alphaProj = parsed.projectBreakdown.find(
      (p: { name: string; sizeBytes: number; sessions: number }) => p.name === "proj-alpha",
    );
    expect(alphaProj).toBeDefined();
    expect(alphaProj.sizeBytes).toBe(8192);
    expect(alphaProj.sessions).toBe(2);
  });

  it("calls banner in non-JSON mode but not JSON mode", async () => {
    mockFs.existsSync.mockReturnValue(false);

    await statsCommand({ json: false });
    expect(mockUi.banner).toHaveBeenCalled();

    vi.clearAllMocks();

    await statsCommand({ json: true });
    expect(mockUi.banner).not.toHaveBeenCalled();
  });

  it("calculates reclaimable bytes from auxiliary dirs", async () => {
    mockFs.existsSync.mockImplementation((path: string) => {
      const normalized = normPath(path);
      if (normalized.includes(".claude/projects")) return true;
      if (normalized.includes(".claude/file-history")) return true;
      if (normalized.includes(".claude/debug")) return true;
      if (normalized.includes(".claude/shell-snapshots")) return true;
      return false;
    });

    mockFs.readdirSync.mockImplementation((path: string) => {
      const normalized = normPath(path);
      if (normalized === "/fake/home/.claude/projects") return ["proj"];
      if (normalized === "/fake/home/.claude/projects/proj") return ["s.jsonl"];
      if (normalized === "/fake/home/.claude") return ["projects", "file-history", "debug", "shell-snapshots"];
      return [];
    });

    mockFs.statSync.mockImplementation((path: string) => {
      const normalized = normPath(path);
      if (normalized.endsWith(".jsonl")) {
        return { size: 100, mtime: new Date(), isDirectory: () => false };
      }
      return { isDirectory: () => true };
    });

    const fdMap = new Map<number, number>();
    let nextFd = 1;

    mockFs.openSync.mockImplementation(() => {
      const fd = nextFd++;
      fdMap.set(fd, 0);
      return fd;
    });

    mockFs.readSync.mockImplementation((fd: number, buffer: Buffer) => {
      const readCount = fdMap.get(fd) || 0;
      fdMap.set(fd, readCount + 1);

      if (readCount === 0) {
        const data = Buffer.from("line\n");
        data.copy(buffer);
        return data.length;
      }
      return 0;
    });

    mockFs.closeSync.mockImplementation((fd: number) => {
      fdMap.delete(fd);
    });

    mockFsUtils.getDirSize.mockImplementation((path: string) => {
      const normalized = normPath(path);
      if (normalized === "/fake/home/.claude/projects") return 1000;
      if (normalized.includes("file-history")) return 5000; // reclaimable
      if (normalized.includes("debug")) return 3000; // reclaimable
      if (normalized.includes("shell-snapshots")) return 2000; // reclaimable
      return 0;
    });

    await statsCommand({ json: true });

    const calls = vi.mocked(console.log).mock.calls;
    const parsed = JSON.parse(calls[0]![0] as string);

    expect(parsed.reclaimableBytes).toBe(10000); // 5000 + 3000 + 2000
  });
});
