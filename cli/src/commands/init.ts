import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { renderBanner } from "../utils/help.js";
import { detectProjectContext } from "../utils/project-context.js";

type ToolName = "claude" | "cursor" | "codex" | "gemini" | "antigravity" | "windsurf" | "aider";

interface ProjectInfo {
  name: string;
  type: string;
  lang: string;
}

export function detectProject(cwd: string): ProjectInfo {
  const ctx = detectProjectContext(cwd);
  return { name: ctx.name, type: ctx.type, lang: ctx.lang };
}

/** Detect which AI tools are already configured in this project. */
export function detectInstalledTools(cwd: string): ToolName[] {
  const tools: ToolName[] = [];
  if (existsSync(join(cwd, "CLAUDE.md"))) tools.push("claude");
  if (existsSync(join(cwd, ".cursor"))) tools.push("cursor");
  if (existsSync(join(cwd, "AGENTS.md"))) tools.push("codex");
  if (existsSync(join(cwd, "GEMINI.md"))) tools.push("gemini");
  if (existsSync(join(cwd, ".windsurfrules"))) tools.push("windsurf");
  if (existsSync(join(cwd, "AGENT.md"))) tools.push("antigravity");
  if (existsSync(join(cwd, ".aider.conf.yml"))) tools.push("aider");
  return tools;
}

function claudeTemplate(proj: ProjectInfo): string {
  return `# CLAUDE.md - ${proj.name}

## Project
- **Type:** ${proj.type}
- **Language:** ${proj.lang}

## Skills
Active skills curated at ~/.agents/skills/_active.md (budget-aware, project-specific).
Full index at ~/.agents/skills/_index.md.
Run \`arcana curate\` to refresh after project changes.
Run \`arcana load <skill>\` for additional skills on demand.

## Coding Preferences
- Follow existing patterns in the codebase
- Handle errors explicitly
- Use meaningful variable names, no abbreviations

## Build & Test
<!-- Add build/test commands so Claude can verify changes -->
<!-- Example: npm test, go test ./..., pytest -->

## Project Structure
<!-- Describe your project structure here -->
`;
}

function cursorTemplate(proj: ProjectInfo): string {
  return `---
description: Project conventions for ${proj.name}
globs:
---

# ${proj.name} (${proj.type})

## Language
${proj.lang}

## Coding Standards
- Follow existing patterns in the codebase
- Handle errors explicitly
- Use meaningful variable names
`;
}

function codexTemplate(proj: ProjectInfo): string {
  return `# AGENTS.md - ${proj.name}

## Project
Type: ${proj.type} | Language: ${proj.lang}

## Skills
Active skills curated at ~/.agents/skills/_active.md (budget-aware, project-specific).
Full index at ~/.agents/skills/_index.md.
Run \`arcana curate\` to refresh. Run \`arcana load <skill>\` for on-demand loading.

## Sandbox
Codex runs in a sandboxed environment with no network access.
All dependencies must be pre-installed before the session.

## Guidelines
- Follow existing patterns in the codebase
- Handle errors explicitly
- Use meaningful variable names
`;
}

function geminiTemplate(proj: ProjectInfo): string {
  return `# GEMINI.md - ${proj.name}

## Project Context
This is a ${proj.type} project using ${proj.lang}.

## Project Files
<!-- List key files and directories so Gemini can navigate the codebase -->
<!-- Example: src/ - main source, tests/ - test files -->

## Instructions
- Follow existing patterns in the codebase
- Handle errors explicitly
- Use meaningful variable names
`;
}

function antigravityTemplate(proj: ProjectInfo): string {
  return `# Antigravity - ${proj.name}

## Project Context
This is a ${proj.type} project using ${proj.lang}.
Antigravity workspace: \`.agent/\` (rules, workflows, skills)

## Project Files
<!-- List key files and directories so the agent can navigate the codebase -->
<!-- Example: src/ - main source, tests/ - test files -->

## Instructions
- Follow existing patterns in the codebase
- Handle errors explicitly
- Use meaningful variable names
`;
}

