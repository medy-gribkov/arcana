import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("mcpCommand", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let listRegistryMock: ReturnType<typeof vi.fn>;
  let installMcpServerMock: ReturnType<typeof vi.fn>;
  let removeMcpServerMock: ReturnType<typeof vi.fn>;
  let listConfiguredServersMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    listRegistryMock = vi.fn(() => [
      { name: "context7", description: "Docs server", command: "npx", args: ["-y", "@upstash/context7-mcp"] },
      {
        name: "filesystem",
        description: "File system",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem"],
      },
    ]);

    installMcpServerMock = vi.fn(() => ({ installed: true, path: "/home/.claude.json" }));
    removeMcpServerMock = vi.fn(() => true);
    listConfiguredServersMock = vi.fn(() => ["context7", "filesystem"]);

    vi.doMock("../utils/ui.js", () => ({
      ui: {
        bold: (s: string) => s,
        dim: (s: string) => s,
        success: (s: string) => s,
        warn: (s: string) => s,
        error: (s: string) => s,
      },
      banner: vi.fn(),
    }));

    vi.doMock("../mcp/registry.js", () => ({
      listRegistry: listRegistryMock,
    }));

    vi.doMock("../mcp/install.js", () => ({
      installMcpServer: installMcpServerMock,
      removeMcpServer: removeMcpServerMock,
      listConfiguredServers: listConfiguredServersMock,
    }));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.resetModules();
  });

  // --- list ---

  it("list action returns JSON array of servers", async () => {
    const { mcpCommand } = await import("./mcp.js");
    await mcpCommand("list", undefined, { json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output).toHaveLength(2);
    expect(output[0].name).toBe("context7");
    expect(output[1].name).toBe("filesystem");
  });

  // --- install ---

  it("install action returns JSON result on success", async () => {
    const { mcpCommand } = await import("./mcp.js");
    await mcpCommand("install", "context7", { json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output).toEqual({ installed: true, path: "/home/.claude.json" });
    expect(installMcpServerMock).toHaveBeenCalledWith("context7", "claude", expect.any(String));
  });

  it("install action uses opts.tool when provided", async () => {
    const { mcpCommand } = await import("./mcp.js");
    await mcpCommand("install", "context7", { json: true, tool: "cursor" });

    expect(installMcpServerMock).toHaveBeenCalledWith("context7", "cursor", expect.any(String));
  });

  it("install action exits 1 when name is missing", async () => {
    const { mcpCommand } = await import("./mcp.js");
    await mcpCommand("install", undefined, { json: true });

    expect(consoleErrorSpy).toHaveBeenCalledWith("Usage: arcana mcp install <name>");
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  // --- remove ---

  it("remove action returns JSON result on success", async () => {
    const { mcpCommand } = await import("./mcp.js");
    await mcpCommand("remove", "context7", { json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output).toEqual({ removed: true, name: "context7" });
    expect(removeMcpServerMock).toHaveBeenCalledWith("context7", "claude", expect.any(String));
  });

  it("remove action returns removed=false when server not found", async () => {
    removeMcpServerMock.mockReturnValue(false);

    const { mcpCommand } = await import("./mcp.js");
    await mcpCommand("remove", "nonexistent", { json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output).toEqual({ removed: false, name: "nonexistent" });
  });

  it("remove action uses opts.tool when provided", async () => {
    const { mcpCommand } = await import("./mcp.js");
    await mcpCommand("remove", "context7", { json: true, tool: "cursor" });

    expect(removeMcpServerMock).toHaveBeenCalledWith("context7", "cursor", expect.any(String));
  });

  it("remove action exits 1 when name is missing", async () => {
    const { mcpCommand } = await import("./mcp.js");
    await mcpCommand("remove", undefined, { json: true });

    expect(consoleErrorSpy).toHaveBeenCalledWith("Usage: arcana mcp remove <name>");
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  // --- status ---

  it("status action returns JSON with tool and servers", async () => {
    const { mcpCommand } = await import("./mcp.js");
    await mcpCommand("status", undefined, { json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output).toEqual({ tool: "claude", servers: ["context7", "filesystem"] });
    expect(listConfiguredServersMock).toHaveBeenCalledWith("claude", expect.any(String));
  });

  it("status action uses opts.tool when provided", async () => {
    const { mcpCommand } = await import("./mcp.js");
    await mcpCommand("status", undefined, { json: true, tool: "cursor" });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.tool).toBe("cursor");
    expect(listConfiguredServersMock).toHaveBeenCalledWith("cursor", expect.any(String));
  });

  // --- unknown action ---

  it("unknown action prints usage and exits 1", async () => {
    const { mcpCommand } = await import("./mcp.js");
    await mcpCommand("unknown-action", undefined, { json: true });

    expect(consoleErrorSpy).toHaveBeenCalledWith("Usage: arcana mcp <list|install|remove|status> [name]");
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
