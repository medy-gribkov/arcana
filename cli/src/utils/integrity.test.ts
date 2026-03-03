import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/tmp/test-home"),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
  lstatSync: vi.fn(),
}));

vi.mock("./atomic.js", () => ({
  atomicWriteSync: vi.fn(),
}));

describe("integrity", () => {
  let mockFs: any;
  let mockAtomic: any;

  beforeEach(async () => {
    vi.resetModules();
    await import("node:os");
    mockFs = await import("node:fs");
    mockAtomic = await import("./atomic.js");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("computeHash", () => {
    it("should return consistent SHA-256 hex", async () => {
      const { computeHash } = await import("./integrity.js");
      const hash1 = computeHash("hello world");
      const hash2 = computeHash("hello world");
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should return different hash for different input", async () => {
      const { computeHash } = await import("./integrity.js");
      const hash1 = computeHash("hello");
      const hash2 = computeHash("world");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("readLockfile", () => {
    it("should return empty array when file is missing", async () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("ENOENT");
      });
      const { readLockfile } = await import("./integrity.js");
      expect(readLockfile()).toEqual([]);
    });

    it("should return empty array for invalid JSON", async () => {
      mockFs.readFileSync.mockReturnValue("not valid json {{{");
      const { readLockfile } = await import("./integrity.js");
      expect(readLockfile()).toEqual([]);
    });

    it("should return parsed entries for valid JSON", async () => {
      const entries = [
        {
          skill: "test-skill",
          version: "1.0.0",
          hash: "abc123",
          source: "arcana",
          installedAt: "2024-01-01T00:00:00.000Z",
        },
      ];
      mockFs.readFileSync.mockReturnValue(JSON.stringify(entries));
      const { readLockfile } = await import("./integrity.js");
      expect(readLockfile()).toEqual(entries);
    });

    it("should return empty array when JSON is not an array", async () => {
      mockFs.readFileSync.mockReturnValue('{"not": "array"}');
      const { readLockfile } = await import("./integrity.js");
      expect(readLockfile()).toEqual([]);
    });
  });

  describe("writeLockfile", () => {
    it("should write JSON with atomic write", async () => {
      const entries = [
        {
          skill: "test-skill",
          version: "1.0.0",
          hash: "abc",
          source: "arcana",
          installedAt: "2024-01-01T00:00:00.000Z",
        },
      ];
      const { writeLockfile } = await import("./integrity.js");
      writeLockfile(entries);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining(".arcana"), { recursive: true });
      expect(mockAtomic.atomicWriteSync).toHaveBeenCalledWith(
        expect.stringContaining("arcana-lock.json"),
        JSON.stringify(entries, null, 2) + "\n",
        0o644,
      );
    });
  });

  describe("updateLockEntry", () => {
    it("should add new entry", async () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("ENOENT");
      });

      const { updateLockEntry } = await import("./integrity.js");
      updateLockEntry("my-skill", "1.0.0", "arcana", [{ path: "SKILL.md", content: "# My Skill" }]);

      const written = mockAtomic.atomicWriteSync.mock.calls[0][1];
      const parsed = JSON.parse(written);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].skill).toBe("my-skill");
      expect(parsed[0].version).toBe("1.0.0");
      expect(parsed[0].source).toBe("arcana");
      expect(parsed[0].hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should update existing entry", async () => {
      const existing = [
        {
          skill: "my-skill",
          version: "1.0.0",
          hash: "old-hash",
          source: "arcana",
          installedAt: "2024-01-01T00:00:00.000Z",
        },
        {
          skill: "other-skill",
          version: "2.0.0",
          hash: "other-hash",
          source: "arcana",
          installedAt: "2024-01-02T00:00:00.000Z",
        },
      ];
      mockFs.readFileSync.mockReturnValue(JSON.stringify(existing));

      const { updateLockEntry } = await import("./integrity.js");
      updateLockEntry("my-skill", "1.1.0", "arcana", [{ path: "SKILL.md", content: "# Updated" }]);

      const written = mockAtomic.atomicWriteSync.mock.calls[0][1];
      const parsed = JSON.parse(written);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].skill).toBe("my-skill");
      expect(parsed[0].version).toBe("1.1.0");
      expect(parsed[1].skill).toBe("other-skill");
    });

    it("should sort files deterministically", async () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("ENOENT");
      });

      const { updateLockEntry, computeHash } = await import("./integrity.js");

      updateLockEntry("skill-a", "1.0.0", "arcana", [
        { path: "z-file.md", content: "ZZZ" },
        { path: "a-file.md", content: "AAA" },
      ]);

      const written1 = mockAtomic.atomicWriteSync.mock.calls[0][1];
      const hash1 = JSON.parse(written1)[0].hash;

      vi.clearAllMocks();
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("ENOENT");
      });

      updateLockEntry("skill-b", "1.0.0", "arcana", [
        { path: "a-file.md", content: "AAA" },
        { path: "z-file.md", content: "ZZZ" },
      ]);

      const written2 = mockAtomic.atomicWriteSync.mock.calls[0][1];
      const hash2 = JSON.parse(written2)[0].hash;

      expect(hash1).toBe(hash2);
      // Sorted order: a-file then z-file, so hash should be hash of "AAAZZZ"
      expect(hash1).toBe(computeHash("AAAZZZ"));
    });
  });

  describe("removeLockEntry", () => {
    it("should remove existing entry", async () => {
      const existing = [
        { skill: "skill-a", version: "1.0.0", hash: "aaa", source: "arcana", installedAt: "2024-01-01T00:00:00.000Z" },
        { skill: "skill-b", version: "2.0.0", hash: "bbb", source: "arcana", installedAt: "2024-01-02T00:00:00.000Z" },
      ];
      mockFs.readFileSync.mockReturnValue(JSON.stringify(existing));

      const { removeLockEntry } = await import("./integrity.js");
      removeLockEntry("skill-a");

      const written = mockAtomic.atomicWriteSync.mock.calls[0][1];
      const parsed = JSON.parse(written);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].skill).toBe("skill-b");
    });

    it("should be no-op for missing entry", async () => {
      const existing = [
        { skill: "skill-a", version: "1.0.0", hash: "aaa", source: "arcana", installedAt: "2024-01-01T00:00:00.000Z" },
      ];
      mockFs.readFileSync.mockReturnValue(JSON.stringify(existing));

      const { removeLockEntry } = await import("./integrity.js");
      removeLockEntry("nonexistent");

      const written = mockAtomic.atomicWriteSync.mock.calls[0][1];
      const parsed = JSON.parse(written);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].skill).toBe("skill-a");
    });
  });

  describe("verifySkillIntegrity", () => {
    it("should return 'missing' when no lockfile entry", async () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("ENOENT");
      });

      const { verifySkillIntegrity } = await import("./integrity.js");
      expect(verifySkillIntegrity("unknown-skill", "/install")).toBe("missing");
    });

    it("should return 'ok' when hashes match", async () => {
      const { computeHash } = await import("./integrity.js");
      const fileContent = "# My Skill";
      const expectedHash = computeHash(fileContent);

      const entries = [
        {
          skill: "my-skill",
          version: "1.0.0",
          hash: expectedHash,
          source: "arcana",
          installedAt: "2024-01-01T00:00:00.000Z",
        },
      ];

      // readFileSync is called for lockfile read and for file content read
      let callCount = 0;
      mockFs.readFileSync.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return JSON.stringify(entries);
        return fileContent;
      });
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(["SKILL.md"]);
      mockFs.lstatSync.mockReturnValue({ isDirectory: () => false });

      const { verifySkillIntegrity } = await import("./integrity.js");
      expect(verifySkillIntegrity("my-skill", "/install")).toBe("ok");
    });

    it("should return 'modified' when hashes differ", async () => {
      const entries = [
        {
          skill: "my-skill",
          version: "1.0.0",
          hash: "stale-hash-value",
          source: "arcana",
          installedAt: "2024-01-01T00:00:00.000Z",
        },
      ];

      let callCount = 0;
      mockFs.readFileSync.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return JSON.stringify(entries);
        return "modified content";
      });
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(["SKILL.md"]);
      mockFs.lstatSync.mockReturnValue({ isDirectory: () => false });

      const { verifySkillIntegrity } = await import("./integrity.js");
      expect(verifySkillIntegrity("my-skill", "/install")).toBe("modified");
    });

    it("should return 'modified' when skill directory does not exist", async () => {
      const entries = [
        { skill: "my-skill", version: "1.0.0", hash: "abc", source: "arcana", installedAt: "2024-01-01T00:00:00.000Z" },
      ];
      mockFs.readFileSync.mockReturnValue(JSON.stringify(entries));
      mockFs.existsSync.mockReturnValue(false);

      const { verifySkillIntegrity } = await import("./integrity.js");
      expect(verifySkillIntegrity("my-skill", "/install")).toBe("modified");
    });
  });
});