function windsurfTemplate(proj: ProjectInfo): string {
  return `# Windsurf Cascades Rules - ${proj.name}

Project: ${proj.name} (${proj.type})
Language: ${proj.lang}

## Rules
- Follow existing patterns in the codebase
- Handle errors explicitly
- Use meaningful variable names
- Always explain changes before applying them
`;
}

function aiderTemplate(_proj: ProjectInfo): string {
  return `# Aider Configuration
model: sonnet
auto-commits: true
auto-test: false
# Add conventions below
conventions:
  - Follow existing patterns in the codebase
  - Write clean, maintainable code
  - Handle errors explicitly
`;
}

const TOOL_FILES: Record<
  ToolName,
  { path: string | ((cwd: string) => string); template: (p: ProjectInfo) => string; label: string }
> = {
  claude: { path: "CLAUDE.md", template: claudeTemplate, label: "Claude Code" },
  cursor: {
    path: join(".cursor", "rules", "project.mdc"),
    template: cursorTemplate,
    label: "Cursor",
  },
  codex: { path: "AGENTS.md", template: codexTemplate, label: "Codex CLI" },
  gemini: { path: "GEMINI.md", template: geminiTemplate, label: "Gemini CLI" },
  antigravity: { path: "AGENT.md", template: antigravityTemplate, label: "Antigravity" },
  windsurf: { path: ".windsurfrules", template: windsurfTemplate, label: "Windsurf" },
  aider: { path: ".aider.conf.yml", template: aiderTemplate, label: "Aider" },
};

export const SKILL_SUGGESTIONS: Record<string, string[]> = {
  Go: ["golang-pro", "go-linter-configuration", "testing-strategy", "security-review"],
  Rust: ["rust-best-practices", "testing-strategy", "security-review"],
  Python: ["python-best-practices", "testing-strategy", "security-review"],
  "Next.js": ["typescript", "typescript-advanced", "frontend-design", "performance-optimization", "security-review"],
  React: ["typescript", "frontend-design", "frontend-code-review", "testing-strategy"],
  "Node.js": ["typescript", "npm-package", "testing-strategy", "security-review"],
};

export const SKILL_SUGGESTIONS_DEFAULT = [
  "code-reviewer",
  "security-review",
  "codebase-dissection",
  "testing-strategy",
];

