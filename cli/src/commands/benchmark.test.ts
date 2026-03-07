import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("benchmarkCommand", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  const makeDirStat = (size = 0) => ({ isDirectory: () => true, isFile: () => false, size });
  const makeFileStat = (size = 100) => ({ isDirectory: () => false, isFile: () => true, size });

  function setupMocks(
    overrides: {
      installDir?: string;
      skillMeta?: Record<string, unknown> | null;
      dirSize?: number;
      readdirResults?: Record<string, string[]>;
      statResults?: Record<string, ReturnType<typeof makeDirStat | typeof makeFileStat>>;
      skillDirExists?: boolean;
    } = {},
  ) {
    const installDir = overrides.installDir ?? "/fake/install";
    const readdirResults = overrides.readdirResults ?? {};
    const statResults = overrides.statResults ?? {};

    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => installDir),
      readSkillMeta: vi.fn(() => overrides.skillMeta ?? { version: "1.0.0" }),
      getDirSize: vi.fn(() => overrides.dirSize ?? 4096),
    }));

    vi.doMock("node:fs", () => ({
      readdirSync: vi.fn((dir: string) => {
        if (readdirResults[dir]) return readdirResults[dir];
        // Default: return empty for unknown dirs
        return [];
      }),
      statSync: vi.fn((path: string) => {
        if (statResults[path]) return statResults[path];
        // If skillDirExists is false and path is a skill dir, throw
        if (overrides.skillDirExists === false && path.startsWith(installDir + "/")) {
          throw new Error("ENOENT");
        }
        // Default: directory
        return makeDirStat();
      }),
      readFileSync: vi.fn(() => "content"),
    }));
  }

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("single skill benchmark prints output", async () => {
    const installDir = "/fake/install";
    const skillDir = installDir + "/my-skill";

    setupMocks({
      installDir,
      dirSize: 2048,
      skillMeta: { version: "2.0.0" },
      readdirResults: {
        [skillDir]: ["SKILL.md", "rules"],
        [skillDir + "/rules"]: ["coding.md"],
      },
      statResults: {
        [skillDir]: makeDirStat(),
        [skillDir + "/SKILL.md"]: makeFileStat(500),
        [skillDir + "/rules"]: makeDirStat(),
        [skillDir + "/rules/coding.md"]: makeFileStat(1500),
      },
    });

    const { benchmarkCommand } = await import("./benchmark.js");
    await benchmarkCommand("my-skill", {});

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Benchmark: my-skill");
    expect(output).toContain("v2.0.0");
    expect(output).toContain("Files:");
    expect(output).toContain("Est. tokens:");
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("--all lists all skills sorted by token cost", async () => {
    const installDir = "/fake/install";

    setupMocks({
      installDir,
      readdirResults: {
        [installDir]: ["small-skill", "big-skill"],
        [installDir + "/small-skill"]: ["SKILL.md"],
        [installDir + "/big-skill"]: ["SKILL.md"],
      },
      statResults: {
        [installDir + "/small-skill"]: makeDirStat(),
        [installDir + "/big-skill"]: makeDirStat(),
        [installDir + "/small-skill/SKILL.md"]: makeFileStat(100),
        [installDir + "/big-skill/SKILL.md"]: makeFileStat(500),
      },
    });

    // getDirSize returns different values per skill, override with a counter
    vi.doMock("../utils/fs.js", () => {
      let callCount = 0;
      return {
        getInstallDir: vi.fn(() => installDir),
        readSkillMeta: vi.fn(() => ({ version: "1.0.0" })),
        getDirSize: vi.fn(() => {
          callCount++;
          // First call (small-skill) = 400, second (big-skill) = 2000
          return callCount === 1 ? 400 : 2000;
        }),
      };
    });

    const { benchmarkCommand } = await import("./benchmark.js");
    await benchmarkCommand(undefined, { all: true });

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("2 installed skill(s)");
    // big-skill should appear before small-skill (sorted by tokens desc)
    const bigIdx = output.indexOf("big-skill");
    const smallIdx = output.indexOf("small-skill");
    expect(bigIdx).toBeLessThan(smallIdx);
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("--json output format for single skill", async () => {
    const installDir = "/fake/install";
    const skillDir = installDir + "/test-skill";

    setupMocks({
      installDir,
      dirSize: 800,
      skillMeta: { version: "3.1.0" },
      readdirResults: {
        [skillDir]: ["SKILL.md"],
      },
      statResults: {
        [skillDir]: makeDirStat(),
        [skillDir + "/SKILL.md"]: makeFileStat(800),
      },
    });

    const { benchmarkCommand } = await import("./benchmark.js");
    await benchmarkCommand("test-skill", { json: true });

    const jsonCall = consoleLogSpy.mock.calls.find((call) => {
      try {
        JSON.parse(call[0] as string);
        return true;
      } catch {
        return false;
      }
    });
    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall![0] as string);
    expect(parsed).toHaveProperty("name", "test-skill");
    expect(parsed).toHaveProperty("version", "3.1.0");
    expect(parsed).toHaveProperty("fileCount");
    expect(parsed).toHaveProperty("totalBytes", 800);
    expect(parsed).toHaveProperty("estimatedTokens", 200);
    expect(parsed).toHaveProperty("contextPercent");
    expect(parsed).toHaveProperty("files");
    expect(Array.isArray(parsed.files)).toBe(true);
  });

  it("skill not found exits with error", async () => {
    const installDir = "/fake/install";

    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => installDir),
      readSkillMeta: vi.fn(() => null),
      getDirSize: vi.fn(() => 0),
    }));

    // statSync always throws to simulate missing skill directory
    vi.doMock("node:fs", () => ({
      readdirSync: vi.fn(() => []),
      statSync: vi.fn(() => {
        throw new Error("ENOENT");
      }),
      readFileSync: vi.fn(() => ""),
    }));

    const { benchmarkCommand } = await import("./benchmark.js");

    try {
      await benchmarkCommand("nonexistent", {});
    } catch {
      // process.exit throws
    }

    expect(processExitSpy).toHaveBeenCalledWith(1);
    const errorOutput = consoleErrorSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(errorOutput).toContain("not installed");
  });

  it("no skills installed with --all shows empty message", async () => {
    const installDir = "/fake/install";

    setupMocks({
      installDir,
      readdirResults: {}, // readdirSync will throw for installDir (catch branch)
    });

    // Override node:fs to throw on installDir readdir
    vi.doMock("node:fs", () => ({
      readdirSync: vi.fn(() => {
        throw new Error("ENOENT");
      }),
      statSync: vi.fn(() => makeDirStat()),
      readFileSync: vi.fn(() => ""),
    }));

    const { benchmarkCommand } = await import("./benchmark.js");
    await benchmarkCommand(undefined, { all: true });

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("No skills installed");
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  // === --progressive flag tests ===

  it("--progressive shows comparison output", async () => {
    const installDir = "/fake/install";

    setupMocks({
      installDir,
      readdirResults: {
        [installDir]: ["skill1", "skill2"],
        [installDir + "/skill1"]: ["SKILL.md"],
        [installDir + "/skill2"]: ["SKILL.md"],
      },
      statResults: {
        [installDir + "/skill1"]: makeDirStat(),
        [installDir + "/skill2"]: makeDirStat(),
        [installDir + "/skill1/SKILL.md"]: makeFileStat(400),
        [installDir + "/skill2/SKILL.md"]: makeFileStat(800),
      },
    });

    const { benchmarkCommand } = await import("./benchmark.js");
    await benchmarkCommand(undefined, { all: true, progressive: true });

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Progressive Disclosure Comparison");
  });

  it("--progressive shows reduction percentage", async () => {
    const installDir = "/fake/install";

    setupMocks({
      installDir,
      readdirResults: {
        [installDir]: ["skill1"],
        [installDir + "/skill1"]: ["SKILL.md"],
      },
      statResults: {
        [installDir + "/skill1"]: makeDirStat(),
        [installDir + "/skill1/SKILL.md"]: makeFileStat(4000),
      },
    });

    const { benchmarkCommand } = await import("./benchmark.js");
    await benchmarkCommand(undefined, { all: true, progressive: true });

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Reduction:");
    expect(output).toMatch(/\d+\.\d+%/);
  });

  it("--progressive shows arcana index usage hint", async () => {
    const installDir = "/fake/install";

    setupMocks({
      installDir,
      readdirResults: {
        [installDir]: ["skill1"],
        [installDir + "/skill1"]: ["SKILL.md"],
      },
      statResults: {
        [installDir + "/skill1"]: makeDirStat(),
        [installDir + "/skill1/SKILL.md"]: makeFileStat(400),
      },
    });

    const { benchmarkCommand } = await import("./benchmark.js");
    await benchmarkCommand(undefined, { all: true, progressive: true });

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("arcana index");
    expect(output).toContain("arcana load");
  });
});
