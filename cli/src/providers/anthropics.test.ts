import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("AnthropicsProvider", () => {
  let AnthropicsProvider: typeof import("./anthropics.js").AnthropicsProvider;
  let validateSlugMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    validateSlugMock = vi.fn();

    vi.doMock("../utils/http.js", () => ({ httpGet: vi.fn() }));
    vi.doMock("../utils/validate.js", () => ({ validateSlug: validateSlugMock }));
    vi.doMock("../utils/parallel.js", () => ({
      parallelMap: vi.fn(async (items: unknown[], fn: (item: unknown) => Promise<unknown>) => Promise.all(items.map(fn))),
    }));
    vi.doMock("../utils/cache.js", () => ({
      readCache: vi.fn(() => null),
      writeCache: vi.fn(),
      clearCacheFile: vi.fn(),
    }));

    const module = await import("./anthropics.js");
    AnthropicsProvider = module.AnthropicsProvider;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("instantiates with correct owner, repo, and branch", () => {
    const provider = new AnthropicsProvider();

    expect(provider.name).toBe("anthropics");
    expect(provider.displayName).toBe("Anthropic Official");
    expect(validateSlugMock).toHaveBeenCalledWith("anthropics", "owner");
    expect(validateSlugMock).toHaveBeenCalledWith("skills", "repo");
  });

  it("extends GitHubProvider", () => {
    const provider = new AnthropicsProvider();
    // It should have all GitHubProvider methods
    expect(typeof provider.list).toBe("function");
    expect(typeof provider.search).toBe("function");
    expect(typeof provider.fetch).toBe("function");
    expect(typeof provider.clearCache).toBe("function");
  });
});
