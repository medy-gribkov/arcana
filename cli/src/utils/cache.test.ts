import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock modules at top level
vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/tmp/test-home"),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

vi.mock("./atomic.js", () => ({
  atomicWriteSync: vi.fn(),
}));

describe("cache", () => {
  let mockFs: typeof import("node:fs");
  let mockOs: typeof import("node:os");
  let mockAtomic: typeof import("./atomic.js");

  beforeEach(async () => {
    vi.resetModules();
    mockOs = await import("node:os");
    mockFs = await import("node:fs");
    mockAtomic = await import("./atomic.js");
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("readCache", () => {
    it("should return null when file does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);
      const { readCache } = await import("./cache.js");
      const result = readCache("test-key");
      expect(result).toBeNull();
      expect(mockFs.existsSync).toHaveBeenCalledWith(expect.stringContaining("test-key.json"));
    });

    it("should return null when cache is expired", async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        mtimeMs: now - 2 * 60 * 60 * 1000, // 2 hours ago
      });

      const { readCache } = await import("./cache.js");
      const result = readCache("test-key", 60 * 60 * 1000); // 1 hour TTL

      expect(result).toBeNull();
    });

    it("should return parsed data when valid and not expired", async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const testData = { foo: "bar", count: 42 };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        mtimeMs: now - 30 * 60 * 1000, // 30 minutes ago
      });
      mockFs.readFileSync.mockReturnValue(JSON.stringify(testData));

      const { readCache } = await import("./cache.js");
      const result = readCache("test-key", 60 * 60 * 1000); // 1 hour TTL

      expect(result).toEqual(testData);
    });

    it("should use default TTL of 24 hours (CACHE_MAX_AGE_MS)", async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const testData = { data: "test" };
      mockFs.existsSync.mockReturnValue(true);
      // 23 hours ago should still be valid with 24h TTL
      mockFs.statSync.mockReturnValue({
        mtimeMs: now - 23 * 60 * 60 * 1000,
      });
      mockFs.readFileSync.mockReturnValue(JSON.stringify(testData));

      const { readCache } = await import("./cache.js");
      const result = readCache("test-key");

      expect(result).toEqual(testData);
    });

    it("should expire after 24 hours with default TTL", async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      mockFs.existsSync.mockReturnValue(true);
      // 25 hours ago should be expired with 24h TTL
      mockFs.statSync.mockReturnValue({
        mtimeMs: now - 25 * 60 * 60 * 1000,
      });
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ data: "stale" }));

      const { readCache } = await import("./cache.js");
      const result = readCache("test-key");

      expect(result).toBeNull();
    });

    it("should import CACHE_MAX_AGE_MS from constants", async () => {
      const { CACHE_MAX_AGE_MS } = await import("../constants.js");
      expect(CACHE_MAX_AGE_MS).toBe(24 * 60 * 60 * 1000);
    });

    it("should return null on read error", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockImplementation(() => {
        throw new Error("Read error");
      });

      const { readCache } = await import("./cache.js");
      const result = readCache("test-key");

      expect(result).toBeNull();
    });

    it("should return null for invalid JSON", async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ mtimeMs: now - 1000 });
      mockFs.readFileSync.mockReturnValue("not valid json");

      const { readCache } = await import("./cache.js");
      const result = readCache("test-key");

      expect(result).toBeNull();
    });

    it("should handle complex data types", async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const testData = {
        array: [1, 2, 3],
        nested: { a: { b: { c: "deep" } } },
        null: null,
        bool: true,
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ mtimeMs: now - 1000 });
      mockFs.readFileSync.mockReturnValue(JSON.stringify(testData));

      const { readCache } = await import("./cache.js");
      const result = readCache("test-key");

      expect(result).toEqual(testData);
    });
  });

  describe("writeCache", () => {
    it("should create cache directory if not exists", async () => {
      mockFs.existsSync.mockReturnValue(false);
      const { writeCache } = await import("./cache.js");

      writeCache("test-key", { data: "test" });

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining("cache"), { recursive: true });
    });

    it("should write JSON via atomicWriteSync", async () => {
      mockFs.existsSync.mockReturnValue(true);
      const testData = { foo: "bar", count: 42 };

      const { writeCache } = await import("./cache.js");
      writeCache("test-key", testData);

      expect(mockAtomic.atomicWriteSync).toHaveBeenCalledWith(
        expect.stringContaining("test-key.json"),
        JSON.stringify(testData, null, 2) + "\n",
        0o644,
      );
    });

    it("should handle complex data types", async () => {
      mockFs.existsSync.mockReturnValue(true);
      const testData = {
        array: [1, 2, 3],
        nested: { a: { b: { c: "deep" } } },
      };

      const { writeCache } = await import("./cache.js");
      writeCache("test-key", testData);

      expect(mockAtomic.atomicWriteSync).toHaveBeenCalledWith(
        expect.stringContaining("test-key.json"),
        expect.stringContaining('"array"'),
        0o644,
      );
    });

    it("should not throw on write error", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockAtomic.atomicWriteSync.mockImplementation(() => {
        throw new Error("Disk full");
      });

      const { writeCache } = await import("./cache.js");
      expect(() => writeCache("test-key", { data: "test" })).not.toThrow();
    });

    it("should not throw on mkdir error", async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const { writeCache } = await import("./cache.js");
      expect(() => writeCache("test-key", { data: "test" })).not.toThrow();
    });
  });

  describe("clearCacheFile", () => {
    it("should delete file if exists", async () => {
      mockFs.existsSync.mockReturnValue(true);
      const { clearCacheFile } = await import("./cache.js");

      clearCacheFile("test-key");

      expect(mockFs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining("test-key.json"));
    });

    it("should do nothing if file does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);
      const { clearCacheFile } = await import("./cache.js");

      clearCacheFile("test-key");

      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });

    it("should not throw on delete error", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const { clearCacheFile } = await import("./cache.js");
      expect(() => clearCacheFile("test-key")).not.toThrow();
    });
  });
});
