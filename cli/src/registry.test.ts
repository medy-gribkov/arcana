import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock modules at top level
vi.mock("./utils/config.js", () => ({
  loadConfig: vi.fn(() => ({
    defaultProvider: "arcana",
    installDir: "/tmp/test-home/.agents/skills",
    providers: [
      { name: "arcana", type: "arcana", url: "", enabled: true },
      { name: "test-provider", type: "github", url: "testowner/testrepo", enabled: true },
      { name: "disabled-provider", type: "github", url: "owner/repo", enabled: false },
    ],
  })),
}));

vi.mock("./utils/ui.js", () => ({
  errorAndExit: vi.fn((msg: string) => {
    throw new Error(msg);
  }),
}));

vi.mock("./providers/github.js", () => {
  class MockGitHubProvider {
    constructor(
      public owner: string,
      public repo: string,
      public options?: { name?: string; displayName?: string },
    ) {}
  }
  return {
    GitHubProvider: MockGitHubProvider,
    validateSlug: vi.fn(),
  };
});

vi.mock("./providers/arcana.js", () => {
  class MockArcanaProvider {
    name = "arcana";
  }
  return {
    ArcanaProvider: MockArcanaProvider,
  };
});

vi.mock("./providers/base.js", () => {
  class MockProvider {
    name = "base";
  }
  return {
    Provider: MockProvider,
  };
});

