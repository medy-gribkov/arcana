import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("installCommand JSON mode", () => {
  let installCommand: (skills: string[], opts: Record<string, unknown>) => Promise<void>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  const mockProvider = {
    name: "test-provider",
    fetch: vi.fn(async () => [{ path: "SKILL.md", content: "---\nname: test\n---\nBody" }]),
    info: vi.fn(async () => ({ name: "test", version: "1.0.0", description: "Test" })),
    list: vi.fn(async () => [{ name: "skill-a", version: "1.0.0", description: "Skill A" }]),
  };

  beforeEach(async () => {
    vi.resetModules();

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    vi.doMock("chalk", () => ({
      default: Object.assign((s: string) => s, {
        bold: (s: string) => s,
        cyan: (s: string) => s,
        dim: (s: string) => s,
        hex: () => (s: string) => s,
      }),
    }));

    vi.doMock("@clack/prompts", () => ({
      log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      intro: vi.fn(),
      cancel: vi.fn(),
      spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() })),
    }));

    vi.doMock("../utils/ui.js", () => ({
      printErrorWithHint: vi.fn(),
    }));

    vi.doMock("../utils/fs.js", () => ({
      installSkill: vi.fn(() => "/fake/path"),
      isSkillInstalled: vi.fn(() => false),
      writeSkillMeta: vi.fn(),
      readSkillMeta: vi.fn(),
    }));

    vi.doMock("../registry.js", () => ({
      getProvider: vi.fn(() => mockProvider),
      getProviders: vi.fn(() => [mockProvider]),
    }));

    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({ defaultProvider: "test-provider" })),
    }));

    vi.doMock("../utils/help.js", () => ({
      renderBanner: vi.fn(() => "Banner"),
    }));

    vi.doMock("../utils/validate.js", () => ({
      validateSlug: vi.fn(),
    }));

    vi.doMock("../utils/scanner.js", () => ({
      scanSkillContent: vi.fn(() => []),
    }));

    vi.doMock("../utils/integrity.js", () => ({
      updateLockEntry: vi.fn(),
    }));

    vi.doMock("../utils/conflict-check.js", () => ({
      checkConflicts: vi.fn(() => []),
    }));

    vi.doMock("../utils/project-context.js", () => ({
      detectProjectContext: vi.fn(() => ({ type: "unknown", lang: "general", frameworks: [], hasTests: false })),
    }));

    const module = await import("./install.js");
    installCommand = module.installCommand;
  });

  afterEach(() => {
    vi.resetModules();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("JSON mode exits with error when no skills and not --all", async () => {
    await installCommand([], { json: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify({ installed: [], skipped: [], failed: [], error: "No skill specified" }),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("JSON mode --dry-run returns wouldInstall list", async () => {
    await installCommand(["skill-a", "skill-b"], { json: true, dryRun: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ dryRun: true, wouldInstall: ["skill-a", "skill-b"] }));
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("JSON mode successful install returns installed list", async () => {
    await installCommand(["test"], { json: true });

    expect(mockProvider.fetch).toHaveBeenCalledWith("test");
    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ installed: ["test"], skipped: [], failed: [] }));
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("JSON mode skips already-installed skill (not force)", async () => {
    vi.resetModules();

    vi.doMock("chalk", () => ({
      default: Object.assign((s: string) => s, {
        bold: (s: string) => s,
        cyan: (s: string) => s,
        dim: (s: string) => s,
        hex: () => (s: string) => s,
      }),
    }));

    vi.doMock("@clack/prompts", () => ({
      log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      intro: vi.fn(),
      cancel: vi.fn(),
      spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() })),
    }));

    vi.doMock("../utils/ui.js", () => ({
      printErrorWithHint: vi.fn(),
    }));

    vi.doMock("../utils/fs.js", () => ({
      installSkill: vi.fn(() => "/fake/path"),
      isSkillInstalled: vi.fn(() => true),
      writeSkillMeta: vi.fn(),
      readSkillMeta: vi.fn(),
    }));

    vi.doMock("../registry.js", () => ({
      getProvider: vi.fn(() => mockProvider),
      getProviders: vi.fn(() => [mockProvider]),
    }));

    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({ defaultProvider: "test-provider" })),
    }));

    vi.doMock("../utils/help.js", () => ({
      renderBanner: vi.fn(() => "Banner"),
    }));

    vi.doMock("../utils/validate.js", () => ({
      validateSlug: vi.fn(),
    }));

    vi.doMock("../utils/scanner.js", () => ({
      scanSkillContent: vi.fn(() => []),
    }));

    vi.doMock("../utils/integrity.js", () => ({
      updateLockEntry: vi.fn(),
    }));

    vi.doMock("../utils/conflict-check.js", () => ({
      checkConflicts: vi.fn(() => []),
    }));

    vi.doMock("../utils/project-context.js", () => ({
      detectProjectContext: vi.fn(() => ({ type: "unknown", lang: "general", frameworks: [], hasTests: false })),
    }));

    const module = await import("./install.js");
    const cmd = module.installCommand;

    await cmd(["test"], { json: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ installed: [], skipped: ["test"], failed: [] }));
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("JSON mode --all --dry-run lists from providers", async () => {
    await installCommand([], { json: true, all: true, dryRun: true });

    expect(mockProvider.list).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ dryRun: true, wouldInstall: ["skill-a"] }));
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("preInstallScan blocks on critical issues", async () => {
    vi.resetModules();

    vi.doMock("chalk", () => ({
      default: Object.assign((s: string) => s, {
        bold: (s: string) => s,
        cyan: (s: string) => s,
        dim: (s: string) => s,
        hex: () => (s: string) => s,
      }),
    }));

    vi.doMock("@clack/prompts", () => ({
      log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      intro: vi.fn(),
      cancel: vi.fn(),
      spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() })),
    }));

    vi.doMock("../utils/ui.js", () => ({
      printErrorWithHint: vi.fn(),
    }));

    vi.doMock("../utils/fs.js", () => ({
      installSkill: vi.fn(() => "/fake/path"),
      isSkillInstalled: vi.fn(() => false),
      writeSkillMeta: vi.fn(),
      readSkillMeta: vi.fn(),
    }));

    vi.doMock("../registry.js", () => ({
      getProvider: vi.fn(() => mockProvider),
      getProviders: vi.fn(() => [mockProvider]),
    }));

    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({ defaultProvider: "test-provider" })),
    }));

    vi.doMock("../utils/help.js", () => ({
      renderBanner: vi.fn(() => "Banner"),
    }));

    vi.doMock("../utils/validate.js", () => ({
      validateSlug: vi.fn(),
    }));

    vi.doMock("../utils/scanner.js", () => ({
      scanSkillContent: vi.fn(() => [
        { level: "critical", category: "command-injection", detail: "Found dangerous pattern", line: 42 },
      ]),
    }));

    vi.doMock("../utils/integrity.js", () => ({
      updateLockEntry: vi.fn(),
    }));

    vi.doMock("../utils/conflict-check.js", () => ({
      checkConflicts: vi.fn(() => []),
    }));

    vi.doMock("../utils/project-context.js", () => ({
      detectProjectContext: vi.fn(() => ({ type: "unknown", lang: "general", frameworks: [], hasTests: false })),
    }));

    const module = await import("./install.js");
    const cmd = module.installCommand;

    await cmd(["test"], { json: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ installed: [], skipped: [], failed: ["test"] }));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("JSON mode --all non-dry-run installs multiple skills", async () => {
    mockProvider.list.mockResolvedValueOnce([
      { name: "skill-a", version: "1.0.0", description: "A" },
      { name: "skill-b", version: "1.0.0", description: "B" },
    ]);

    await installCommand([], { json: true, all: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0]![0] as string);
    expect(output.installed).toContain("skill-a");
    expect(output.installed).toContain("skill-b");
    expect(output.failed).toEqual([]);
  });

  it("JSON mode --all: provider.list failure adds to errors", async () => {
    mockProvider.list.mockRejectedValueOnce(new Error("Network down"));

    await installCommand([], { json: true, all: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0]![0] as string);
    expect(output.errors).toBeDefined();
    expect(output.errors[0]).toContain("Network down");
    expect(output.installed).toEqual([]);
  });

  it("JSON mode --all: installOneCore failure records error message", async () => {
    vi.resetModules();

    vi.doMock("chalk", () => ({
      default: Object.assign((s: string) => s, {
        bold: (s: string) => s,
        cyan: (s: string) => s,
        dim: (s: string) => s,
        hex: () => (s: string) => s,
      }),
    }));

    vi.doMock("@clack/prompts", () => ({
      log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      intro: vi.fn(),
      cancel: vi.fn(),
      spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() })),
    }));

    vi.doMock("../utils/ui.js", () => ({
      printErrorWithHint: vi.fn(),
    }));

    vi.doMock("../utils/fs.js", () => ({
      installSkill: vi.fn(() => "/fake/path"),
      isSkillInstalled: vi.fn(() => false),
      writeSkillMeta: vi.fn(),
      readSkillMeta: vi.fn(),
    }));

    const failingProvider = {
      name: "fail-provider",
      fetch: vi.fn(async () => [{ path: "SKILL.md", content: "---\nname: test\n---\nBody" }]),
      info: vi.fn(async () => ({ name: "test", version: "1.0.0", description: "Test" })),
      list: vi.fn(async () => [{ name: "bad-skill", version: "1.0.0", description: "Bad" }]),
    };

    vi.doMock("../registry.js", () => ({
      getProvider: vi.fn(() => failingProvider),
      getProviders: vi.fn(() => [failingProvider]),
    }));

    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({ defaultProvider: "fail-provider" })),
    }));

    vi.doMock("../utils/help.js", () => ({
      renderBanner: vi.fn(() => "Banner"),
    }));

    vi.doMock("../utils/validate.js", () => ({
      validateSlug: vi.fn(),
    }));

    vi.doMock("../utils/install-core.js", () => ({
      installOneCore: vi.fn(async () => ({
        success: false,
        skillName: "bad-skill",
        error: "Install failed",
      })),
      sizeWarning: vi.fn(() => null),
      canInstall: vi.fn(() => ({ proceed: true })),
      detectProviderChange: vi.fn(() => null),
    }));

    vi.doMock("../utils/scanner.js", () => ({
      scanSkillContent: vi.fn(() => []),
    }));

    vi.doMock("../utils/integrity.js", () => ({
      updateLockEntry: vi.fn(),
    }));

    vi.doMock("../utils/conflict-check.js", () => ({
      checkConflicts: vi.fn(() => []),
    }));

    vi.doMock("../utils/project-context.js", () => ({
      detectProjectContext: vi.fn(() => ({ type: "unknown", lang: "general", frameworks: [], hasTests: false })),
    }));

    const module = await import("./install.js");
    const cmd = module.installCommand;

    await cmd([], { json: true, all: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0]![0] as string);
    expect(output.failed).toContain("bad-skill");
    expect(output.failedErrors).toBeDefined();
    expect(output.failedErrors["bad-skill"]).toBe("Install failed");
  });

  it("JSON mode --all: already installed skill gets skipped", async () => {
    vi.resetModules();

    vi.doMock("chalk", () => ({
      default: Object.assign((s: string) => s, {
        bold: (s: string) => s,
        cyan: (s: string) => s,
        dim: (s: string) => s,
        hex: () => (s: string) => s,
      }),
    }));

    vi.doMock("@clack/prompts", () => ({
      log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      intro: vi.fn(),
      cancel: vi.fn(),
      spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() })),
    }));

    vi.doMock("../utils/ui.js", () => ({
      printErrorWithHint: vi.fn(),
    }));

    vi.doMock("../utils/fs.js", () => ({
      installSkill: vi.fn(() => "/fake/path"),
      isSkillInstalled: vi.fn(() => true),
      writeSkillMeta: vi.fn(),
      readSkillMeta: vi.fn(),
    }));

    const allProvider = {
      name: "all-provider",
      fetch: vi.fn(async () => [{ path: "SKILL.md", content: "---\nname: test\n---\nBody" }]),
      info: vi.fn(async () => ({ name: "test", version: "1.0.0", description: "Test" })),
      list: vi.fn(async () => [{ name: "already-here", version: "1.0.0", description: "Already installed" }]),
    };

    vi.doMock("../registry.js", () => ({
      getProvider: vi.fn(() => allProvider),
      getProviders: vi.fn(() => [allProvider]),
    }));

    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({ defaultProvider: "all-provider" })),
    }));

    vi.doMock("../utils/help.js", () => ({
      renderBanner: vi.fn(() => "Banner"),
    }));

    vi.doMock("../utils/validate.js", () => ({
      validateSlug: vi.fn(),
    }));

    vi.doMock("../utils/scanner.js", () => ({
      scanSkillContent: vi.fn(() => []),
    }));

    vi.doMock("../utils/integrity.js", () => ({
      updateLockEntry: vi.fn(),
    }));

    vi.doMock("../utils/conflict-check.js", () => ({
      checkConflicts: vi.fn(() => []),
    }));

    vi.doMock("../utils/project-context.js", () => ({
      detectProjectContext: vi.fn(() => ({ type: "unknown", lang: "general", frameworks: [], hasTests: false })),
    }));

    const module = await import("./install.js");
    const cmd = module.installCommand;

    await cmd([], { json: true, all: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0]![0] as string);
    expect(output.skipped).toContain("already-here");
    expect(output.installed).toEqual([]);
  });

  it("JSON mode single-provider: catch block when validateSlug + installOneCore both fail (line 346)", async () => {
    vi.resetModules();

    vi.doMock("chalk", () => ({
      default: Object.assign((s: string) => s, {
        bold: (s: string) => s,
        cyan: (s: string) => s,
        dim: (s: string) => s,
        hex: () => (s: string) => s,
      }),
    }));

    vi.doMock("@clack/prompts", () => ({
      log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      intro: vi.fn(),
      cancel: vi.fn(),
      spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() })),
    }));

    vi.doMock("../utils/ui.js", () => ({
      printErrorWithHint: vi.fn(),
    }));

    vi.doMock("../utils/fs.js", () => ({
      installSkill: vi.fn(() => "/fake/path"),
      isSkillInstalled: vi.fn(() => false),
      writeSkillMeta: vi.fn(),
      readSkillMeta: vi.fn(),
    }));

    vi.doMock("../registry.js", () => ({
      getProvider: vi.fn(() => mockProvider),
      getProviders: vi.fn(() => [mockProvider]),
    }));

    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({ defaultProvider: "test-provider" })),
    }));

    vi.doMock("../utils/help.js", () => ({
      renderBanner: vi.fn(() => "Banner"),
    }));

    // Make validateSlug throw to hit the catch block at line 345-346
    vi.doMock("../utils/validate.js", () => ({
      validateSlug: vi.fn(() => {
        throw new Error("Invalid slug");
      }),
    }));

    vi.doMock("../utils/scanner.js", () => ({
      scanSkillContent: vi.fn(() => []),
    }));

    vi.doMock("../utils/integrity.js", () => ({
      updateLockEntry: vi.fn(),
    }));

    vi.doMock("../utils/conflict-check.js", () => ({
      checkConflicts: vi.fn(() => []),
    }));

    vi.doMock("../utils/project-context.js", () => ({
      detectProjectContext: vi.fn(() => ({ type: "unknown", lang: "general", frameworks: [], hasTests: false })),
    }));

    const module = await import("./install.js");
    const cmd = module.installCommand;

    await cmd(["bad!name"], { json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0]![0] as string);
    expect(output.failed).toContain("bad!name");
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
