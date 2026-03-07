import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "node:path";

const { MOCK_HOME, CONFIG_PATH, mockFs } = vi.hoisted(() => {
  const { join } = require("node:path") as typeof import("node:path");
  const MOCK_HOME = join("/mock-home");
  const CONFIG_PATH = join(MOCK_HOME, ".arcana", "config.json");
  const store: Record<string, string> = {};
  const mockFs = {
    existsSync: vi.fn((p: string) => p in store),
    readFileSync: vi.fn((p: string) => {
      if (!(p in store)) throw new Error("ENOENT");
      return store[p]!;
    }),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn((p: string, data: string) => {
      store[p] = data;
    }),
    __setFile: (p: string, data: string) => {
      store[p] = data;
    },
    __reset: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
    __getFile: (p: string) => store[p],
  };
  return { MOCK_HOME, CONFIG_PATH, mockFs };
});

vi.mock("node:fs", () => mockFs);
vi.mock("node:os", () => ({ homedir: () => MOCK_HOME }));
vi.mock("./atomic.js", () => ({
  atomicWriteSync: (path: string, content: string) => {
    mockFs.writeFileSync(path, content);
  },
}));
vi.mock("./ui.js", () => ({
  ui: {
    warn: (s: string) => s,
    bold: (s: string) => s,
    dim: (s: string) => s,
  },
}));

beforeEach(async () => {
  vi.clearAllMocks();
  mockFs.__reset();
  const { clearConfigCache } = await import("./config.js");
  clearConfigCache();
  delete process.env.ARCANA_INSTALL_DIR;
  delete process.env.ARCANA_DEFAULT_PROVIDER;
});

import { loadConfig, saveConfig, addProvider, removeProvider, validateConfig, clearConfigCache } from "./config.js";

describe("loadConfig", () => {
  it("returns defaults when no config file", () => {
    const config = loadConfig();
    expect(config.defaultProvider).toBe("arcana");
    expect(config.installDir).toContain(".agents");
    expect(config.providers.length).toBeGreaterThan(0);
  });

  it("loads from config file when present", () => {
    const customConfig = {
      defaultProvider: "custom/repo",
      installDir: join(MOCK_HOME, "custom-skills"),
      providers: [{ name: "custom", type: "github", url: "custom/repo", enabled: true }],
    };
    mockFs.__setFile(CONFIG_PATH, JSON.stringify(customConfig));

    const config = loadConfig();
    expect(config.defaultProvider).toBe("custom/repo");
    expect(config.installDir).toBe(join(MOCK_HOME, "custom-skills"));
    expect(config.providers[0]!.name).toBe("custom");
  });

  it("falls back to defaults on corrupted file", () => {
    mockFs.__setFile(CONFIG_PATH, "{{not json");

    const config = loadConfig();
    expect(config.defaultProvider).toBe("arcana");
  });

  it("uses default providers when config has no providers", () => {
    mockFs.__setFile(CONFIG_PATH, JSON.stringify({ defaultProvider: "arcana" }));

    const config = loadConfig();
    expect(config.providers.length).toBeGreaterThan(0);
    expect(config.providers[0]!.name).toBe("arcana");
  });

  it("applies ARCANA_INSTALL_DIR env override", () => {
    const absPath = join(MOCK_HOME, "env-skills");
    process.env.ARCANA_INSTALL_DIR = absPath;

    const config = loadConfig();
    expect(config.installDir).toBe(absPath);
  });

  it("ignores relative ARCANA_INSTALL_DIR", () => {
    process.env.ARCANA_INSTALL_DIR = "relative/path";

    const config = loadConfig();
    expect(config.installDir).not.toBe("relative/path");
  });

  it("applies ARCANA_DEFAULT_PROVIDER env override with valid slug", () => {
    process.env.ARCANA_DEFAULT_PROVIDER = "other/repo";

    const config = loadConfig();
    expect(config.defaultProvider).toBe("other/repo");
  });

  it("ignores empty ARCANA_DEFAULT_PROVIDER", () => {
    process.env.ARCANA_DEFAULT_PROVIDER = "  ";

    const config = loadConfig();
    expect(config.defaultProvider).toBe("arcana");
  });

  it("ignores invalid ARCANA_DEFAULT_PROVIDER", () => {
    process.env.ARCANA_DEFAULT_PROVIDER = ";;;invalid";

    const config = loadConfig();
    expect(config.defaultProvider).toBe("arcana");
  });

  it("accepts ARCANA_DEFAULT_PROVIDER matching a configured provider name", () => {
    process.env.ARCANA_DEFAULT_PROVIDER = "arcana";

    const config = loadConfig();
    expect(config.defaultProvider).toBe("arcana");
  });
});

