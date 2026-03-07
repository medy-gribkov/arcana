import { describe, it, expect, beforeEach } from "vitest";
import { compress, compressionStats, registerRule } from "./engine.js";

describe("compress", () => {
  it("returns input unchanged when short", () => {
    const input = "hello world\nfoo bar baz\nthe quick fox";
    const result = compress(input);
    expect(result).toContain("hello world");
    expect(result).toContain("foo bar baz");
    expect(result).toContain("the quick fox");
  });

  it("filters spinner lines", () => {
    const input = "⠋ Loading...\n⠙ Loading...\nDone!";
    const result = compress(input);
    expect(result).not.toContain("⠋");
    expect(result).not.toContain("⠙");
    expect(result).toContain("Done!");
  });

  it("filters timing-only lines", () => {
    const input = "Building...\n  250ms\n  1.5s\nComplete";
    const result = compress(input);
    expect(result).not.toContain("250ms");
    expect(result).toContain("Complete");
  });

  it("groups similar consecutive lines", () => {
    const lines = Array.from({ length: 10 }, (_, i) => `Downloading package ${i + 1}...`);
    const input = lines.join("\n");
    const result = compress(input);
    expect(result).toContain("similar");
  });

  it("truncates output beyond maxLines", () => {
    // Use truly diverse lines that won't be grouped by normalization
    const words = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet"];
    const lines = Array.from({ length: 200 }, (_, i) => `${words[i % words.length]} says ${String.fromCharCode(65 + (i % 26))} about ${words[(i + 3) % words.length]}`);
    const input = lines.join("\n");
    const result = compress(input, undefined, 50);
    expect(result).toContain("omitted");
  });

  it("deduplicates consecutive blank lines", () => {
    const input = "line1\n\n\n\nline2";
    const result = compress(input);
    const blanks = result.split("\n").filter((l) => l.trim() === "");
    // Should collapse multiple blanks into one
    expect(blanks.length).toBeLessThanOrEqual(1);
  });

  it("strips ANSI codes for processing", () => {
    const input = "\x1b[32mSuccess\x1b[0m\nDone";
    const result = compress(input);
    expect(result).toContain("Success");
    expect(result).toContain("Done");
  });

  it("applies tool-specific rules when tool is provided", () => {
    registerRule({
      name: "test-rule",
      tools: ["test-tool"],
      compress: (lines) => lines.map((l) => l.toUpperCase()),
    });
    const result = compress("hello\nworld", "test-tool");
    expect(result).toContain("HELLO");
  });

  it("handles empty input", () => {
    expect(compress("")).toBe("");
  });

  it("does not truncate when under maxLines", () => {
    const input = "a\nb\nc";
    const result = compress(input, undefined, 100);
    expect(result).not.toContain("omitted");
  });

  it("filters pipe/slash/dash spinner chars", () => {
    const input = "| progress\n/ loading\n- step\nreal content";
    const result = compress(input);
    expect(result).not.toContain("| progress");
    expect(result).toContain("real content");
  });
});

describe("compressionStats", () => {
  it("calculates token savings", () => {
    const original = "a".repeat(400); // ~100 tokens
    const compressed = "a".repeat(200); // ~50 tokens
    const stats = compressionStats(original, compressed);
    expect(stats.originalTokens).toBe(100);
    expect(stats.compressedTokens).toBe(50);
    expect(stats.savedTokens).toBe(50);
    expect(stats.savedPct).toBe(50);
  });

  it("handles empty strings", () => {
    const stats = compressionStats("", "");
    expect(stats.originalTokens).toBe(0);
    expect(stats.savedPct).toBe(0);
  });

  it("handles no compression", () => {
    const text = "hello world";
    const stats = compressionStats(text, text);
    expect(stats.savedTokens).toBe(0);
    expect(stats.savedPct).toBe(0);
  });
});
