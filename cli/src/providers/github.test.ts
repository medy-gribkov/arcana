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

  // ──────────────────────────────────────────
  // Constructor
  // ──────────────────────────────────────────

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

  it("validates branch slug when provided", () => {
    validateSlugMock.mockImplementation((val: string, label: string) => {
      if (label === "branch" && val === "bad branch") throw new Error("Invalid branch slug");
    });

    expect(() => new GitHubProvider("owner", "repo", { branch: "bad branch" })).toThrow("Invalid branch slug");
  });

  it("uses custom branch in URLs", async () => {
    const provider = new GitHubProvider("owner", "repo", { branch: "develop" });

    httpGetMock.mockResolvedValueOnce({
      body: JSON.stringify({ plugins: [{ name: "s", description: "d", version: "1.0.0" }] }),
      statusCode: 200,
    });

    await provider.list();

    expect(httpGetMock).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/owner/repo/develop/.claude-plugin/marketplace.json",
    );
  });

  // ──────────────────────────────────────────
  // list()
  // ──────────────────────────────────────────

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

  it("uses in-memory cache on second call", async () => {
    httpGetMock.mockResolvedValueOnce({
      body: JSON.stringify({ plugins: [{ name: "s", description: "d", version: "1.0.0" }] }),
      statusCode: 200,
    });

    const provider = new GitHubProvider("owner", "repo");
    const first = await provider.list();
    const second = await provider.list();

    expect(httpGetMock).toHaveBeenCalledTimes(1);
    expect(first).toBe(second); // Same reference (in-memory cache)
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

  it("throws on invalid JSON response from marketplace", async () => {
    httpGetMock.mockResolvedValueOnce({
      body: "not valid json{{{",
      statusCode: 200,
    });

    const provider = new GitHubProvider("owner", "repo");
    await expect(provider.list()).rejects.toThrow("Failed to parse response");
  });

  it("throws when plugins array is missing", async () => {
    httpGetMock.mockResolvedValueOnce({
      body: JSON.stringify({ name: "no-plugins" }),
      statusCode: 200,
    });

    const provider = new GitHubProvider("owner", "repo");
    await expect(provider.list()).rejects.toThrow("missing plugins array");
  });

  it("filters out malformed plugin entries", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mockPlugins = [
      { name: "good-skill", description: "Valid", version: "1.0.0" },
      { name: 123, description: "Invalid name type", version: "1.0.0" }, // name not string
      { name: "no-desc", version: "1.0.0" }, // missing description
      { name: "no-version", description: "Missing version" }, // missing version
    ];

    httpGetMock.mockResolvedValueOnce({
      body: JSON.stringify({ plugins: mockPlugins }),
      statusCode: 200,
    });

    const provider = new GitHubProvider("owner", "repo");
    const skills = await provider.list();

    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe("good-skill");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("3 malformed entries"));

    consoleSpy.mockRestore();
  });

  it("warns with singular form for 1 malformed entry", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    httpGetMock.mockResolvedValueOnce({
      body: JSON.stringify({
        plugins: [
          { name: "good", description: "ok", version: "1.0.0" },
          { name: 123, description: "bad", version: "1.0.0" },
        ],
      }),
      statusCode: 200,
    });

    const provider = new GitHubProvider("owner", "repo");
    await provider.list();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("1 malformed entry"));

    consoleSpy.mockRestore();
  });

  it("maps tags, conflicts, companions, verified, and author fields", async () => {
    httpGetMock.mockResolvedValueOnce({
      body: JSON.stringify({
        plugins: [
          {
            name: "full-skill",
            description: "Complete",
            version: "2.0.0",
            tags: ["go", "testing"],
            conflicts: ["old-skill"],
            companions: ["helper-skill"],
            verified: true,
            author: "dev",
          },
        ],
      }),
      statusCode: 200,
    });

    const provider = new GitHubProvider("owner", "repo");
    const skills = await provider.list();

    expect(skills[0]).toEqual({
      name: "full-skill",
      description: "Complete",
      version: "2.0.0",
      source: "owner/repo",
      repo: "https://github.com/owner/repo",
      tags: ["go", "testing"],
      conflicts: ["old-skill"],
      companions: ["helper-skill"],
      verified: true,
      author: "dev",
    });
  });

  // ──────────────────────────────────────────
  // search()
  // ──────────────────────────────────────────

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

  it("matches by description in search", async () => {
    httpGetMock.mockResolvedValueOnce({
      body: JSON.stringify({
        plugins: [
          { name: "skill-a", description: "Handles database migrations", version: "1.0.0" },
          { name: "skill-b", description: "React components", version: "1.0.0" },
        ],
      }),
      statusCode: 200,
    });

    const provider = new GitHubProvider("owner", "repo");
    const results = await provider.search("database");

    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("skill-a");
  });

  it("matches by tags in search", async () => {
    httpGetMock.mockResolvedValueOnce({
      body: JSON.stringify({
        plugins: [
          { name: "skill-a", description: "A skill", version: "1.0.0", tags: ["golang", "testing"] },
          { name: "skill-b", description: "B skill", version: "1.0.0", tags: ["python"] },
        ],
      }),
      statusCode: 200,
    });

    const provider = new GitHubProvider("owner", "repo");
    const results = await provider.search("golang");

    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("skill-a");
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

  it("returns empty for short queries with no exact match", async () => {
    httpGetMock.mockResolvedValueOnce({
      body: JSON.stringify({
        plugins: [
          { name: "golang", description: "Go skill", version: "1.0.0" },
          { name: "python", description: "Python skill", version: "1.0.0" },
        ],
      }),
      statusCode: 200,
    });

    const provider = new GitHubProvider("owner", "repo");
    // "zz" is short (< 3 chars) and doesn't match anything exactly
    const results = await provider.search("zz");

    expect(results).toHaveLength(0);
  });

  it("returns empty when Levenshtein distance is too large", async () => {
    httpGetMock.mockResolvedValueOnce({
      body: JSON.stringify({
        plugins: [
          { name: "typescript", description: "TS skill", version: "1.0.0" },
        ],
      }),
      statusCode: 200,
    });

    const provider = new GitHubProvider("owner", "repo");
    // "xxxxxxxxxxx" is far from "typescript" (Levenshtein > 3)
    const results = await provider.search("xxxxxxxxxxx");

    expect(results).toHaveLength(0);
  });

  // ──────────────────────────────────────────
  // fetch()
  // ──────────────────────────────────────────

  it("fetches skill files from tree", async () => {
    const treeItems = [
      { path: "skills/my-skill/SKILL.md", type: "blob", url: "" },
      { path: "skills/my-skill/rules/rule.md", type: "blob", url: "" },
      { path: "skills/other-skill/SKILL.md", type: "blob", url: "" },
      { path: "skills/my-skill/subdir", type: "tree", url: "" }, // directory, should be excluded
    ];

    httpGetMock
      .mockResolvedValueOnce({
        body: JSON.stringify({ tree: treeItems }),
        statusCode: 200,
      })
      .mockResolvedValueOnce({ body: "# My Skill", statusCode: 200 })
      .mockResolvedValueOnce({ body: "rule content", statusCode: 200 });

    const provider = new GitHubProvider("owner", "repo");
    const files = await provider.fetch("my-skill");

    expect(files).toHaveLength(2);
    expect(files.some((f) => f.path === "SKILL.md")).toBe(true);
    expect(files.some((f) => f.path === "rules/rule.md")).toBe(true);
  });

  it("throws when skill has no files in tree", async () => {
    httpGetMock.mockResolvedValueOnce({
      body: JSON.stringify({
        tree: [{ path: "skills/other-skill/SKILL.md", type: "blob", url: "" }],
      }),
      statusCode: 200,
    });

    const provider = new GitHubProvider("owner", "repo");
    await expect(provider.fetch("nonexistent")).rejects.toThrow('Skill "nonexistent" not found');
  });

  it("filters out files with path traversal in relative path", async () => {
    httpGetMock
      .mockResolvedValueOnce({
        body: JSON.stringify({
          tree: [
            { path: "skills/my-skill/SKILL.md", type: "blob", url: "" },
            { path: "skills/my-skill/../../../etc/passwd", type: "blob", url: "" },
          ],
        }),
        statusCode: 200,
      })
      .mockResolvedValueOnce({ body: "# Skill", statusCode: 200 });

    // parallelMap processes items; the path traversal check returns null
    const provider = new GitHubProvider("owner", "repo");
    const files = await provider.fetch("my-skill");

    // The traversal file should be filtered (returns null)
    expect(files).toHaveLength(1);
    expect(files[0]!.path).toBe("SKILL.md");
  });

  it("throws on file fetch failure with descriptive message", async () => {
    httpGetMock
      .mockResolvedValueOnce({
        body: JSON.stringify({
          tree: [{ path: "skills/my-skill/SKILL.md", type: "blob", url: "" }],
        }),
        statusCode: 200,
      })
      .mockRejectedValueOnce(new Error("404 Not Found"));

    const provider = new GitHubProvider("owner", "repo");
    await expect(provider.fetch("my-skill")).rejects.toThrow('Failed to fetch file "SKILL.md"');
  });

  it("throws on invalid JSON from tree endpoint", async () => {
    httpGetMock.mockResolvedValueOnce({
      body: "not json at all",
      statusCode: 200,
    });

    const provider = new GitHubProvider("owner", "repo");
    await expect(provider.fetch("my-skill")).rejects.toThrow("Failed to parse response");
  });

  it("caches tree between multiple fetch calls", async () => {
    const tree = [
      { path: "skills/skill-a/SKILL.md", type: "blob", url: "" },
      { path: "skills/skill-b/SKILL.md", type: "blob", url: "" },
    ];

    httpGetMock
      .mockResolvedValueOnce({ body: JSON.stringify({ tree }), statusCode: 200 })
      .mockResolvedValueOnce({ body: "content A", statusCode: 200 })
      .mockResolvedValueOnce({ body: "content B", statusCode: 200 });

    const provider = new GitHubProvider("owner", "repo");
    await provider.fetch("skill-a");
    await provider.fetch("skill-b");

    // Tree should be fetched only once (first httpGet call), then cached
    const treeCalls = httpGetMock.mock.calls.filter((c: string[]) =>
      c[0].includes("git/trees"),
    );
    expect(treeCalls).toHaveLength(1);
  });

  // ──────────────────────────────────────────
  // clearCache()
  // ──────────────────────────────────────────

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

  it("clears tree cache on clearCache", async () => {
    const tree = [{ path: "skills/s/SKILL.md", type: "blob", url: "" }];

    httpGetMock
      .mockResolvedValueOnce({ body: JSON.stringify({ tree }), statusCode: 200 })
      .mockResolvedValueOnce({ body: "v1", statusCode: 200 })
      .mockResolvedValueOnce({ body: JSON.stringify({ tree }), statusCode: 200 })
      .mockResolvedValueOnce({ body: "v2", statusCode: 200 });

    const provider = new GitHubProvider("owner", "repo");

    await provider.fetch("s");
    provider.clearCache();
    await provider.fetch("s");

    // Tree endpoint should have been called twice (once before clear, once after)
    const treeCalls = httpGetMock.mock.calls.filter((c: string[]) =>
      c[0].includes("git/trees"),
    );
    expect(treeCalls).toHaveLength(2);
  });
});
