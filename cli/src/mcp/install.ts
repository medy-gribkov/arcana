import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { atomicWriteSync } from "../utils/atomic.js";
import { getServerDef, type McpServerDef } from "./registry.js";

interface McpConfig {
  mcpServers: Record<string, { command: string; args: string[]; env?: Record<string, string> }>;
}

/** Get the path to Claude Code's MCP config file. */
function getClaudeMcpPath(): string {
  return join(homedir(), ".claude.json");
}

/** Get the path to Cursor's MCP config file. */
function getCursorMcpPath(cwd: string): string {
  return join(cwd, ".cursor", "mcp.json");
}

/** Read existing MCP config from a JSON file. */
function readMcpConfig(filePath: string): McpConfig {
  if (!existsSync(filePath)) return { mcpServers: {} };
  try {
    const data = JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
    return {
      mcpServers: (data.mcpServers as McpConfig["mcpServers"]) ?? {},
    };
  } catch {
    return { mcpServers: {} };
  }
}

/** Write MCP server config to a tool's config file. */
function writeMcpServer(
  filePath: string,
  name: string,
  def: McpServerDef,
): void {
  // Read existing config, preserving all other keys
  let fullConfig: Record<string, unknown> = {};
  if (existsSync(filePath)) {
    try {
      fullConfig = JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
    } catch {
      fullConfig = {};
    }
  }

  if (!fullConfig.mcpServers) fullConfig.mcpServers = {};
  const servers = fullConfig.mcpServers as Record<string, unknown>;

  const entry: Record<string, unknown> = {
    command: def.command,
    args: def.args,
  };

  // Add env placeholders for keys that need configuration
  if (def.envKeys && def.envKeys.length > 0) {
    const env: Record<string, string> = {};
    for (const key of def.envKeys) {
      env[key] = process.env[key] ?? `<your-${key.toLowerCase().replace(/_/g, "-")}>`;
    }
    entry.env = env;
  }

  servers[name] = entry;

  const dir = join(filePath, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  atomicWriteSync(filePath, JSON.stringify(fullConfig, null, 2));
}

/** Install an MCP server into the appropriate tool config. */
export function installMcpServer(
  name: string,
  tool: "claude" | "cursor",
  cwd: string,
): { installed: boolean; path: string; error?: string } {
  const def = getServerDef(name);
  if (!def) {
    return { installed: false, path: "", error: `Unknown MCP server: ${name}. Use 'arcana mcp list' to see available servers.` };
  }

  const filePath = tool === "claude" ? getClaudeMcpPath() : getCursorMcpPath(cwd);

  // Check if already installed
  const existing = readMcpConfig(filePath);
  if (existing.mcpServers[name]) {
    return { installed: true, path: filePath, error: `${name} already configured in ${filePath}` };
  }

  try {
    writeMcpServer(filePath, name, def);
    return { installed: true, path: filePath };
  } catch (err) {
    return { installed: false, path: filePath, error: err instanceof Error ? err.message : "Write failed" };
  }
}

/** List MCP servers configured in a tool's config. */
export function listConfiguredServers(tool: "claude" | "cursor", cwd: string): string[] {
  const filePath = tool === "claude" ? getClaudeMcpPath() : getCursorMcpPath(cwd);
  const config = readMcpConfig(filePath);
  return Object.keys(config.mcpServers);
}

/** Remove an MCP server from tool config. */
export function removeMcpServer(
  name: string,
  tool: "claude" | "cursor",
  cwd: string,
): boolean {
  const filePath = tool === "claude" ? getClaudeMcpPath() : getCursorMcpPath(cwd);

  let fullConfig: Record<string, unknown> = {};
  if (!existsSync(filePath)) return false;
  try {
    fullConfig = JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
  } catch {
    return false;
  }

  const servers = fullConfig.mcpServers as Record<string, unknown> | undefined;
  if (!servers || !servers[name]) return false;

  delete servers[name];
  atomicWriteSync(filePath, JSON.stringify(fullConfig, null, 2));
  return true;
}
