import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("providers command", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let mockRemoveProvider: ReturnType<typeof vi.fn>;
  let mockAddProvider: ReturnType<typeof vi.fn>;
  let mockHttpGet: ReturnType<typeof vi.fn>;
  let mockClearProviderCache: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    mockRemoveProvider = vi.fn(() => true);
    mockAddProvider = vi.fn();
    mockHttpGet = vi.fn(() => Promise.resolve({ body: "{}", statusCode: 200 }));
    mockClearProviderCache = vi.fn();

    vi.doMock("../utils/ui.js", () => ({
      ui: {
        bold: (s: string) => s,
        dim: (s: string) => s,
        error: (s: string) => s,
        success: (s: string) => s,
        brand: (s: string) => s,
      },
      banner: vi.fn(),
      spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), fail: vi.fn(), succeed: vi.fn() })),
      noopSpinner: vi.fn(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        fail: vi.fn(),
        succeed: vi.fn(),
        info: vi.fn(),
        message: vi.fn(),
      })),
      table: vi.fn(),
    }));
    vi.doMock("../utils/config.js", () => ({
      loadConfig: vi.fn(() => ({
        defaultProvider: "arcana",
        providers: [
          { name: "arcana", type: "github", url: "spore-sec/arcana", enabled: true },
          { name: "custom/repo", type: "github", url: "custom/repo", enabled: true },
        ],
      })),
      addProvider: mockAddProvider,
      removeProvider: mockRemoveProvider,
    }));
    vi.doMock("../utils/http.js", () => ({
      httpGet: mockHttpGet,
    }));
    vi.doMock("../registry.js", () => ({
      parseProviderSlug: vi.fn((slug: string) => {
        const [owner, repo] = slug.split("/");
        return { owner, repo };
      }),
      clearProviderCache: mockClearProviderCache,
    }));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.resetModules();
  });

  it("lists providers as JSON", async () => {
    const { providersCommand } = await import("./providers.js");
    await providersCommand({ json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.providers).toHaveLength(2);
    expect(output.providers[0]).toMatchObject({ name: "arcana", default: true });
    expect(output.providers[1]).toMatchObject({ name: "custom/repo", default: false });
  });

  it("remove default provider 'arcana' fails", async () => {
    const { providersCommand } = await import("./providers.js");
    await expect(providersCommand({ json: true, remove: "arcana" })).rejects.toThrow("process.exit");

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.error).toContain("Cannot remove");
  });

  it("remove non-default provider succeeds", async () => {
    const { providersCommand } = await import("./providers.js");
    await providersCommand({ json: true, remove: "custom" });

    expect(mockRemoveProvider).toHaveBeenCalledWith("custom");
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output).toMatchObject({ action: "remove", provider: "custom", success: true });
  });

  it("add provider succeeds", async () => {
    const { providersCommand } = await import("./providers.js");
    await providersCommand({ json: true, add: "user/repo" });

    expect(mockHttpGet).toHaveBeenCalled();
    expect(mockAddProvider).toHaveBeenCalled();
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output).toMatchObject({ action: "add", success: true });
  });

  it("add provider falls back to master branch", async () => {
    let callCount = 0;
    mockHttpGet.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error("404 Not Found"));
      return Promise.resolve({ body: "{}", statusCode: 200 });
    });

    const { providersCommand } = await import("./providers.js");
    await providersCommand({ json: true, add: "user/repo" });

    expect(mockHttpGet).toHaveBeenCalledTimes(2);
    expect(mockAddProvider).toHaveBeenCalled();
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output).toMatchObject({ action: "add", provider: "user/repo", success: true });
  });

  it("add provider fails on both branches", async () => {
    mockHttpGet.mockImplementation(() => Promise.reject(new Error("404 Not Found")));

    const { providersCommand } = await import("./providers.js");
    await expect(providersCommand({ json: true, add: "user/repo" })).rejects.toThrow("process.exit");

    expect(mockHttpGet).toHaveBeenCalledTimes(2);
    const jsonCall = consoleLogSpy.mock.calls.find((call: unknown[]) => {
      try {
        const p = JSON.parse(call[0]);
        return p.error;
      } catch {
        return false;
      }
    });
    expect(jsonCall).toBeDefined();
    const output = JSON.parse(jsonCall[0]);
    expect(output.error).toContain("Could not find marketplace.json");
  });

  it("remove provider that doesn't exist", async () => {
    mockRemoveProvider.mockReturnValue(false);

    const { providersCommand } = await import("./providers.js");
    await providersCommand({ json: true, remove: "nonexistent" });

    expect(mockRemoveProvider).toHaveBeenCalledWith("nonexistent");
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output).toMatchObject({ action: "remove", provider: "nonexistent", success: false });
  });
});
