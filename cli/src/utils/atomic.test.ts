import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { atomicWriteSync } from "./atomic.js";

describe("atomicWriteSync", () => {
  it("writes file with correct content", () => {
    const dir = mkdtempSync(join(tmpdir(), "arcana-atomic-"));
    const filePath = join(dir, "test.txt");
    atomicWriteSync(filePath, "hello world");
    expect(readFileSync(filePath, "utf-8")).toBe("hello world");
  });

  it("creates parent directories", () => {
    const dir = mkdtempSync(join(tmpdir(), "arcana-atomic-"));
    const filePath = join(dir, "nested", "deep", "test.txt");
    atomicWriteSync(filePath, "nested content");
    expect(readFileSync(filePath, "utf-8")).toBe("nested content");
  });

  it("applies file mode on non-Windows", () => {
    if (process.platform === "win32") return; // Windows doesn't support Unix file modes
    const dir = mkdtempSync(join(tmpdir(), "arcana-atomic-"));
    const filePath = join(dir, "private.txt");
    atomicWriteSync(filePath, "secret", 0o600);
    const stat = statSync(filePath);
    // Check owner-only permissions (mask off umask bits)
    expect(stat.mode & 0o777).toBe(0o600);
  });
});
