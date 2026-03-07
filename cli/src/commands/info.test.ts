import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SkillInfo } from "../types.js";

interface MockProvider {
  info: (skillName: string) => Promise<SkillInfo | null>;
}

interface MockSkillMeta {
  version: string;
  name?: string;
  description?: string;
  source?: string;
  installedAt?: string;
}

describe("infoCommand", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    vi.doMock("../utils/ui.js", () => ({
      ui: { error: vi.fn((msg: string) => msg) },
      banner: vi.fn(),
      spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), fail: vi.fn() })),
      noopSpinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), fail: vi.fn() })),
      printErrorWithHint: vi.fn(),
    }));

    vi.doMock("../utils/fs.js", () => ({
      isSkillInstalled: vi.fn(() => false),
      readSkillMeta: vi.fn(() => ({ version: "1.0.0" })),
    }));

    vi.doMock("../registry.js", () => ({
      getProviders: vi.fn(() => []),
    }));

    vi.doMock("../utils/validate.js", () => ({
      validateSlug: vi.fn(),
    }));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.doUnmock("../utils/ui.js");
    vi.doUnmock("../utils/fs.js");
    vi.doUnmock("../registry.js");
    vi.doUnmock("../utils/validate.js");
    vi.resetModules();
  });

  it("exits with error JSON when slug is invalid", async () => {
    const { validateSlug } = await import("../utils/validate.js");
    vi.mocked(validateSlug).mockImplementation(() => {
      throw new Error("Invalid slug");
    });

    const { infoCommand } = await import("./info.js");
    await infoCommand("bad@slug", { json: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"error"'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("returns JSON with installed: false when skill found but not installed", async () => {
    const { getProviders } = await import("../registry.js");
    const { isSkillInstalled } = await import("../utils/fs.js");

    vi.mocked(isSkillInstalled).mockReturnValue(false);
    vi.mocked(getProviders).mockReturnValue([
      {
        info: vi.fn(async () => ({
          name: "test-skill",
          description: "Test skill",
          version: "2.0.0",
          source: "marketplace",
          repo: "example/repo",
        })),
      } as unknown as MockProvider,
    ] as unknown as ReturnType<typeof getProviders>);

    const { infoCommand } = await import("./info.js");
    await infoCommand("test-skill", { json: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"installed":false'));
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("returns JSON with installedVersion when skill found and installed", async () => {
    const { getProviders } = await import("../registry.js");
    const { isSkillInstalled, readSkillMeta } = await import("../utils/fs.js");

    vi.mocked(isSkillInstalled).mockReturnValue(true);
    vi.mocked(readSkillMeta).mockReturnValue({
      version: "1.5.0",
    } as MockSkillMeta as ReturnType<typeof readSkillMeta>);
    vi.mocked(getProviders).mockReturnValue([
      {
        info: vi.fn(async () => ({
          name: "test-skill",
          description: "Test skill",
          version: "2.0.0",
          source: "marketplace",
          repo: "example/repo",
        })),
      } as unknown as MockProvider,
    ] as unknown as ReturnType<typeof getProviders>);

    const { infoCommand } = await import("./info.js");
    await infoCommand("test-skill", { json: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"installedVersion":"1.5.0"'));
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("returns offline fallback JSON when provider throws but skill is installed", async () => {
    const { getProviders } = await import("../registry.js");
    const { isSkillInstalled, readSkillMeta } = await import("../utils/fs.js");

    vi.mocked(isSkillInstalled).mockReturnValue(true);
    vi.mocked(readSkillMeta).mockReturnValue({
      version: "1.0.0",
      name: "test-skill",
      description: "Local skill",
    } as MockSkillMeta as ReturnType<typeof readSkillMeta>);
    vi.mocked(getProviders).mockReturnValue([
      {
        info: vi.fn(async () => {
          throw new Error("Network error");
        }),
      } as unknown as MockProvider,
    ] as unknown as ReturnType<typeof getProviders>);

    const { infoCommand } = await import("./info.js");
    await infoCommand("test-skill", { json: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"offline":true'));
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("returns error JSON when provider throws and skill is NOT installed", async () => {
    const { getProviders } = await import("../registry.js");
    const { isSkillInstalled } = await import("../utils/fs.js");

    vi.mocked(isSkillInstalled).mockReturnValue(false);
    vi.mocked(getProviders).mockReturnValue([
      {
        info: vi.fn(async () => {
          throw new Error("Connection refused");
        }),
      } as unknown as MockProvider,
    ] as unknown as ReturnType<typeof getProviders>);

    const { infoCommand } = await import("./info.js");
    await infoCommand("missing-offline", { json: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"error"'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Connection refused"));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with error JSON when skill not found by any provider", async () => {
    const { getProviders } = await import("../registry.js");
    const { isSkillInstalled } = await import("../utils/fs.js");

    vi.mocked(isSkillInstalled).mockReturnValue(false);
    vi.mocked(getProviders).mockReturnValue([
      { info: vi.fn(async () => null) } as unknown as MockProvider,
    ] as unknown as ReturnType<typeof getProviders>);

    const { infoCommand } = await import("./info.js");
    await infoCommand("missing-skill", { json: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"error"'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
