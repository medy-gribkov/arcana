import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordCompression, getCompressionStats, resetCompressionStats } from "./tracker.js";

vi.mock("node:fs", async () => {
  let store: Record<string, string> = {};
  return {
    existsSync: (p: string) => p in store,
    readFileSync: (p: string) => {
      if (!(p in store)) throw new Error("ENOENT");
      return store[p];
    },
    mkdirSync: () => {},
    writeFileSync: (p: string, data: string) => {
      store[p] = data;
    },
    __reset: () => {
      store = {};
    },
  };
});

vi.mock("../utils/atomic.js", async () => {
  const fs = await import("node:fs");
  return {
    atomicWriteSync: (path: string, content: string) => {
      (fs as unknown as { writeFileSync: (p: string, d: string) => void }).writeFileSync(path, content);
    },
  };
});

beforeEach(async () => {
  const fs = await import("node:fs");
  (fs as unknown as { __reset: () => void }).__reset();
});

describe("recordCompression", () => {
  it("records a compression event", () => {
    recordCompression("git", 100, 30);
    const stats = getCompressionStats();
    expect(stats.totalInputTokens).toBe(100);
    expect(stats.totalOutputTokens).toBe(30);
    expect(stats.totalSaved).toBe(70);
  });

  it("accumulates across multiple calls", () => {
    recordCompression("git", 100, 30);
    recordCompression("npm", 200, 50);
    const stats = getCompressionStats();
    expect(stats.totalInputTokens).toBe(300);
    expect(stats.totalOutputTokens).toBe(80);
    expect(stats.totalSaved).toBe(220);
  });

  it("tracks per-tool stats", () => {
    recordCompression("git", 100, 30);
    recordCompression("git", 100, 40);
    recordCompression("npm", 200, 50);
    const stats = getCompressionStats();
    expect(stats.byTool["git"]!.calls).toBe(2);
    expect(stats.byTool["git"]!.savedTokens).toBe(130);
    expect(stats.byTool["npm"]!.calls).toBe(1);
  });
});

describe("getCompressionStats", () => {
  it("returns zeros when no data", () => {
    const stats = getCompressionStats();
    expect(stats.totalInputTokens).toBe(0);
    expect(stats.totalSaved).toBe(0);
    expect(stats.savingsPct).toBe(0);
  });

  it("calculates savings percentage", () => {
    recordCompression("git", 100, 25);
    const stats = getCompressionStats();
    expect(stats.savingsPct).toBe(75);
  });
});

describe("resetCompressionStats", () => {
  it("clears all stats", () => {
    recordCompression("git", 100, 30);
    resetCompressionStats();
    const stats = getCompressionStats();
    expect(stats.totalInputTokens).toBe(0);
    expect(stats.totalSaved).toBe(0);
    expect(stats.savingsPct).toBe(0);
  });
});