describe("registry", () => {
  let mockConfig: typeof import("./utils/config.js");
  let mockUi: typeof import("./utils/ui.js");
  let mockGitHub: typeof import("./providers/github.js");

  beforeEach(async () => {
    vi.resetModules();
    mockConfig = await import("./utils/config.js");
    mockUi = await import("./utils/ui.js");
    mockGitHub = await import("./providers/github.js");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("parseProviderSlug", () => {
    it("should parse valid owner/repo format", async () => {
      const { parseProviderSlug } = await import("./registry.js");
      const result = parseProviderSlug("myowner/myrepo");

      expect(result).toEqual({ owner: "myowner", repo: "myrepo" });
    });

    it("should parse valid slug with numbers and hyphens", async () => {
      const { parseProviderSlug } = await import("./registry.js");
      const result = parseProviderSlug("my-owner-123/my-repo-456");

      expect(result).toEqual({ owner: "my-owner-123", repo: "my-repo-456" });
    });

    it("should throw for slug without slash", async () => {
      const { parseProviderSlug } = await import("./registry.js");

      expect(() => parseProviderSlug("invalid")).toThrow('Invalid provider slug: "invalid"');
    });

    it("should throw for slug with multiple slashes", async () => {
      const { parseProviderSlug } = await import("./registry.js");

      expect(() => parseProviderSlug("owner/repo/extra")).toThrow('Invalid provider slug: "owner/repo/extra"');
    });

    it("should throw for slug with empty owner", async () => {
      const { parseProviderSlug } = await import("./registry.js");

      expect(() => parseProviderSlug("/repo")).toThrow('Invalid provider slug: "/repo"');
    });

    it("should throw for slug with empty repo", async () => {
      const { parseProviderSlug } = await import("./registry.js");

      expect(() => parseProviderSlug("owner/")).toThrow('Invalid provider slug: "owner/"');
    });

    it("should throw for empty string", async () => {
      const { parseProviderSlug } = await import("./registry.js");

      expect(() => parseProviderSlug("")).toThrow('Invalid provider slug: ""');
    });
  });

  describe("clearProviderCache", () => {
    it("should clear the cache so getProvider creates new instances", async () => {
      const { getProvider, clearProviderCache } = await import("./registry.js");

      const provider1 = getProvider("arcana");
      const provider2 = getProvider("arcana");
      expect(provider1).toBe(provider2); // Should be cached

      clearProviderCache();

      const provider3 = getProvider("arcana");
      expect(provider1).not.toBe(provider3); // Should be new instance
    });
  });

  describe("getProvider", () => {
    beforeEach(async () => {
      const { clearProviderCache } = await import("./registry.js");
      clearProviderCache();
    });

    it("should return arcana provider for arcana", async () => {
      const { getProvider } = await import("./registry.js");
      const { ArcanaProvider } = await import("./providers/arcana.js");

      const provider = getProvider("arcana");

      expect(provider).toBeInstanceOf(ArcanaProvider);
    });

    it("should create github provider for configured provider", async () => {
      const { getProvider } = await import("./registry.js");
      const { GitHubProvider } = await import("./providers/github.js");

      const provider = getProvider("test-provider");

      expect(provider).toBeInstanceOf(GitHubProvider);
      const ghProvider = provider as unknown as { owner: string; repo: string };
      expect(ghProvider.owner).toBe("testowner");
      expect(ghProvider.repo).toBe("testrepo");
    });

    it("should treat owner/repo as ad-hoc github provider", async () => {
      const { getProvider } = await import("./registry.js");
      const { GitHubProvider } = await import("./providers/github.js");

      const provider = getProvider("adhoc-owner/adhoc-repo");

      expect(provider).toBeInstanceOf(GitHubProvider);
      const ghProvider = provider as unknown as { owner: string; repo: string; options?: { name?: string } };
      expect(ghProvider.owner).toBe("adhoc-owner");
      expect(ghProvider.repo).toBe("adhoc-repo");
      expect(ghProvider.options?.name).toBe("adhoc-owner/adhoc-repo");
    });

    it("should use default provider when no name provided", async () => {
      const { getProvider } = await import("./registry.js");
      const { ArcanaProvider } = await import("./providers/arcana.js");

      const provider = getProvider();

      expect(provider).toBeInstanceOf(ArcanaProvider);
    });

    it("should throw for non-existent provider", async () => {
      const { getProvider } = await import("./registry.js");

      expect(() => getProvider("nonexistent")).toThrow('Provider "nonexistent" not found');
    });

    it("should cache provider instances", async () => {
      const { getProvider } = await import("./registry.js");

      const provider1 = getProvider("test-provider");
      const provider2 = getProvider("test-provider");

      expect(provider1).toBe(provider2);
    });

    it("should cache ad-hoc provider instances", async () => {
      const { getProvider } = await import("./registry.js");

      const provider1 = getProvider("owner/repo");
      const provider2 = getProvider("owner/repo");

      expect(provider1).toBe(provider2);
    });

    it("should validate slug when creating github provider", async () => {
      const { getProvider } = await import("./registry.js");
      mockGitHub.validateSlug.mockClear();

      getProvider("test-provider");

      expect(mockGitHub.validateSlug).toHaveBeenCalledWith("testowner", "owner");
      expect(mockGitHub.validateSlug).toHaveBeenCalledWith("testrepo", "repo");
    });

    it("should throw when validateSlug fails", async () => {
      const { getProvider, clearProviderCache } = await import("./registry.js");
      clearProviderCache();
      mockGitHub.validateSlug.mockImplementation(() => {
        throw new Error("Invalid slug");
      });

      expect(() => getProvider("test-provider")).toThrow("Invalid slug");
    });
  });

  describe("getProviders", () => {
    beforeEach(async () => {
      const { clearProviderCache } = await import("./registry.js");
      clearProviderCache();
      mockGitHub.validateSlug.mockReset();
    });

    it("should return all enabled providers", async () => {
      const { getProviders } = await import("./registry.js");

      const providers = getProviders();

      expect(providers).toHaveLength(2); // arcana and test-provider (disabled-provider is excluded)
    });

    it("should not include disabled providers", async () => {
      const { getProviders } = await import("./registry.js");

      const providers = getProviders();
      const names = providers.map((p) => {
        const gp = p as unknown as { options?: { name?: string }; name?: string };
        return gp.options?.name || gp.name || "arcana";
      });

      expect(names).not.toContain("disabled-provider");
    });

    it("should return single provider when name provided", async () => {
      const { getProviders } = await import("./registry.js");

      const providers = getProviders("arcana");

      expect(providers).toHaveLength(1);
    });

    it("should return ad-hoc provider when owner/repo provided", async () => {
      const { getProviders } = await import("./registry.js");
      const { GitHubProvider } = await import("./providers/github.js");

      const providers = getProviders("custom-owner/custom-repo");

      expect(providers).toHaveLength(1);
      expect(providers[0]).toBeInstanceOf(GitHubProvider);
    });
  });
});