describe("saveConfig", () => {
  it("writes config to file", () => {
    const config = {
      defaultProvider: "arcana",
      installDir: join(MOCK_HOME, ".agents", "skills"),
      providers: [{ name: "arcana", type: "github", url: "medy-gribkov/arcana", enabled: true }],
    };

    saveConfig(config);

    const written = mockFs.__getFile(CONFIG_PATH);
    expect(written).toBeDefined();
    const parsed = JSON.parse(written!);
    expect(parsed.defaultProvider).toBe("arcana");
  });

  it("creates directory if missing", () => {
    saveConfig({
      defaultProvider: "arcana",
      installDir: join(MOCK_HOME, ".agents", "skills"),
      providers: [],
    });

    expect(mockFs.mkdirSync).toHaveBeenCalled();
  });
});

describe("addProvider", () => {
  it("adds new provider", () => {
    addProvider({ name: "custom", type: "github", url: "owner/repo", enabled: true });

    const written = mockFs.__getFile(CONFIG_PATH);
    const parsed = JSON.parse(written!);
    expect(parsed.providers.some((p: { name: string }) => p.name === "custom")).toBe(true);
  });

  it("updates existing provider", () => {
    const configWithProvider = {
      defaultProvider: "arcana",
      installDir: join(MOCK_HOME, ".agents", "skills"),
      providers: [{ name: "arcana", type: "github", url: "old/url", enabled: true }],
    };
    mockFs.__setFile(CONFIG_PATH, JSON.stringify(configWithProvider));

    addProvider({ name: "arcana", type: "github", url: "new/url", enabled: false });

    const written = mockFs.__getFile(CONFIG_PATH);
    const parsed = JSON.parse(written!);
    const arcana = parsed.providers.find((p: { name: string }) => p.name === "arcana");
    expect(arcana.url).toBe("new/url");
    expect(arcana.enabled).toBe(false);
  });
});

describe("removeProvider", () => {
  it("removes existing provider and returns true", () => {
    const configWithProviders = {
      defaultProvider: "arcana",
      installDir: join(MOCK_HOME, ".agents", "skills"),
      providers: [
        { name: "arcana", type: "github", url: "medy-gribkov/arcana", enabled: true },
        { name: "custom", type: "github", url: "owner/repo", enabled: true },
      ],
    };
    mockFs.__setFile(CONFIG_PATH, JSON.stringify(configWithProviders));

    expect(removeProvider("custom")).toBe(true);

    const written = mockFs.__getFile(CONFIG_PATH);
    const parsed = JSON.parse(written!);
    expect(parsed.providers.some((p: { name: string }) => p.name === "custom")).toBe(false);
  });

  it("returns false for nonexistent provider", () => {
    expect(removeProvider("nonexistent")).toBe(false);
  });
});

describe("validateConfig", () => {
  it("returns no warnings for valid default config", () => {
    const config = loadConfig();
    const warnings = validateConfig(config);
    expect(warnings).toEqual([]);
  });

  it("warns on invalid provider URL", () => {
    const warnings = validateConfig({
      defaultProvider: "bad",
      installDir: "/tmp/test-home/.agents/skills",
      providers: [{ name: "bad", type: "github", url: "not-a-slug", enabled: true }],
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("invalid URL");
  });

  it("warns on relative installDir", () => {
    const warnings = validateConfig({
      defaultProvider: "arcana",
      installDir: "relative/path",
      providers: [{ name: "arcana", type: "github", url: "owner/repo", enabled: true }],
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("not an absolute path");
  });

  it("warns on invalid defaultProvider", () => {
    const warnings = validateConfig({
      defaultProvider: ";;;DROP TABLE",
      installDir: "/tmp/test/.agents/skills",
      providers: [{ name: "arcana", type: "github", url: "owner/repo", enabled: true }],
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("defaultProvider");
  });

  it("accepts defaultProvider matching a configured provider name", () => {
    const warnings = validateConfig({
      defaultProvider: "arcana",
      installDir: "/tmp/.agents/skills",
      providers: [{ name: "arcana", type: "github", url: "owner/repo", enabled: true }],
    });
    expect(warnings).toEqual([]);
  });

  it("accepts defaultProvider as valid slug", () => {
    const warnings = validateConfig({
      defaultProvider: "some-user/some-repo",
      installDir: "/tmp/.agents/skills",
      providers: [],
    });
    expect(warnings).toEqual([]);
  });
});
