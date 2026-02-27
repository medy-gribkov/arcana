import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("config command", () => {
  let configCommand: (
    action: string | undefined,
    value: string | undefined,
    opts?: { json?: boolean },
  ) => Promise<void>;
  let mockExistsSync: ReturnType<typeof vi.fn>;
  let mockRmSync: ReturnType<typeof vi.fn>;
  let mockHomedir: ReturnType<typeof vi.fn>;
  let mockLoadConfig: ReturnType<typeof vi.fn>;
  let mockSaveConfig: ReturnType<typeof vi.fn>;
  let mockClearProviderCache: ReturnType<typeof vi.fn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();

    mockExistsSync = vi.fn(() => true);
    mockRmSync = vi.fn();
    mockHomedir = vi.fn(() => "/fake/home");
    mockLoadConfig = vi.fn(() => ({
      defaultProvider: "arcana",
      installDir: "/fake/install",
      providers: [{ name: "arcana" }],
    }));
    mockSaveConfig = vi.fn();
    mockClearProviderCache = vi.fn();

    vi.doMock("node:fs", () => ({
      existsSync: mockExistsSync,
      rmSync: mockRmSync,
    }));

    vi.doMock("node:path", () => ({
      join: (...parts: string[]) => parts.join("/"),
      isAbsolute: (path: string) => path.startsWith("/"),
    }));

    vi.doMock("node:os", () => ({
      homedir: mockHomedir,
    }));

    vi.doMock("../utils/config.js", () => ({
      loadConfig: mockLoadConfig,
      saveConfig: mockSaveConfig,
    }));

    vi.doMock("../utils/ui.js", () => ({
      ui: {
        bold: (s: string) => s,
        dim: (s: string) => s,
        warn: (s: string) => s,
        error: (s: string) => s,
        success: (s: string) => s,
      },
      banner: vi.fn(),
      table: vi.fn(),
    }));

    vi.doMock("../registry.js", () => ({
      clearProviderCache: mockClearProviderCache,
    }));

    const module = await import("./config.js");
    configCommand = module.configCommand;

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.resetModules();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("returns config JSON when action is 'list'", async () => {
    await configCommand("list", undefined, { json: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify({
        config: {
          defaultProvider: "arcana",
          installDir: "/fake/install",
          providers: [{ name: "arcana" }],
        },
      }),
    );
  });

  it("returns config path and exists flag when action is 'path'", async () => {
    mockExistsSync.mockReturnValue(true);

    await configCommand("path", undefined, { json: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify({
        path: "/fake/home/.arcana/config.json",
        exists: true,
      }),
    );
  });

  it("removes config file and returns success when action is 'reset'", async () => {
    mockExistsSync.mockReturnValue(true);

    await configCommand("reset", undefined, { json: true });

    expect(mockRmSync).toHaveBeenCalledWith("/fake/home/.arcana/config.json", { force: true });
    expect(mockClearProviderCache).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify({
        action: "reset",
        success: true,
        existed: true,
      }),
    );
  });

  it("returns error JSON and exits 1 when key is unknown", async () => {
    await configCommand("unknownKey", undefined, { json: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify({
        error: "Unknown config key: unknownKey",
        validKeys: ["defaultProvider", "installDir"],
      }),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("returns value when getting a known key", async () => {
    await configCommand("defaultProvider", undefined, { json: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify({
        action: "get",
        key: "defaultProvider",
        value: "arcana",
      }),
    );
  });

  it("saves config and returns confirmation when setting a known key", async () => {
    await configCommand("defaultProvider", "arcana", { json: true });

    expect(mockSaveConfig).toHaveBeenCalledWith({
      defaultProvider: "arcana",
      installDir: "/fake/install",
      providers: [{ name: "arcana" }],
    });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify({
        action: "set",
        key: "defaultProvider",
        value: "arcana",
      }),
    );
  });
});
