import { describe, it, expect, vi, beforeEach } from "vitest";

describe("install-core", () => {
  let preInstallScan: typeof import("./install-core.js").preInstallScan;
  let preInstallConflictCheck: typeof import("./install-core.js").preInstallConflictCheck;
  let sizeWarning: typeof import("./install-core.js").sizeWarning;
  let canInstall: typeof import("./install-core.js").canInstall;
  let detectProviderChange: typeof import("./install-core.js").detectProviderChange;
  let installOneCore: typeof import("./install-core.js").installOneCore;

  beforeEach(async () => {
    vi.resetModules();

    vi.doMock("@clack/prompts", () => ({
      confirm: vi.fn(async () => true),
      isCancel: vi.fn(() => false),
    }));

    vi.doMock("./scanner.js", () => ({
      scanSkillContent: vi.fn(() => []),
    }));

    vi.doMock("./integrity.js", () => ({
      updateLockEntry: vi.fn(),
    }));

    vi.doMock("./conflict-check.js", () => ({
      checkConflicts: vi.fn(() => []),
    }));

    vi.doMock("./project-context.js", () => ({
      detectProjectContext: vi.fn(() => ({ type: "unknown", lang: "general", frameworks: [], hasTests: false })),
    }));

    vi.doMock("./fs.js", () => ({
      installSkill: vi.fn(),
      isSkillInstalled: vi.fn(() => false),
      writeSkillMeta: vi.fn(),
      readSkillMeta: vi.fn(() => null),
    }));

    const mod = await import("./install-core.js");
    preInstallScan = mod.preInstallScan;
    preInstallConflictCheck = mod.preInstallConflictCheck;
    sizeWarning = mod.sizeWarning;
    canInstall = mod.canInstall;
    detectProviderChange = mod.detectProviderChange;
    installOneCore = mod.installOneCore;
  });

  describe("preInstallScan", () => {
    it("proceeds when no SKILL.md in files", () => {
      const result = preInstallScan("test", [{ path: "README.md", content: "hello" }]);
      expect(result.proceed).toBe(true);
      expect(result.critical).toHaveLength(0);
    });

    it("proceeds when scanner finds no issues", () => {
      const result = preInstallScan("test", [{ path: "SKILL.md", content: "---\nname: test\n---\nBody" }]);
      expect(result.proceed).toBe(true);
    });
  });

  describe("preInstallConflictCheck", () => {
    it("proceeds when no conflicts found", () => {
      const result = preInstallConflictCheck(
        "test",
        { name: "test", version: "1.0.0", description: "Test", tags: [], verified: false },
        [{ path: "SKILL.md", content: "---\nname: test\n---\nBody" }],
      );
      expect(result.proceed).toBe(true);
      expect(result.blocks).toHaveLength(0);
    });
  });

  describe("sizeWarning", () => {
    it("returns null for small skills", () => {
      expect(sizeWarning(10)).toBeNull();
      expect(sizeWarning(50)).toBeNull();
    });

    it("returns warning for large skills", () => {
      const warn = sizeWarning(100);
      expect(warn).toBeTruthy();
      expect(warn).toContain("100");
      expect(warn).toContain("tokens");
    });
  });

  describe("canInstall", () => {
    it("proceeds when skill is not installed", () => {
      const result = canInstall("new-skill");
      expect(result.proceed).toBe(true);
    });

    it("proceeds when force is true even if installed", async () => {
      vi.resetModules();

      vi.doMock("./scanner.js", () => ({ scanSkillContent: vi.fn(() => []) }));
      vi.doMock("./integrity.js", () => ({ updateLockEntry: vi.fn() }));
      vi.doMock("./conflict-check.js", () => ({ checkConflicts: vi.fn(() => []) }));
      vi.doMock("./project-context.js", () => ({
        detectProjectContext: vi.fn(() => ({ type: "unknown", lang: "general", frameworks: [], hasTests: false })),
      }));
      vi.doMock("./fs.js", () => ({
        installSkill: vi.fn(),
        isSkillInstalled: vi.fn(() => true),
        writeSkillMeta: vi.fn(),
        readSkillMeta: vi.fn(() => null),
      }));

      const mod = await import("./install-core.js");
      const result = mod.canInstall("existing-skill", true);
      expect(result.proceed).toBe(true);
    });

    it("blocks when installed and no force", async () => {
      vi.resetModules();

      vi.doMock("./scanner.js", () => ({ scanSkillContent: vi.fn(() => []) }));
      vi.doMock("./integrity.js", () => ({ updateLockEntry: vi.fn() }));
      vi.doMock("./conflict-check.js", () => ({ checkConflicts: vi.fn(() => []) }));
      vi.doMock("./project-context.js", () => ({
        detectProjectContext: vi.fn(() => ({ type: "unknown", lang: "general", frameworks: [], hasTests: false })),
      }));
      vi.doMock("./fs.js", () => ({
        installSkill: vi.fn(),
        isSkillInstalled: vi.fn(() => true),
        writeSkillMeta: vi.fn(),
        readSkillMeta: vi.fn(() => null),
      }));

      const mod = await import("./install-core.js");
      const result = mod.canInstall("existing-skill");
      expect(result.proceed).toBe(false);
      expect(result.reason).toContain("already installed");
    });
  });

  describe("detectProviderChange", () => {
    it("returns null when no existing meta", () => {
      expect(detectProviderChange("test", "arcana")).toBeNull();
    });

    it("returns null when same provider", async () => {
      vi.resetModules();

      vi.doMock("./scanner.js", () => ({ scanSkillContent: vi.fn(() => []) }));
      vi.doMock("./integrity.js", () => ({ updateLockEntry: vi.fn() }));
      vi.doMock("./conflict-check.js", () => ({ checkConflicts: vi.fn(() => []) }));
      vi.doMock("./project-context.js", () => ({
        detectProjectContext: vi.fn(() => ({ type: "unknown", lang: "general", frameworks: [], hasTests: false })),
      }));
      vi.doMock("./fs.js", () => ({
        installSkill: vi.fn(),
        isSkillInstalled: vi.fn(() => false),
        writeSkillMeta: vi.fn(),
        readSkillMeta: vi.fn(() => ({ source: "arcana", version: "1.0.0" })),
      }));

      const mod = await import("./install-core.js");
      expect(mod.detectProviderChange("test", "arcana")).toBeNull();
    });

    it("returns warning when provider differs", async () => {
      vi.resetModules();

      vi.doMock("./scanner.js", () => ({ scanSkillContent: vi.fn(() => []) }));
      vi.doMock("./integrity.js", () => ({ updateLockEntry: vi.fn() }));
      vi.doMock("./conflict-check.js", () => ({ checkConflicts: vi.fn(() => []) }));
      vi.doMock("./project-context.js", () => ({
        detectProjectContext: vi.fn(() => ({ type: "unknown", lang: "general", frameworks: [], hasTests: false })),
      }));
      vi.doMock("./fs.js", () => ({
        installSkill: vi.fn(),
        isSkillInstalled: vi.fn(() => false),
        writeSkillMeta: vi.fn(),
        readSkillMeta: vi.fn(() => ({ source: "old-provider", version: "1.0.0" })),
      }));

      const mod = await import("./install-core.js");
      const msg = mod.detectProviderChange("test", "new-provider");
      expect(msg).toContain("Overwriting");
      expect(msg).toContain("old-provider");
      expect(msg).toContain("new-provider");
    });
  });

  describe("installOneCore", () => {
    it("installs successfully with valid provider", async () => {
      const mockProvider = {
        name: "test-provider",
        fetch: vi.fn(async () => [{ path: "SKILL.md", content: "---\nname: test\n---\nBody" }]),
        info: vi.fn(async () => ({ name: "test", version: "1.0.0", description: "Test", tags: [], verified: false })),
        list: vi.fn(async () => []),
        search: vi.fn(async () => []),
      };

      const result = await installOneCore("test", mockProvider, {});
      expect(result.success).toBe(true);
      expect(result.skillName).toBe("test");
      expect(result.files).toHaveLength(1);
      expect(result.sizeKB).toBeGreaterThan(0);
    });

    it("blocks on critical scan findings without force", async () => {
      vi.resetModules();

      vi.doMock("./scanner.js", () => ({
        scanSkillContent: vi.fn(() => [{ level: "critical", category: "injection", detail: "dangerous", line: 1 }]),
      }));
      vi.doMock("./integrity.js", () => ({ updateLockEntry: vi.fn() }));
      vi.doMock("./conflict-check.js", () => ({ checkConflicts: vi.fn(() => []) }));
      vi.doMock("./project-context.js", () => ({
        detectProjectContext: vi.fn(() => ({ type: "unknown", lang: "general", frameworks: [], hasTests: false })),
      }));
      vi.doMock("./fs.js", () => ({
        installSkill: vi.fn(),
        isSkillInstalled: vi.fn(() => false),
        writeSkillMeta: vi.fn(),
        readSkillMeta: vi.fn(() => null),
      }));

      const mod = await import("./install-core.js");
      const mockProvider = {
        name: "test-provider",
        fetch: vi.fn(async () => [{ path: "SKILL.md", content: "---\nname: test\n---\nBody" }]),
        info: vi.fn(async () => ({ name: "test", version: "1.0.0", description: "Test", tags: [], verified: false })),
        list: vi.fn(async () => []),
        search: vi.fn(async () => []),
      };

      const result = await mod.installOneCore("test", mockProvider, {});
      expect(result.success).toBe(false);
      expect(result.scanBlocked).toBe(true);
    });

    it("prompts for confirmation when --force with critical findings on TTY", async () => {
      vi.resetModules();

      const mockConfirm = vi.fn(async () => false);
      vi.doMock("@clack/prompts", () => ({
        confirm: mockConfirm,
        isCancel: vi.fn(() => false),
      }));
      vi.doMock("./scanner.js", () => ({
        scanSkillContent: vi.fn(() => [{ level: "critical", category: "injection", detail: "dangerous", line: 1 }]),
      }));
      vi.doMock("./integrity.js", () => ({ updateLockEntry: vi.fn() }));
      vi.doMock("./conflict-check.js", () => ({ checkConflicts: vi.fn(() => []) }));
      vi.doMock("./project-context.js", () => ({
        detectProjectContext: vi.fn(() => ({ type: "unknown", lang: "general", frameworks: [], hasTests: false })),
      }));
      vi.doMock("./fs.js", () => ({
        installSkill: vi.fn(),
        isSkillInstalled: vi.fn(() => false),
        writeSkillMeta: vi.fn(),
        readSkillMeta: vi.fn(() => null),
      }));

      // Simulate TTY
      const origIsTTY = process.stdout.isTTY;
      Object.defineProperty(process.stdout, "isTTY", { value: true, writable: true });

      const mod = await import("./install-core.js");
      const mockProvider = {
        name: "test-provider",
        fetch: vi.fn(async () => [{ path: "SKILL.md", content: "---\nname: test\n---\nBody" }]),
        info: vi.fn(async () => ({ name: "test", version: "1.0.0", description: "Test", tags: [], verified: false })),
        list: vi.fn(async () => []),
        search: vi.fn(async () => []),
      };

      const result = await mod.installOneCore("test", mockProvider, { force: true });
      expect(result.success).toBe(false);
      expect(result.error).toBe("User declined forced install");
      expect(mockConfirm).toHaveBeenCalled();

      Object.defineProperty(process.stdout, "isTTY", { value: origIsTTY, writable: true });
    });

    it("proceeds with --force on critical findings when user confirms", async () => {
      vi.resetModules();

      const mockConfirm = vi.fn(async () => true);
      vi.doMock("@clack/prompts", () => ({
        confirm: mockConfirm,
        isCancel: vi.fn(() => false),
      }));
      vi.doMock("./scanner.js", () => ({
        scanSkillContent: vi.fn(() => [{ level: "critical", category: "injection", detail: "dangerous", line: 1 }]),
      }));
      vi.doMock("./integrity.js", () => ({ updateLockEntry: vi.fn() }));
      vi.doMock("./conflict-check.js", () => ({ checkConflicts: vi.fn(() => []) }));
      vi.doMock("./project-context.js", () => ({
        detectProjectContext: vi.fn(() => ({ type: "unknown", lang: "general", frameworks: [], hasTests: false })),
      }));
      vi.doMock("./fs.js", () => ({
        installSkill: vi.fn(),
        isSkillInstalled: vi.fn(() => false),
        writeSkillMeta: vi.fn(),
        readSkillMeta: vi.fn(() => null),
      }));

      const origIsTTY = process.stdout.isTTY;
      Object.defineProperty(process.stdout, "isTTY", { value: true, writable: true });

      const mod = await import("./install-core.js");
      const mockProvider = {
        name: "test-provider",
        fetch: vi.fn(async () => [{ path: "SKILL.md", content: "---\nname: test\n---\nBody" }]),
        info: vi.fn(async () => ({ name: "test", version: "1.0.0", description: "Test", tags: [], verified: false })),
        list: vi.fn(async () => []),
        search: vi.fn(async () => []),
      };

      const result = await mod.installOneCore("test", mockProvider, { force: true });
      expect(result.success).toBe(true);
      expect(mockConfirm).toHaveBeenCalled();

      Object.defineProperty(process.stdout, "isTTY", { value: origIsTTY, writable: true });
    });

    it("rejects path traversal skill names", async () => {
      const mockProvider = {
        name: "test-provider",
        fetch: vi.fn(async () => []),
        info: vi.fn(async () => null),
        list: vi.fn(async () => []),
        search: vi.fn(async () => []),
      };

      const result = await installOneCore("../evil", mockProvider, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid skill name");
    });

    it("rejects uppercase skill names", async () => {
      const mockProvider = {
        name: "test-provider",
        fetch: vi.fn(async () => []),
        info: vi.fn(async () => null),
        list: vi.fn(async () => []),
        search: vi.fn(async () => []),
      };

      const result = await installOneCore("MySkill", mockProvider, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid skill name");
    });

    it("rejects skill names longer than 64 chars", async () => {
      const longName = "a".repeat(65);
      const mockProvider = {
        name: "test-provider",
        fetch: vi.fn(async () => []),
        info: vi.fn(async () => null),
        list: vi.fn(async () => []),
        search: vi.fn(async () => []),
      };

      const result = await installOneCore(longName, mockProvider, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid skill name");
    });

    it("accepts valid lowercase hyphenated names", async () => {
      const mockProvider = {
        name: "test-provider",
        fetch: vi.fn(async () => [{ path: "SKILL.md", content: "---\nname: test\n---\nBody" }]),
        info: vi.fn(async () => ({ name: "golang-pro", version: "1.0.0", description: "Test", tags: [], verified: false })),
        list: vi.fn(async () => []),
        search: vi.fn(async () => []),
      };

      const result = await installOneCore("golang-pro", mockProvider, {});
      expect(result.success).toBe(true);
    });

    it("install-core.ts source imports regenerateIndex for post-install", async () => {
      const { readFileSync } = await import("node:fs");
      const source = readFileSync(new URL("./install-core.ts", import.meta.url), "utf-8");
      expect(source).toContain("regenerateIndex");
      expect(source).toContain('import("../commands/index.js")');
    });
  });
});
