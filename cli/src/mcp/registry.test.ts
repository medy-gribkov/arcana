import { describe, it, expect } from "vitest";
import { getServerDef, listRegistry, MCP_REGISTRY } from "./registry.js";

describe("MCP registry", () => {
  it("lists all registered servers", () => {
    const servers = listRegistry();
    expect(servers.length).toBeGreaterThanOrEqual(3);
    expect(servers.map((s) => s.name)).toContain("context7");
    expect(servers.map((s) => s.name)).toContain("filesystem");
    expect(servers.map((s) => s.name)).toContain("memory");
  });

  it("returns a copy, not the original array", () => {
    const servers = listRegistry();
    servers.push({ name: "test", description: "test", command: "test", args: [] });
    expect(MCP_REGISTRY.length).toBeLessThan(servers.length);
  });

  it("finds context7 by name", () => {
    const def = getServerDef("context7");
    expect(def).toBeDefined();
    expect(def!.command).toBe("npx");
    expect(def!.args).toContain("@upstash/context7-mcp");
    expect(def!.envKeys).toContain("CONTEXT7_API_KEY");
  });

  it("finds filesystem by name", () => {
    const def = getServerDef("filesystem");
    expect(def).toBeDefined();
    expect(def!.description).toContain("File system");
  });

  it("finds memory by name", () => {
    const def = getServerDef("memory");
    expect(def).toBeDefined();
  });

  it("returns undefined for unknown server", () => {
    expect(getServerDef("nonexistent")).toBeUndefined();
    expect(getServerDef("")).toBeUndefined();
  });

  it("all servers have required fields", () => {
    for (const server of MCP_REGISTRY) {
      expect(server.name).toBeTruthy();
      expect(server.description).toBeTruthy();
      expect(server.command).toBeTruthy();
      expect(Array.isArray(server.args)).toBe(true);
    }
  });
});
