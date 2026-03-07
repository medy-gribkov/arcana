export interface CommandOption {
  flags: string;
  description: string;
  parseAs?: "int";
}

export interface CommandDef {
  /** Commander command string, e.g. "install [skills...]" or "info <skill>" */
  command: string;
  description: string;
  group: string;
  options?: CommandOption[];
  helpText?: string;
  /** Module path for lazy import (relative to src/) */
  module: string;
  /** Export name of the handler function */
  handler: string;
  allowUnknownOption?: boolean;
}

export const COMMANDS: CommandDef[] = [
  // ── Getting Started ─────────────────────────────────────────
  {
    command: "init",
    description: "Initialize arcana in current project",
    group: "GETTING STARTED",
    options: [
      {
        flags: "-t, --tool <name>",
        description: "Target tool (claude, cursor, codex, gemini, antigravity, windsurf, aider, all)",
      },
    ],
    module: "./commands/init.js",
    handler: "initCommand",
  },
  {
    command: "doctor",
    description: "Check environment and diagnose issues",
    group: "GETTING STARTED",
    options: [
      { flags: "-f, --fix", description: "Auto-fix issues where possible" },
      { flags: "-j, --json", description: "Output as JSON" },
    ],
    module: "./commands/doctor.js",
    handler: "doctorCommand",
  },

  // ── Skills ──────────────────────────────────────────────────
  {
    command: "list",
    description: "List available skills",
    group: "SKILLS",
    options: [
      { flags: "-p, --provider <name>", description: "Provider to list from" },
      { flags: "-a, --all", description: "List from all providers" },
      { flags: "--installed", description: "Show only installed skills" },
      { flags: "--no-cache", description: "Bypass skill cache" },
      { flags: "-j, --json", description: "Output as JSON" },
    ],
    helpText: "\nExamples:\n  arcana list\n  arcana list --installed\n  arcana list --all --no-cache",
    module: "./commands/list.js",
    handler: "listCommand",
  },
  {
    command: "search <query>",
    description: "Search for skills across providers",
    group: "SKILLS",
    options: [
      { flags: "-p, --provider <name>", description: "Limit search to provider" },
      { flags: "--no-cache", description: "Bypass skill cache" },
      { flags: "-t, --tag <tag>", description: "Filter by tech stack tag" },
      { flags: "-s, --smart", description: "Context-aware ranking (uses project detection)" },
      { flags: "-j, --json", description: "Output as JSON" },
    ],
    helpText:
      '\nExamples:\n  arcana search testing\n  arcana search "code review"\n  arcana search react --tag typescript\n  arcana search api --smart',
    module: "./commands/search.js",
    handler: "searchCommand",
  },
  {
    command: "info <skill>",
    description: "Show skill details",
    group: "SKILLS",
    options: [
      { flags: "-p, --provider <name>", description: "Provider to search" },
      { flags: "-j, --json", description: "Output as JSON" },
    ],
    module: "./commands/info.js",
    handler: "infoCommand",
  },
  {
    command: "install [skills...]",
    description: "Install one or more skills",
    group: "SKILLS",
    options: [
      { flags: "-p, --provider <name>", description: "Provider to install from" },
      { flags: "-a, --all", description: "Install all skills" },
      { flags: "-f, --force", description: "Reinstall even if already installed" },
      { flags: "--dry-run", description: "Show what would be installed without installing" },
      { flags: "-j, --json", description: "Output as JSON" },
      { flags: "--no-check", description: "Skip conflict detection" },
    ],
    helpText:
      "\nExamples:\n  arcana install code-reviewer\n  arcana install skill1 skill2 skill3\n  arcana install --all --force",
    module: "./commands/install.js",
    handler: "installCommand",
  },
  {
    command: "update [skills...]",
    description: "Update installed skills",
    group: "SKILLS",
    options: [
      { flags: "-a, --all", description: "Update all installed skills" },
      { flags: "-p, --provider <name>", description: "Update from specific provider" },
      { flags: "-n, --dry-run", description: "Show what would be updated without updating" },
      { flags: "-j, --json", description: "Output as JSON" },
    ],
    helpText:
      "\nExamples:\n  arcana update code-reviewer\n  arcana update skill1 skill2\n  arcana update --all --dry-run",
    module: "./commands/update.js",
    handler: "updateCommand",
  },
  {
    command: "uninstall [skills...]",
    description: "Uninstall one or more skills",
    group: "SKILLS",
    options: [
      { flags: "-y, --yes", description: "Skip confirmation prompt" },
      { flags: "-j, --json", description: "Output as JSON" },
    ],
    helpText: "\nExamples:\n  arcana uninstall code-reviewer\n  arcana uninstall skill1 skill2 --yes",
    module: "./commands/uninstall.js",
    handler: "uninstallCommand",
  },
  {
    command: "recommend",
    description: "Get smart skill recommendations for current project",
    group: "SKILLS",
    options: [
      { flags: "-j, --json", description: "Output as JSON" },
      { flags: "-l, --limit <n>", description: "Max results per category", parseAs: "int" },
      { flags: "-p, --provider <name>", description: "Limit to provider" },
    ],
    helpText: "\nExamples:\n  arcana recommend\n  arcana recommend --json\n  arcana recommend --limit 5",
    module: "./commands/recommend.js",
    handler: "recommendCommand",
  },

  // ── Context Intelligence ────────────────────────────────────
  {
    command: "curate",
    description: "Auto-generate _active.md with budget-aware, project-relevant skills",
    group: "CONTEXT",
    options: [
      { flags: "-b, --budget <pct>", description: "Max % of context window for skills (default: 30)", parseAs: "int" },
      { flags: "-m, --model <name>", description: "Target model for context budget (e.g. claude-opus-4.6, gpt-5.4)" },
      { flags: "-i, --include <skills...>", description: "Force-include specific skills" },
      { flags: "-j, --json", description: "Output as JSON" },
    ],
    helpText:
      "\nExamples:\n  arcana curate\n  arcana curate --model gpt-5.4 --budget 40\n  arcana curate --include golang-pro typescript",
    module: "./commands/curate.js",
    handler: "curateCommand",
  },
  {
    command: "compress [command...]",
    description: "Run a command with output compression (saves tokens)",
    group: "CONTEXT",
    options: [
      { flags: "--stdin", description: "Read from stdin instead of running a command" },
      { flags: "-t, --tool <name>", description: "Tool type hint for compression rules (git, npm, tsc, vitest)" },
      { flags: "-j, --json", description: "Output stats as JSON" },
    ],
    allowUnknownOption: true,
    module: "./commands/compress.js",
    handler: "compressCommand",
  },
  {
    command: "remember [content...]",
    description: "Save a fact or preference for cross-session persistence",
    group: "CONTEXT",
    options: [
      { flags: "-t, --tag <tags...>", description: "Tags for the memory" },
      { flags: "-j, --json", description: "Output as JSON" },
    ],
    helpText: '\nExamples:\n  arcana remember "always use pnpm"\n  arcana remember "use vitest" --tag testing',
    module: "./commands/remember.js",
    handler: "rememberCommand",
  },
  {
    command: "recall [query...]",
    description: "Search saved memories",
    group: "CONTEXT",
    options: [
      { flags: "-a, --all", description: "List all memories" },
      { flags: "-p, --project <name>", description: "Filter by project" },
      { flags: "-j, --json", description: "Output as JSON" },
    ],
    helpText: '\nExamples:\n  arcana recall "package manager"\n  arcana recall --all\n  arcana recall --project arcana',
    module: "./commands/remember.js",
    handler: "recallCommand",
  },
  {
    command: "forget <id>",
    description: "Remove a saved memory by ID",
    group: "CONTEXT",
    options: [{ flags: "-j, --json", description: "Output as JSON" }],
    module: "./commands/remember.js",
    handler: "forgetCommand",
  },
  {
    command: "mcp <action> [name]",
    description: "Manage MCP servers (list, install, remove, status)",
    group: "CONTEXT",
    options: [
      { flags: "-t, --tool <name>", description: "Target tool: claude or cursor (default: claude)" },
      { flags: "-j, --json", description: "Output as JSON" },
    ],
    helpText:
      "\nActions:\n  list              Show available MCP servers\n  install <name>    Install an MCP server\n  remove <name>     Remove an MCP server\n  status            Show configured MCP servers\n\nExamples:\n  arcana mcp list\n  arcana mcp install context7\n  arcana mcp status",
    module: "./commands/mcp.js",
    handler: "mcpCommand",
  },

  // ── Development ─────────────────────────────────────────────
  {
    command: "create <name>",
    description: "Create a new skill from template",
    group: "DEVELOPMENT",
    module: "./commands/create.js",
    handler: "createCommand",
  },
  {
    command: "validate [skill]",
    description: "Validate skill structure and metadata",
    group: "DEVELOPMENT",
    options: [
      { flags: "-a, --all", description: "Validate all installed skills" },
      { flags: "-f, --fix", description: "Auto-fix common issues" },
      { flags: "-j, --json", description: "Output as JSON" },
      { flags: "--source <dir>", description: "Validate from source directory instead of install dir" },
      { flags: "--cross", description: "Run cross-validation (marketplace sync, companions, orphans)" },
      {
        flags: "--min-score <n>",
        description: "Minimum quality score (0-100), fail if any skill scores below",
        parseAs: "int",
      },
    ],
    module: "./commands/validate.js",
    handler: "validateCommand",
  },
  {
    command: "audit [skill]",
    description: "Audit skill quality (code examples, BAD/GOOD pairs, structure)",
    group: "DEVELOPMENT",
    options: [
      { flags: "-a, --all", description: "Audit all installed skills" },
      { flags: "-j, --json", description: "Output as JSON" },
      { flags: "--source <dir>", description: "Audit from source directory instead of install dir" },
    ],
    module: "./commands/audit.js",
    handler: "auditCommand",
  },

  // ── Security ────────────────────────────────────────────────
  {
    command: "scan [skill]",
    description: "Scan skills for security threats (prompt injection, malware, credential theft)",
    group: "SECURITY",
    options: [
      { flags: "-a, --all", description: "Scan all installed skills" },
      { flags: "--strict", description: "Scan all lines including BAD/DON'T examples (no scope filtering)" },
      { flags: "-v, --verbose", description: "Show suppressed findings from BAD/DON'T blocks" },
      { flags: "-j, --json", description: "Output as JSON" },
    ],
    helpText:
      "\nExamples:\n  arcana scan code-reviewer\n  arcana scan --all\n  arcana scan --all --strict\n  arcana scan --all --json",
    module: "./commands/scan.js",
    handler: "scanCommand",
  },
  {
    command: "verify [skill]",
    description: "Verify installed skill integrity against lockfile",
    group: "SECURITY",
    options: [
      { flags: "-a, --all", description: "Verify all installed skills" },
      { flags: "-j, --json", description: "Output as JSON" },
    ],
    helpText: "\nExamples:\n  arcana verify code-reviewer\n  arcana verify --all\n  arcana verify --all --json",
    module: "./commands/verify.js",
    handler: "verifyCommand",
  },
  {
    command: "lock",
    description: "Generate or validate lockfile from installed skills",
    group: "SECURITY",
    options: [
      { flags: "--ci", description: "Validate lockfile matches installed skills (CI mode)" },
      { flags: "-j, --json", description: "Output as JSON" },
    ],
    helpText: "\nExamples:\n  arcana lock\n  arcana lock --ci\n  arcana lock --json",
    module: "./commands/lock.js",
    handler: "lockCommand",
  },

  // ── Inspection ──────────────────────────────────────────────
  {
    command: "diff <skill>",
    description: "Show changes between installed and remote skill version",
    group: "INSPECTION",
    options: [
      { flags: "-p, --provider <name>", description: "Provider to compare against" },
      { flags: "-j, --json", description: "Output as JSON" },
    ],
    helpText: "\nExamples:\n  arcana diff code-reviewer\n  arcana diff code-reviewer --json",
    module: "./commands/diff.js",
    handler: "diffCommand",
  },
  {
    command: "outdated",
    description: "List skills with newer versions available",
    group: "INSPECTION",
    options: [
      { flags: "-p, --provider <name>", description: "Check against specific provider" },
      { flags: "-j, --json", description: "Output as JSON" },
    ],
    module: "./commands/outdated.js",
    handler: "outdatedCommand",
  },

  // ── Configuration ───────────────────────────────────────────
  {
    command: "config [action] [value]",
    description: "View or modify arcana configuration",
    group: "CONFIGURATION",
    options: [{ flags: "-j, --json", description: "Output as JSON" }],
    helpText:
      "\nExamples:\n  arcana config\n  arcana config path\n  arcana config defaultProvider arcana\n  arcana config reset",
    module: "./commands/config.js",
    handler: "configCommand",
  },
  {
    command: "providers",
    description: "Manage skill providers",
    group: "CONFIGURATION",
    options: [
      { flags: "--add <owner/repo>", description: "Add a GitHub provider" },
      { flags: "--remove <name>", description: "Remove a provider" },
      { flags: "--json", description: "Output as JSON" },
    ],
    module: "./commands/providers.js",
    handler: "providersCommand",
  },
  {
    command: "clean",
    description: "Remove orphaned data, session bloat, and trim sessions",
    group: "CONFIGURATION",
    options: [
      { flags: "-n, --dry-run", description: "Show what would be removed without deleting" },
      { flags: "--aggressive", description: "Delete all session logs regardless of age" },
      {
        flags: "--keep-days <days>",
        description: "Keep main session logs newer than N days (default: 30)",
        parseAs: "int",
      },
      { flags: "--trim", description: "Trim bloat from the latest session (large tool results, base64)" },
      { flags: "--json", description: "Output as JSON" },
    ],
    module: "./commands/clean.js",
    handler: "cleanCommand",
  },

  // ── Portability ─────────────────────────────────────────────
  {
    command: "export",
    description: "Export installed skills as a manifest",
    group: "WORKFLOW",
    options: [
      { flags: "--sbom", description: "Export as SPDX-lite software bill of materials" },
      { flags: "-j, --json", description: "Output as JSON (default)" },
    ],
    module: "./commands/export-cmd.js",
    handler: "exportCommand",
  },
  {
    command: "import <file>",
    description: "Import and install skills from a manifest file",
    group: "WORKFLOW",
    options: [
      { flags: "-f, --force", description: "Reinstall even if already installed" },
      { flags: "-j, --json", description: "Output as JSON" },
    ],
    helpText: "\nExamples:\n  arcana import manifest.json\n  arcana import manifest.json --force",
    module: "./commands/import-cmd.js",
    handler: "importCommand",
  },
  {
    command: "completions <shell>",
    description: "Generate shell completion scripts",
    group: "WORKFLOW",
    options: [{ flags: "-j, --json", description: "Output as JSON" }],
    helpText:
      "\nSupported shells: bash, zsh, fish\n\nExamples:\n  arcana completions bash >> ~/.bashrc\n  arcana completions zsh >> ~/.zshrc\n  arcana completions fish > ~/.config/fish/completions/arcana.fish",
    module: "./commands/completions.js",
    handler: "completionsCommand",
  },

  // ── Progressive Disclosure ──────────────────────────────────
  {
    command: "index",
    description: "Generate skill metadata index for on-demand loading",
    group: "DISCLOSURE",
    options: [{ flags: "-j, --json", description: "Output as JSON" }],
    module: "./commands/index.js",
    handler: "indexCommand",
  },
  {
    command: "load [skills...]",
    description: "Load full skill content on demand",
    group: "DISCLOSURE",
    options: [
      { flags: "--append", description: "Write loaded skills to _loaded.md aggregate file" },
      { flags: "-j, --json", description: "Output as JSON" },
    ],
    helpText:
      "\nExamples:\n  arcana load golang-pro\n  arcana load golang-pro typescript\n  arcana load golang-pro --append",
    module: "./commands/load.js",
    handler: "loadCommand",
  },
];

// ── Derived utilities (replaces command-registry.ts) ──────────

export function getCommandNames(): string[] {
  return COMMANDS.map((c) => c.command.split(/\s/)[0]!);
}

export function getGroupedCommands(): Record<
  string,
  { name: string; usage: string; description: string; group: string }[]
> {
  const groups: Record<string, { name: string; usage: string; description: string; group: string }[]> = {};
  for (const cmd of COMMANDS) {
    const name = cmd.command.split(/\s/)[0]!;
    const entry = { name, usage: cmd.command, description: cmd.description, group: cmd.group };
    (groups[cmd.group] ??= []).push(entry);
  }
  return groups;
}

export function findClosestCommand(input: string): string | undefined {
  const prefix = input.slice(0, 3).toLowerCase();
  const names = getCommandNames();
  return names.find((n) => n.startsWith(prefix));
}

export function getCliReference(): string {
  return COMMANDS.map((c) => `arcana ${c.command}`).join("\n");
}
