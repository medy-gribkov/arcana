/** Built-in registry of recommended MCP servers. */
export interface McpServerDef {
  name: string;
  description: string;
  command: string;
  args: string[];
  envKeys?: string[];
}

export const MCP_REGISTRY: McpServerDef[] = [
  {
    name: "context7",
    description: "Live version-specific documentation from source repos (Upstash)",
    command: "npx",
    args: ["-y", "@upstash/context7-mcp"],
    envKeys: ["CONTEXT7_API_KEY"],
  },
  {
    name: "filesystem",
    description: "File system operations for AI agents (Anthropic)",
    command: "npx",
    args: ["-y", "@anthropic/mcp-filesystem"],
  },
  {
    name: "memory",
    description: "Persistent key-value memory for agents (Anthropic)",
    command: "npx",
    args: ["-y", "@anthropic/mcp-memory"],
  },
];

export function getServerDef(name: string): McpServerDef | undefined {
  return MCP_REGISTRY.find((s) => s.name === name);
}

export function listRegistry(): McpServerDef[] {
  return [...MCP_REGISTRY];
}
