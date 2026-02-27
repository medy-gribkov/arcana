import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock modules at top level
vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/tmp/test-home"),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("./atomic.js", () => ({
  atomicWriteSync: vi.fn(),
}));

describe("history", () => {
  let mockFs: any;
  let mockOs: any;
  let mockAtomic: any;

  beforeEach(async () => {
    vi.resetModules();
    mockOs = await import("node:os");
    mockFs = await import("node:fs");
    mockAtomic = await import("./atomic.js");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("readHistory", () => {
    it("should return empty array when file does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);
      const { readHistory } = await import("./history.js");
      const result = readHistory();
      expect(result).toEqual([]);
      expect(mockFs.existsSync).toHaveBeenCalledWith(expect.stringContaining("history.json"));
    });

    it("should return empty array for invalid JSON", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("not valid json");
      const { readHistory } = await import("./history.js");
      const result = readHistory();
      expect(result).toEqual([]);
    });

    it("should return parsed array for valid JSON", async () => {
      const entries = [
        { action: "install", target: "skill1", timestamp: "2024-01-01T00:00:00.000Z" },
        { action: "search", target: "skill2", timestamp: "2024-01-02T00:00:00.000Z" },
      ];
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(entries));
      const { readHistory } = await import("./history.js");
      const result = readHistory();
      expect(result).toEqual(entries);
    });

    it("should return empty array when JSON is not an array", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{"not": "array"}');
      const { readHistory } = await import("./history.js");
      const result = readHistory();
      expect(result).toEqual([]);
    });
  });

  describe("appendHistory", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should append entry with timestamp", async () => {
      mockFs.existsSync.mockReturnValue(false);
      const { appendHistory } = await import("./history.js");

      appendHistory("install", "my-skill");

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining(".arcana"), { recursive: true });
      expect(mockAtomic.atomicWriteSync).toHaveBeenCalledWith(
        expect.stringContaining("history.json"),
        expect.stringContaining('"action": "install"'),
      );
      expect(mockAtomic.atomicWriteSync).toHaveBeenCalledWith(
        expect.stringContaining("history.json"),
        expect.stringContaining('"target": "my-skill"'),
      );
      expect(mockAtomic.atomicWriteSync).toHaveBeenCalledWith(
        expect.stringContaining("history.json"),
        expect.stringContaining('"timestamp": "2024-01-15T12:00:00.000Z"'),
      );
    });

    it("should cap entries at 50", async () => {
      const existingEntries = Array.from({ length: 50 }, (_, i) => ({
        action: "install",
        target: `skill${i}`,
        timestamp: new Date(Date.now() - (50 - i) * 1000).toISOString(),
      }));

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(existingEntries));

      const { appendHistory } = await import("./history.js");
      appendHistory("install", "new-skill");

      const writtenData = mockAtomic.atomicWriteSync.mock.calls[0][1];
      const parsed = JSON.parse(writtenData);

      expect(parsed.length).toBe(50);
      expect(parsed[0].target).toBe("skill1"); // First entry removed
      expect(parsed[parsed.length - 1].target).toBe("new-skill"); // New entry added
    });

    it("should handle append without target", async () => {
      mockFs.existsSync.mockReturnValue(false);
      const { appendHistory } = await import("./history.js");

      appendHistory("list");

      expect(mockAtomic.atomicWriteSync).toHaveBeenCalledWith(
        expect.stringContaining("history.json"),
        expect.stringContaining('"action": "list"'),
      );
    });

    it("should not throw on write error", async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockAtomic.atomicWriteSync.mockImplementation(() => {
        throw new Error("Write error");
      });

      const { appendHistory } = await import("./history.js");
      expect(() => appendHistory("install", "skill")).not.toThrow();
    });
  });

  describe("clearHistory", () => {
    it("should write empty array", async () => {
      mockFs.existsSync.mockReturnValue(true);
      const { clearHistory } = await import("./history.js");

      clearHistory();

      expect(mockAtomic.atomicWriteSync).toHaveBeenCalledWith(expect.stringContaining("history.json"), "[]");
    });

    it("should create directory if not exists", async () => {
      mockFs.existsSync.mockReturnValue(false);
      const { clearHistory } = await import("./history.js");

      clearHistory();

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining(".arcana"), { recursive: true });
    });

    it("should not throw on write error", async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockAtomic.atomicWriteSync.mockImplementation(() => {
        throw new Error("Write error");
      });

      const { clearHistory } = await import("./history.js");
      expect(() => clearHistory()).not.toThrow();
    });
  });

  describe("getRecentSkills", () => {
    it("should return recent install/search targets", async () => {
      const entries = [
        { action: "install", target: "skill1", timestamp: "2024-01-01T00:00:00.000Z" },
        { action: "list", timestamp: "2024-01-02T00:00:00.000Z" },
        { action: "search", target: "skill2", timestamp: "2024-01-03T00:00:00.000Z" },
        { action: "install", target: "skill3", timestamp: "2024-01-04T00:00:00.000Z" },
      ];
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(entries));

      const { getRecentSkills } = await import("./history.js");
      const result = getRecentSkills(5);

      expect(result).toEqual(["skill3", "skill2", "skill1"]);
    });

    it("should deduplicate skills", async () => {
      const entries = [
        { action: "install", target: "skill1", timestamp: "2024-01-01T00:00:00.000Z" },
        { action: "install", target: "skill2", timestamp: "2024-01-02T00:00:00.000Z" },
        { action: "install", target: "skill1", timestamp: "2024-01-03T00:00:00.000Z" },
        { action: "search", target: "skill3", timestamp: "2024-01-04T00:00:00.000Z" },
      ];
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(entries));

      const { getRecentSkills } = await import("./history.js");
      const result = getRecentSkills(5);

      expect(result).toEqual(["skill3", "skill1", "skill2"]);
    });

    it("should respect limit parameter", async () => {
      const entries = [
        { action: "install", target: "skill1", timestamp: "2024-01-01T00:00:00.000Z" },
        { action: "install", target: "skill2", timestamp: "2024-01-02T00:00:00.000Z" },
        { action: "install", target: "skill3", timestamp: "2024-01-03T00:00:00.000Z" },
        { action: "install", target: "skill4", timestamp: "2024-01-04T00:00:00.000Z" },
      ];
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(entries));

      const { getRecentSkills } = await import("./history.js");
      const result = getRecentSkills(2);

      expect(result).toEqual(["skill4", "skill3"]);
    });

    it("should ignore entries without target", async () => {
      const entries = [
        { action: "list", timestamp: "2024-01-01T00:00:00.000Z" },
        { action: "install", target: "skill1", timestamp: "2024-01-02T00:00:00.000Z" },
      ];
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(entries));

      const { getRecentSkills } = await import("./history.js");
      const result = getRecentSkills(5);

      expect(result).toEqual(["skill1"]);
    });

    it("should default to limit of 5", async () => {
      const entries = Array.from({ length: 10 }, (_, i) => ({
        action: "install",
        target: `skill${i}`,
        timestamp: new Date(Date.now() - (10 - i) * 1000).toISOString(),
      }));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(entries));

      const { getRecentSkills } = await import("./history.js");
      const result = getRecentSkills();

      expect(result.length).toBe(5);
      expect(result).toEqual(["skill9", "skill8", "skill7", "skill6", "skill5"]);
    });
  });
});
