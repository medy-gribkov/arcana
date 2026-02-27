import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { renderBanner } from "../utils/help.js";

type ToolName = "claude" | "cursor" | "codex" | "gemini" | "antigravity" | "windsurf" | "aider";

interface ProjectInfo {
  name: string;
  type: string;
  lang: string;
}

export function detectProject(cwd: string): ProjectInfo {
  const name = basename(cwd);
  if (existsSync(join(cwd, "go.mod"))) return { name, type: "Go", lang: "go" };
  if (existsSync(join(cwd, "Cargo.toml"))) return { name, type: "Rust", lang: "rust" };
  if (existsSync(join(cwd, "requirements.txt")) || existsSync(join(cwd, "pyproject.toml")))
    return { name, type: "Python", lang: "python" };
  if (existsSync(join(cwd, "package.json"))) {
    try {
      const raw = readFileSync(join(cwd, "package.json"), "utf-8");
      const pkg = JSON.parse(raw) as Record<string, Record<string, string> | undefined>;
      if (pkg.dependencies?.next || pkg.devDependencies?.next) return { name, type: "Next.js", lang: "typescript" };
      if (pkg.dependencies?.react || pkg.devDependencies?.react) return { name, type: "React", lang: "typescript" };
    } catch {
      /* ignore */
    }
    return { name, type: "Node.js", lang: "typescript" };
  }
  return { name, type: "Unknown", lang: "general" };
}

function claudeTemplate(proj: ProjectInfo): string {
  return `# CLAUDE.md - ${proj.name}

## Project
- **Type:** ${proj.type}
- **Language:** ${proj.lang}

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

  p.outro(`Next: ${chalk.cyan("arcana install <skill>")} or ${chalk.cyan("arcana install --all")}`);
}
