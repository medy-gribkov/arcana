import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzeSession, trimSession } from "./trim.js";

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
    __setFile: (p: string, data: string) => {
      store[p] = data;
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

describe("analyzeSession", () => {
  it("returns zeros for nonexistent file", () => {
    const result = analyzeSession("/nonexistent.jsonl");
    expect(result.originalLines).toBe(0);
    expect(result.trimmedLines).toBe(0);
    expect(result.savedBytes).toBe(0);
  });

  it("analyzes a simple session", async () => {
    const fs = await import("node:fs");
    const lines = [
      JSON.stringify({ role: "user", content: "hello" }),
      JSON.stringify({ role: "assistant", content: "hi there" }),
    ].join("\n");
    (fs as unknown as { __setFile: (p: string, d: string) => void }).__setFile("/test.jsonl", lines);

    const result = analyzeSession("/test.jsonl");
    expect(result.originalLines).toBe(2);
    expect(result.toolResultsTrimmed).toBe(0);
    expect(result.base64Removed).toBe(0);
  });

  it("detects large tool results", async () => {
    const fs = await import("node:fs");
    const largeContent = "x".repeat(1000);
    const lines = [
      JSON.stringify({ role: "tool", content: largeContent }),
      JSON.stringify({ role: "user", content: "short" }),
    ].join("\n");
    (fs as unknown as { __setFile: (p: string, d: string) => void }).__setFile("/test.jsonl", lines);

    const result = analyzeSession("/test.jsonl");
    expect(result.toolResultsTrimmed).toBe(1);
    expect(result.savedBytes).toBeGreaterThan(0);
  });

  it("detects base64 images", async () => {
    const fs = await import("node:fs");
    const lines = [
      JSON.stringify({ role: "assistant", content: "data:image/png;base64,abc123..." }),
      JSON.stringify({ role: "user", content: "what is this?" }),
    ].join("\n");
    (fs as unknown as { __setFile: (p: string, d: string) => void }).__setFile("/test.jsonl", lines);

    const result = analyzeSession("/test.jsonl");
    expect(result.base64Removed).toBe(1);
  });

  it("handles malformed JSON lines gracefully", async () => {
    const fs = await import("node:fs");
    const lines = ["not json\n" + JSON.stringify({ role: "user", content: "hello" })].join("\n");
    (fs as unknown as { __setFile: (p: string, d: string) => void }).__setFile("/test.jsonl", lines);

    const result = analyzeSession("/test.jsonl");
    expect(result.originalLines).toBeGreaterThanOrEqual(1);
  });
});

describe("trimSession", () => {
  it("returns null for nonexistent file", () => {
    expect(trimSession("/nonexistent.jsonl")).toBeNull();
  });

  it("trims large tool results", async () => {
    const fs = await import("node:fs");
    const largeContent = "x".repeat(1000);
    const lines = [
      JSON.stringify({ role: "tool", content: largeContent }),
      JSON.stringify({ role: "user", content: "short" }),
    ].join("\n");
    (fs as unknown as { __setFile: (p: string, d: string) => void }).__setFile("/test.jsonl", lines);

    const result = trimSession("/test.jsonl");
    expect(result).not.toBeNull();
    expect(result!.result.toolResultsTrimmed).toBe(1);
    expect(result!.result.savedBytes).toBeGreaterThan(0);
    expect(result!.destPath).toContain("trimmed");
  });

  it("replaces base64 content with stub", async () => {
    const fs = await import("node:fs");
    const lines = [
      JSON.stringify({ role: "assistant", type: "image", content: "data:image/png;base64,longdata..." }),
    ].join("\n");
    (fs as unknown as { __setFile: (p: string, d: string) => void }).__setFile("/test.jsonl", lines);

    const result = trimSession("/test.jsonl");
    expect(result).not.toBeNull();
    expect(result!.result.base64Removed).toBe(1);
  });

  it("preserves small messages", async () => {
    const fs = await import("node:fs");
    const lines = [
      JSON.stringify({ role: "user", content: "hello" }),
      JSON.stringify({ role: "assistant", content: "hi" }),
    ].join("\n");
    (fs as unknown as { __setFile: (p: string, d: string) => void }).__setFile("/test.jsonl", lines);

    const result = trimSession("/test.jsonl");
    expect(result).not.toBeNull();
    expect(result!.result.toolResultsTrimmed).toBe(0);
    expect(result!.result.base64Removed).toBe(0);
  });
});