export async function initCommand(opts: { tool?: string }): Promise<void> {
  console.log(renderBanner());
  console.log();
  p.intro(chalk.bold("Initialize arcana"));

  const cwd = process.cwd();
  const proj = detectProject(cwd);

  p.log.step(`Project detected: ${chalk.cyan(proj.name)} (${proj.type})`);

  if (opts.tool && opts.tool !== "all" && !(opts.tool in TOOL_FILES)) {
    const valid = Object.keys(TOOL_FILES).join(", ");
    p.cancel(`Unknown tool: ${opts.tool}. Valid: ${valid}`);
    process.exit(1);
  }

  const tools: ToolName[] =
    opts.tool === "all" || !opts.tool
      ? ["claude", "cursor", "codex", "gemini", "antigravity", "windsurf", "aider"]
      : [opts.tool as ToolName];

  let created = 0;
  let skipped = 0;

  for (const tool of tools) {
    const entry = TOOL_FILES[tool];
    if (!entry) {
      p.log.warn(`Unknown tool: ${tool}`);
      continue;
    }

    const relPath = typeof entry.path === "function" ? entry.path(cwd) : entry.path;
    const fullPath = join(cwd, relPath);

    if (existsSync(fullPath)) {
      p.log.info(`Skip ${relPath} (already exists)`);
      skipped++;
      continue;
    }

    const content = entry.template(proj);
    try {
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content, "utf-8");
    } catch (err) {
      p.log.warn(`Failed to create ${relPath}: ${err instanceof Error ? err.message : "unknown error"}`);
      continue;
    }
    p.log.success(`Created ${chalk.cyan(relPath)} (${entry.label})`);
    created++;
  }

  if (created > 0) {
    p.log.info(`${created} file${created > 1 ? "s" : ""} created. Edit them to match your project.`);
  } else {
    p.log.info("All config files already exist.");
  }
  if (skipped > 0) p.log.info(`${skipped} skipped (already exist)`);

  // Offer to install PreCompact hook for context preservation
  const globalSettings = join(process.env.HOME || process.env.USERPROFILE || "", ".claude", "settings.json");
  let hasPreCompactHook = false;
  if (existsSync(globalSettings)) {
    try {
      const settings = JSON.parse(readFileSync(globalSettings, "utf-8"));
      hasPreCompactHook = Array.isArray(settings?.hooks?.PreCompact) && settings.hooks.PreCompact.length > 0;
    } catch {
      /* ignore */
    }
  }

  if (!hasPreCompactHook) {
    const installHook = await p.confirm({
      message: "Install PreCompact hook? (preserves context before auto-compaction)",
      initialValue: true,
    });

    if (p.isCancel(installHook)) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    if (installHook) {
      try {
        let settings: Record<string, unknown> = {};
        if (existsSync(globalSettings)) {
          settings = JSON.parse(readFileSync(globalSettings, "utf-8"));
        }

        const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
        hooks.PreCompact = [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command:
                  'bash -c \'PROJ_DIR="$HOME/.claude/projects"; for d in "$PROJ_DIR"/*/memory; do if [ -d "$d" ]; then echo "## Handover $(date +%Y-%m-%d_%H%M)" >> "$d/HANDOVER.md"; echo "Auto-compaction triggered. Review MEMORY.md for preserved context." >> "$d/HANDOVER.md"; echo "" >> "$d/HANDOVER.md"; fi; done\'',
                timeout: 10,
              },
            ],
          },
        ];
        settings.hooks = hooks;

        writeFileSync(globalSettings, JSON.stringify(settings, null, 2) + "\n", "utf-8");
        p.log.success("Installed PreCompact hook in ~/.claude/settings.json");
      } catch (err) {
        p.log.warn(`Could not install hook: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  } else {
    p.log.info("PreCompact hook already installed");
  }

  const suggestions = SKILL_SUGGESTIONS[proj.type] || SKILL_SUGGESTIONS_DEFAULT;

  const skillList = suggestions.map((s) => `arcana install ${s}`).join("\n");
  p.note(skillList, "Recommended skills");

  // Offer context curation
  const doCurate = await p.confirm({
    message: "Run context curation? (auto-selects project-relevant skills within token budget)",
    initialValue: true,
  });
  if (!p.isCancel(doCurate) && doCurate) {
    try {
      const { regenerateActive } = await import("./curate.js");
      const result = regenerateActive();
      p.log.success(`Curated ${result.selected.length} skills (${result.totalTokens.toLocaleString()} tokens)`);
    } catch {
      p.log.info("No skills installed yet. Run curate after installing skills.");
    }
  }

  // Offer MCP server setup
  const doMcp = await p.confirm({
    message: "Set up MCP servers? (Context7 for live docs, etc.)",
    initialValue: false,
  });
  if (!p.isCancel(doMcp) && doMcp) {
    try {
      const { installMcpServer } = await import("../mcp/install.js");
      const result = installMcpServer("context7", "claude", cwd);
      if (result.installed) {
        p.log.success("Context7 MCP configured");
      }
    } catch (err) {
      p.log.warn(`MCP setup: ${err instanceof Error ? err.message : "failed"}`);
    }
  }

  // Offer compression hook install
  const doCompress = await p.confirm({
    message: "Install output compression hooks? (saves 60-80% on git/npm/tsc tokens)",
    initialValue: false,
  });
  if (!p.isCancel(doCompress) && doCompress) {
    try {
      const { installHook } = await import("../compress/hook.js");
      const result = installHook();
      if (result.installed) {
        p.log.success(`Compression hook installed at ${result.path}`);
      } else {
        p.log.warn(result.error ?? "Hook install failed");
      }
    } catch (err) {
      p.log.warn(`Hook: ${err instanceof Error ? err.message : "failed"}`);
    }
  }

  // Show detected tools
  const detected = detectInstalledTools(cwd);
  if (detected.length > 0) {
    p.log.info(`Detected AI tools: ${detected.join(", ")}`);
  }

  p.outro(`Next: ${chalk.cyan("arcana install <skill>")} or ${chalk.cyan("arcana install --all")}`);
}
