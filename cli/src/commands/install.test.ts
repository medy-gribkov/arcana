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
});
