import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("GitHubProvider", () => {
  let GitHubProvider: typeof import("./github.js").GitHubProvider;
  let httpGetMock: ReturnType<typeof vi.fn>;
  let validateSlugMock: ReturnType<typeof vi.fn>;
  let parallelMapMock: ReturnType<typeof vi.fn>;
  let readCacheMock: ReturnType<typeof vi.fn>;
  let writeCacheMock: ReturnType<typeof vi.fn>;
  let clearCacheFileMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    httpGetMock = vi.fn();
    validateSlugMock = vi.fn();
    parallelMapMock = vi.fn(async (items, fn, _concurrency) => Promise.all(items.map(fn)));
    readCacheMock = vi.fn(() => null);
    writeCacheMock = vi.fn();
    clearCacheFileMock = vi.fn();

    vi.doMock("../utils/http.js", () => ({ httpGet: httpGetMock }));
    vi.doMock("../utils/validate.js", () => ({ validateSlug: validateSlugMock }));
    vi.doMock("../utils/parallel.js", () => ({ parallelMap: parallelMapMock }));
    vi.doMock("../utils/cache.js", () => ({
      readCache: readCacheMock,
      writeCache: writeCacheMock,
      clearCacheFile: clearCacheFileMock,
    }));

    const module = await import("./github.js");
    GitHubProvider = module.GitHubProvider;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("sets name and displayName correctly", () => {
    const provider = new GitHubProvider("owner", "repo");
    expect(provider.name).toBe("owner/repo");
    expect(provider.displayName).toBe("owner/repo");

    const customProvider = new GitHubProvider("owner", "repo", {
      name: "custom-name",
      displayName: "Custom Display",
    });
    expect(customProvider.name).toBe("custom-name");
    expect(customProvider.displayName).toBe("Custom Display");
  });

  it("validates owner and repo slugs on construction", () => {
    validateSlugMock.mockImplementationOnce(() => {
      throw new Error("Invalid owner slug");
    });

    expect(() => new GitHubProvider("bad owner", "repo")).toThrow("Invalid owner slug");
    expect(validateSlugMock).toHaveBeenCalledWith("bad owner", "owner");
  });

  it("fetches marketplace.json and returns parsed skills", async () => {
    const mockPlugins = [
      { name: "skill-one", description: "First skill", version: "1.0.0" },
      { name: "skill-two", description: "Second skill", version: "2.0.0" },
    ];

    httpGetMock.mockResolvedValueOnce({
      body: JSON.stringify({ plugins: mockPlugins }),
      statusCode: 200,
    });

    const provider = new GitHubProvider("owner", "repo");
    const skills = await provider.list();

    expect(httpGetMock).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/owner/repo/main/.claude-plugin/marketplace.json",
    );
    expect(skills).toEqual([
      {
        name: "skill-one",
        description: "First skill",
        version: "1.0.0",
        source: "owner/repo",
        repo: "https://github.com/owner/repo",
      },
      {
        name: "skill-two",
        description: "Second skill",
        version: "2.0.0",
        source: "owner/repo",
        repo: "https://github.com/owner/repo",
      },
    ]);
  });

  it("uses disk cache when available", async () => {
    const cachedSkills = [
      {
        name: "cached-skill",
        description: "From cache",
        version: "1.0.0",
        source: "owner/repo",
        repo: "https://github.com/owner/repo",
      },
    ];

    readCacheMock.mockReturnValueOnce(cachedSkills);

    const provider = new GitHubProvider("owner", "repo");
    const skills = await provider.list();

    expect(readCacheMock).toHaveBeenCalledWith("owner-repo");
    expect(skills).toEqual(cachedSkills);
    expect(httpGetMock).not.toHaveBeenCalled();
  });

  it("caches results to disk after fetching", async () => {
    const mockPlugins = [{ name: "skill", description: "Test", version: "1.0.0" }];

    httpGetMock.mockResolvedValueOnce({
      body: JSON.stringify({ plugins: mockPlugins }),
      statusCode: 200,
    });

    const provider = new GitHubProvider("owner", "repo");
    await provider.list();

    expect(writeCacheMock).toHaveBeenCalledWith("owner-repo", [
      {
        name: "skill",
        description: "Test",
        version: "1.0.0",
        source: "owner/repo",
        repo: "https://github.com/owner/repo",
      },
    ]);
  });

  it("returns exact matches by name in search", async () => {
    const mockPlugins = [
      { name: "test-skill", description: "A test skill", version: "1.0.0" },
      { name: "other-skill", description: "Another skill", version: "1.0.0" },
    ];

    httpGetMock.mockResolvedValueOnce({
      body: JSON.stringify({ plugins: mockPlugins }),
      statusCode: 200,
    });

    const provider = new GitHubProvider("owner", "repo");
    const results = await provider.search("test");

    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe("test-skill");
  });

  it("returns fuzzy matches via Levenshtein for longer queries", async () => {
    const mockPlugins = [
      { name: "typescript", description: "TypeScript skill", version: "1.0.0" },
      { name: "javascript", description: "JavaScript skill", version: "1.0.0" },
    ];

    httpGetMock.mockResolvedValueOnce({
      body: JSON.stringify({ plugins: mockPlugins }),
      statusCode: 200,
    });

    const provider = new GitHubProvider("owner", "repo");
    const results = await provider.search("typscript");

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.name === "typescript")).toBe(true);
  });

  it("clears memory and disk cache", async () => {
    const mockPlugins = [{ name: "skill", description: "Test", version: "1.0.0" }];

    httpGetMock.mockResolvedValue({
      body: JSON.stringify({ plugins: mockPlugins }),
      statusCode: 200,
    });

    const provider = new GitHubProvider("owner", "repo");

    await provider.list();
    expect(httpGetMock).toHaveBeenCalledTimes(1);

    await provider.list();
    expect(httpGetMock).toHaveBeenCalledTimes(1);

    provider.clearCache();
    expect(clearCacheFileMock).toHaveBeenCalledWith("owner-repo");

    await provider.list();
    expect(httpGetMock).toHaveBeenCalledTimes(2);
  });
});
