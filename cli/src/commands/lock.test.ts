import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("lockCommand", () => {
  let lockCommand: (opts: Record<string, unknown>) => Promise<void>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let mockWriteLockfile: ReturnType<typeof vi.fn>;
  let mockReadLockfile: ReturnType<typeof vi.fn>;
  let mockComputeHash: ReturnType<typeof vi.fn>;
  let mockGetInstallDir: ReturnType<typeof vi.fn>;
  let mockReadSkillMeta: ReturnType<typeof vi.fn>;
  let mockExistsSync: ReturnType<typeof vi.fn>;
  let mockReaddirSync: ReturnType<typeof vi.fn>;
  let mockReadFileSync: ReturnType<typeof vi.fn>;
  let mockLstatSync: ReturnType<typeof vi.fn>;

  const makeDirStat = () => ({ isDirectory: () => true, isFile: () => false });
  const makeFileStat = () => ({ isDirectory: () => false, isFile: () => true });

  beforeEach(async () => {
    vi.resetModules();

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    mockWriteLockfile = vi.fn();
    mockReadLockfile = vi.fn(() => []);
    mockComputeHash = vi.fn(() => "abc123");
    mockGetInstallDir = vi.fn(() => "/fake/install");
    mockReadSkillMeta = vi.fn(() => ({
      version: "1.0.0",
      source: "test-provider",
      installedAt: "2024-01-01T00:00:00.000Z",
    }));

    mockExistsSync = vi.fn(() => true);
    mockReaddirSync = vi.fn(() => []);
    mockReadFileSync = vi.fn(() => "file-content");
    mockLstatSync = vi.fn(() => makeFileStat());

    vi.doMock("node:fs", () => ({
      existsSync: mockExistsSync,
      readdirSync: mockReaddirSync,
      readFileSync: mockReadFileSync,
      lstatSync: mockLstatSync,
    }));

    vi.doMock("node:os", () => ({
      homedir: vi.fn(() => "/fake/home"),
    }));

    vi.doMock("chalk", () => ({
      default: Object.assign((s: string) => s, {
        bold: (s: string) => s,
        cyan: (s: string) => s,
        dim: (s: string) => s,
        hex: () => (s: string) => s,
      }),
    }));

    vi.doMock("@clack/prompts", () => ({
      log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), success: vi.fn() },
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() })),
    }));

    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: mockGetInstallDir,
      isSkillInstalled: vi.fn(() => true),
      readSkillMeta: mockReadSkillMeta,
    }));

    vi.doMock("../utils/integrity.js", () => ({
      readLockfile: mockReadLockfile,
      writeLockfile: mockWriteLockfile,
      computeHash: mockComputeHash,
    }));

    vi.doMock("../utils/help.js", () => ({
      renderBanner: vi.fn(() => "Banner"),
    }));

    vi.doMock("../utils/ui.js", () => ({
      printErrorWithHint: vi.fn(),
    }));

    const module = await import("./lock.js");
    lockCommand = module.lockCommand;
  });

  afterEach(() => {
    vi.resetModules();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("generate mode writes lockfile", async () => {
    // installDir exists, has one skill dir with one file
    mockReaddirSync
      .mockReturnValueOnce(["my-skill"]) // installDir listing
      .mockReturnValueOnce(["SKILL.md"]); // skill dir listing
    mockLstatSync
      .mockReturnValueOnce(makeDirStat()) // my-skill is a dir
      .mockReturnValueOnce(makeFileStat()); // SKILL.md is a file

    await lockCommand({});

    expect(mockWriteLockfile).toHaveBeenCalledTimes(1);
    const entries = mockWriteLockfile.mock.calls[0][0];
    expect(entries).toHaveLength(1);
    expect(entries[0].skill).toBe("my-skill");
    expect(entries[0].hash).toBe("abc123");
    expect(entries[0].version).toBe("1.0.0");
  });

  it("generate mode with empty install dir", async () => {
    mockExistsSync.mockReturnValue(false);

    await lockCommand({});

    expect(mockWriteLockfile).toHaveBeenCalledWith([]);
  });

  it("generate mode JSON output", async () => {
    mockReaddirSync
      .mockReturnValueOnce(["skill-a", "skill-b"])
      .mockReturnValueOnce(["SKILL.md"])
      .mockReturnValueOnce(["SKILL.md"]);
    mockLstatSync
      .mockReturnValueOnce(makeDirStat()) // skill-a
      .mockReturnValueOnce(makeDirStat()) // skill-b
      .mockReturnValueOnce(makeFileStat()) // skill-a/SKILL.md
      .mockReturnValueOnce(makeFileStat()); // skill-b/SKILL.md

    await lockCommand({ json: true });

    expect(mockWriteLockfile).toHaveBeenCalledTimes(1);
    const output = consoleLogSpy.mock.calls.find((c: unknown[]) => {
      try {
        JSON.parse(c[0]);
        return true;
      } catch {
        return false;
      }
    });
    expect(output).toBeDefined();
    const parsed = JSON.parse(output[0]);
    expect(parsed.action).toBe("generate");
    expect(parsed.entries).toBe(2);
    expect(parsed.path).toBe("~/.arcana/arcana-lock.json");
  });

  it("--ci mode with valid lockfile", async () => {
    mockReadLockfile.mockReturnValue([
      { skill: "my-skill", version: "1.0.0", hash: "abc123", source: "test", installedAt: "2024-01-01" },
    ]);
    mockReaddirSync
      .mockReturnValueOnce(["my-skill"]) // installDir listing
      .mockReturnValueOnce(["SKILL.md"]); // skill dir listing
    mockLstatSync
      .mockReturnValueOnce(makeDirStat()) // my-skill is a dir
      .mockReturnValueOnce(makeFileStat()); // SKILL.md is a file

    await lockCommand({ ci: true });

    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("--ci mode with mismatched hash exits 1", async () => {
    mockReadLockfile.mockReturnValue([
      { skill: "my-skill", version: "1.0.0", hash: "old-hash-different", source: "test", installedAt: "2024-01-01" },
    ]);
    mockReaddirSync
      .mockReturnValueOnce(["my-skill"]) // installDir listing
      .mockReturnValueOnce(["SKILL.md"]); // skill dir listing
    mockLstatSync
      .mockReturnValueOnce(makeDirStat()) // my-skill is a dir
      .mockReturnValueOnce(makeFileStat()); // SKILL.md is a file

    await lockCommand({ ci: true });

    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("--ci mode with missing lockfile exits 1", async () => {
    mockReadLockfile.mockReturnValue([]);
    mockExistsSync.mockReturnValue(false);

    await lockCommand({ ci: true });

    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
