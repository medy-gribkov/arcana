import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "node:path";
import { installMcpServer, listConfiguredServers, removeMcpServer } from "./install.js";

vi.mock("node:fs", async () => {
  let store: Record<string, string> = {};
  return {
    existsSync: (p: string) => p in store,
    readFileSync: (p: string) => {
      if (!(p in store)) throw new Error("ENOENT");
      return store[p];
    },
    mkdirSync: () => {},
    writeFileSync: (p: string, data: string) => {
      store[p] = data;
    },
    __reset: () => {
      store = {};
    },
    __setFile: (p: string, data: string) => {
      store[p] = data;
    },
    __getFile: (p: string) => store[p],
  };
});

vi.mock("../utils/atomic.js", async () => {
  const fs = await import("node:fs");
  return {
    atomicWriteSync: (path: string, content: string) => {
      (fs as unknown as { writeFileSync: (p: string, d: string) => void }).writeFileSync(path, content);
    },
  };
});

const MOCK_HOME = "/mock-home";
vi.mock("node:os", () => ({
  homedir: () => MOCK_HOME,
}));

// Paths the source constructs via path.join
const CLAUDE_CONFIG = join(MOCK_HOME, ".claude.json");
const cursorConfig = (cwd: string) => join(cwd, ".cursor", "mcp.json");

type MockFs = {
  __reset: () => void;
  __setFile: (p: string, d: string) => void;
  __getFile: (p: string) => string;
};

beforeEach(async () => {
  const fs = (await import("node:fs")) as unknown as MockFs;
  fs.__reset();
});

describe("installMcpServer", () => {
  it("returns error for unknown server", () => {
    const result = installMcpServer("nonexistent", "claude", "/project");
    expect(result.installed).toBe(false);
    expect(result.error).toContain("Unknown MCP server");
  });

  it("installs context7 to claude config", async () => {
    const fs = (await import("node:fs")) as unknown as MockFs;

    const result = installMcpServer("context7", "claude", "/project");
    expect(result.installed).toBe(true);
    expect(result.path).toBe(CLAUDE_CONFIG);

    const content = fs.__getFile(CLAUDE_CONFIG);
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers.context7).toBeDefined();
    expect(parsed.mcpServers.context7.command).toBe("npx");
    expect(parsed.mcpServers.context7.args).toContain("@upstash/context7-mcp");
  });

  it("installs to cursor config path", async () => {
    const fs = (await import("node:fs")) as unknown as MockFs;
    const cwd = "/my-project";
    const expectedPath = cursorConfig(cwd);

    // Cursor config needs the parent dir to "exist" for the dir check
    const parentDir = join(cwd, ".cursor");
    fs.__setFile(parentDir, ""); // ensure parent exists

    const result = installMcpServer("filesystem", "cursor", cwd);
    expect(result.installed).toBe(true);
    expect(result.path).toBe(expectedPath);

    const content = fs.__getFile(expectedPath);
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers.filesystem).toBeDefined();
  });

  it("reports already installed", async () => {
    const fs = (await import("node:fs")) as unknown as MockFs;
    const existing = { mcpServers: { context7: { command: "npx", args: [] } } };
    fs.__setFile(CLAUDE_CONFIG, JSON.stringify(existing));

    const result = installMcpServer("context7", "claude", "/project");
    expect(result.installed).toBe(true);
    expect(result.error).toContain("already configured");
  });

  it("adds env placeholders for servers with envKeys", async () => {
    const fs = (await import("node:fs")) as unknown as MockFs;

    installMcpServer("context7", "claude", "/project");
    const content = fs.__getFile(CLAUDE_CONFIG);
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers.context7.env).toBeDefined();
    expect(parsed.mcpServers.context7.env.CONTEXT7_API_KEY).toBeDefined();
  });

  it("preserves existing config keys", async () => {
    const fs = (await import("node:fs")) as unknown as MockFs;
    const existing = { someOtherKey: "value", mcpServers: {} };
    fs.__setFile(CLAUDE_CONFIG, JSON.stringify(existing));

    installMcpServer("filesystem", "claude", "/project");
    const content = fs.__getFile(CLAUDE_CONFIG);
    const parsed = JSON.parse(content);
    expect(parsed.someOtherKey).toBe("value");
    expect(parsed.mcpServers.filesystem).toBeDefined();
  });
});

describe("listConfiguredServers", () => {
  it("returns empty array when no config file", () => {
    const result = listConfiguredServers("claude", "/project");
    expect(result).toEqual([]);
  });

  it("lists configured servers", async () => {
    const fs = (await import("node:fs")) as unknown as MockFs;
    const config = { mcpServers: { context7: {}, filesystem: {} } };
    fs.__setFile(CLAUDE_CONFIG, JSON.stringify(config));

    const result = listConfiguredServers("claude", "/project");
    expect(result).toContain("context7");
    expect(result).toContain("filesystem");
    expect(result.length).toBe(2);
  });

  it("handles malformed JSON gracefully", async () => {
    const fs = (await import("node:fs")) as unknown as MockFs;
    fs.__setFile(CLAUDE_CONFIG, "not json{{{");

    const result = listConfiguredServers("claude", "/project");
    expect(result).toEqual([]);
  });
});

describe("removeMcpServer", () => {
  it("returns false when config file missing", () => {
    expect(removeMcpServer("context7", "claude", "/project")).toBe(false);
  });

  it("returns false when server not configured", async () => {
    const fs = (await import("node:fs")) as unknown as MockFs;
    const config = { mcpServers: { filesystem: {} } };
    fs.__setFile(CLAUDE_CONFIG, JSON.stringify(config));

    expect(removeMcpServer("context7", "claude", "/project")).toBe(false);
  });

  it("removes existing server", async () => {
    const fs = (await import("node:fs")) as unknown as MockFs;
    const config = { mcpServers: { context7: { command: "npx" }, filesystem: { command: "npx" } } };
    fs.__setFile(CLAUDE_CONFIG, JSON.stringify(config));

    expect(removeMcpServer("context7", "claude", "/project")).toBe(true);

    const content = fs.__getFile(CLAUDE_CONFIG);
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers.context7).toBeUndefined();
    expect(parsed.mcpServers.filesystem).toBeDefined();
  });

  it("handles malformed JSON gracefully", async () => {
    const fs = (await import("node:fs")) as unknown as MockFs;
    fs.__setFile(CLAUDE_CONFIG, "broken json");

    expect(removeMcpServer("context7", "claude", "/project")).toBe(false);
  });
});
