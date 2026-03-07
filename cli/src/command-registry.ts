export interface CommandEntry {
  name: string;
  usage: string;
  description: string;
  group: string;
}

const COMMANDS: CommandEntry[] = [
  // Getting Started
  { name: "init", usage: "init", description: "Initialize arcana in current project", group: "GETTING STARTED" },
  { name: "doctor", usage: "doctor", description: "Check environment and diagnose issues", group: "GETTING STARTED" },

  // Skills
  { name: "list", usage: "list", description: "List available skills", group: "SKILLS" },
  { name: "search", usage: "search <query>", description: "Search across providers", group: "SKILLS" },
  { name: "info", usage: "info <skill>", description: "Show skill details", group: "SKILLS" },
  { name: "install", usage: "install [skills...]", description: "Install one or more skills", group: "SKILLS" },
  { name: "update", usage: "update [skills...]", description: "Update installed skills", group: "SKILLS" },
  { name: "uninstall", usage: "uninstall [skills...]", description: "Remove one or more skills", group: "SKILLS" },
  { name: "recommend", usage: "recommend", description: "Smart skill recommendations", group: "SKILLS" },

  // Development
  { name: "create", usage: "create <name>", description: "Create a new skill from template", group: "DEVELOPMENT" },
  { name: "validate", usage: "validate [skill]", description: "Validate skill structure", group: "DEVELOPMENT" },
  { name: "audit", usage: "audit [skill]", description: "Audit skill quality", group: "DEVELOPMENT" },

  // Security
  { name: "scan", usage: "scan [skill]", description: "Scan skills for security threats", group: "SECURITY" },
  { name: "verify", usage: "verify [skill]", description: "Verify skill integrity", group: "SECURITY" },
  { name: "lock", usage: "lock", description: "Generate or validate lockfile", group: "SECURITY" },

  // Inspection
  { name: "benchmark", usage: "benchmark [skill]", description: "Measure token cost", group: "INSPECTION" },
  { name: "diff", usage: "diff <skill>", description: "Show installed vs remote changes", group: "INSPECTION" },
  { name: "outdated", usage: "outdated", description: "List skills with newer versions", group: "INSPECTION" },

  // Configuration
  {
    name: "config",
    usage: "config [key] [val]",
    description: "View or modify configuration",
    group: "CONFIGURATION",
  },
  { name: "providers", usage: "providers", description: "Manage skill providers", group: "CONFIGURATION" },
  { name: "clean", usage: "clean", description: "Remove orphaned data", group: "CONFIGURATION" },
  { name: "compact", usage: "compact", description: "Remove agent logs", group: "CONFIGURATION" },
  { name: "stats", usage: "stats", description: "Show session analytics", group: "CONFIGURATION" },
  {
    name: "optimize",
    usage: "optimize",
    description: "Suggest token/performance improvements",
    group: "CONFIGURATION",
  },

  // Context Intelligence
  { name: "curate", usage: "curate", description: "Auto-generate budget-aware _active.md", group: "CONTEXT" },
  { name: "compress", usage: "compress [command...]", description: "Run command with output compression", group: "CONTEXT" },
  { name: "hook", usage: "hook <action>", description: "Manage shell compression hooks", group: "CONTEXT" },
  { name: "remember", usage: "remember [content...]", description: "Save a cross-session memory", group: "CONTEXT" },
  { name: "recall", usage: "recall [query...]", description: "Search saved memories", group: "CONTEXT" },
  { name: "forget", usage: "forget <id>", description: "Remove a saved memory", group: "CONTEXT" },
  { name: "snapshot", usage: "snapshot [name]", description: "Save session state snapshot", group: "CONTEXT" },
  { name: "trim", usage: "trim", description: "Analyze and trim session bloat", group: "CONTEXT" },
  { name: "mcp", usage: "mcp <action> [name]", description: "Manage MCP servers", group: "CONTEXT" },

  // Progressive Disclosure
  { name: "index", usage: "index", description: "Generate skill metadata index", group: "DISCLOSURE" },
  { name: "load", usage: "load [skills...]", description: "Load full skill content on demand", group: "DISCLOSURE" },

  // Team & Workflow
  { name: "profile", usage: "profile [action]", description: "Manage skill profiles", group: "WORKFLOW" },
  { name: "team", usage: "team [action]", description: "Shared team skill config", group: "WORKFLOW" },
  { name: "export", usage: "export", description: "Export installed skills manifest", group: "WORKFLOW" },
  { name: "import", usage: "import <file>", description: "Import skills from manifest", group: "WORKFLOW" },
  { name: "completions", usage: "completions <shell>", description: "Generate shell completions", group: "WORKFLOW" },
];

export function getCommandNames(): string[] {
  return COMMANDS.map((c) => c.name);
}

export function getGroupedCommands(): Record<string, CommandEntry[]> {
  const groups: Record<string, CommandEntry[]> = {};
  for (const cmd of COMMANDS) {
    (groups[cmd.group] ??= []).push(cmd);
  }
  return groups;
}

export function findClosestCommand(input: string): string | undefined {
  const prefix = input.slice(0, 3).toLowerCase();
  return COMMANDS.find((c) => c.name.startsWith(prefix))?.name;
}

export function getCliReference(): string {
  return COMMANDS.map((c) => `arcana ${c.usage}`).join("\n");
}
