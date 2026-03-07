import { createRequire } from "node:module";
import { Command } from "commander";
import { ui } from "./utils/ui.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

export function createCli(): Command {
  const program = new Command();

  program.name("arcana").description("Universal AI development CLI").version(pkg.version);

  // Store default help formatter before overriding
  const defaultFormatHelp = program.createHelp().formatHelp.bind(program.createHelp());
  program.configureHelp({
    formatHelp: (cmd, helper) => {
      if (cmd.name() === "arcana") {
        // Lazy import to avoid loading help.ts at startup for subcommands
        const { buildCustomHelp } = require("./utils/help.js") as typeof import("./utils/help.js");
        return buildCustomHelp(pkg.version);
      }
      return defaultFormatHelp(cmd, helper);
    },
  });
  program.addHelpCommand(false);
  program.showSuggestionAfterError(true);
  program.configureOutput({
    outputError: (str) => {
      const cleaned = str.replace(/^error: /, "");
      console.error();
      console.error(ui.error("  Error: ") + cleaned.trim());
      console.error(ui.dim("  Run arcana <command> --help for usage"));
      console.error();
    },
  });

  program.argument("[command]", "", "").action(async (cmd: string | undefined) => {
    if (cmd) {
      console.error();
      console.error(ui.error("  Error: ") + `unknown command '${cmd}'`);
      const { findClosestCommand } = await import("./command-registry.js");
      const match = findClosestCommand(cmd);
      if (match) {
        console.error(ui.dim(`  Did you mean '${match}'?`));
      }
      console.error(ui.dim("  Run arcana --help for all commands"));
      console.error();
      process.exit(1);
    }
    const { isFirstRun, showWelcome, markInitialized, buildCustomHelp } = await import("./utils/help.js");

    // Non-TTY (CI, pipes): print static help
    if (!process.stdout.isTTY) {
      console.log(buildCustomHelp(pkg.version));
      return;
    }

    if (isFirstRun()) {
      showWelcome(pkg.version);
      markInitialized();
    }
    const { showInteractiveMenu } = await import("./interactive/index.js");
    await showInteractiveMenu(pkg.version);
  });

  program
    .command("list")
    .description("List available skills")
    .option("-p, --provider <name>", "Provider to list from")
    .option("-a, --all", "List from all providers")
    .option("--installed", "Show only installed skills")
    .option("--no-cache", "Bypass skill cache")
    .option("-j, --json", "Output as JSON")
    .addHelpText("after", "\nExamples:\n  arcana list\n  arcana list --installed\n  arcana list --all --no-cache")
    .action(async (opts) => {
      const { listCommand } = await import("./commands/list.js");
      return listCommand(opts);
    });

  program
    .command("install [skills...]")
    .description("Install one or more skills")
    .option("-p, --provider <name>", "Provider to install from")
    .option("-a, --all", "Install all skills")
    .option("-f, --force", "Reinstall even if already installed")
    .option("--dry-run", "Show what would be installed without installing")
    .option("-j, --json", "Output as JSON")
    .option("--no-check", "Skip conflict detection")
    .addHelpText(
      "after",
      "\nExamples:\n  arcana install code-reviewer\n  arcana install skill1 skill2 skill3\n  arcana install --all --force",
    )
    .action(async (skills, opts) => {
      const { installCommand } = await import("./commands/install.js");
      return installCommand(skills, opts);
    });

  program
    .command("info <skill>")
    .description("Show skill details")
    .option("-p, --provider <name>", "Provider to search")
    .option("-j, --json", "Output as JSON")
    .action(async (skill, opts) => {
      const { infoCommand } = await import("./commands/info.js");
      return infoCommand(skill, opts);
    });

  program
    .command("search <query>")
    .description("Search for skills across providers")
    .option("-p, --provider <name>", "Limit search to provider")
    .option("--no-cache", "Bypass skill cache")
    .option("-t, --tag <tag>", "Filter by tech stack tag")
    .option("-s, --smart", "Context-aware ranking (uses project detection)")
    .option("-j, --json", "Output as JSON")
    .addHelpText(
      "after",
      '\nExamples:\n  arcana search testing\n  arcana search "code review"\n  arcana search react --tag typescript\n  arcana search api --smart',
    )
    .action(async (query, opts) => {
      const { searchCommand } = await import("./commands/search.js");
      return searchCommand(query, opts);
    });

  program
    .command("providers")
    .description("Manage skill providers")
    .option("--add <owner/repo>", "Add a GitHub provider")
    .option("--remove <name>", "Remove a provider")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const { providersCommand } = await import("./commands/providers.js");
      return providersCommand(opts);
    });

  program
    .command("create <name>")
    .description("Create a new skill from template")
    .action(async (name) => {
      const { createCommand } = await import("./commands/create.js");
      return createCommand(name);
    });

  program
    .command("validate [skill]")
    .description("Validate skill structure and metadata")
    .option("-a, --all", "Validate all installed skills")
    .option("-f, --fix", "Auto-fix common issues")
    .option("-j, --json", "Output as JSON")
    .option("--source <dir>", "Validate from source directory instead of install dir")
    .option("--cross", "Run cross-validation (marketplace sync, companions, orphans)")
    .option("--min-score <n>", "Minimum quality score (0-100), fail if any skill scores below", parseInt)
    .action(async (skill, opts) => {
      const { validateCommand } = await import("./commands/validate.js");
      return validateCommand(skill, opts);
    });

  program
    .command("update [skills...]")
    .description("Update installed skills")
    .option("-a, --all", "Update all installed skills")
    .option("-p, --provider <name>", "Update from specific provider")
    .option("-n, --dry-run", "Show what would be updated without updating")
    .option("-j, --json", "Output as JSON")
    .addHelpText(
      "after",
      "\nExamples:\n  arcana update code-reviewer\n  arcana update skill1 skill2\n  arcana update --all --dry-run",
    )
    .action(async (skills, opts) => {
      const { updateCommand } = await import("./commands/update.js");
      return updateCommand(skills, opts);
    });

  program
    .command("uninstall [skills...]")
    .description("Uninstall one or more skills")
    .option("-y, --yes", "Skip confirmation prompt")
    .option("-j, --json", "Output as JSON")
    .addHelpText("after", "\nExamples:\n  arcana uninstall code-reviewer\n  arcana uninstall skill1 skill2 --yes")
    .action(async (skills, opts) => {
      const { uninstallCommand } = await import("./commands/uninstall.js");
      return uninstallCommand(skills, opts);
    });

  program
    .command("init")
    .description("Initialize arcana in current project")
    .option("-t, --tool <name>", "Target tool (claude, cursor, codex, gemini, antigravity, windsurf, aider, all)")
    .action(async (opts) => {
      const { initCommand } = await import("./commands/init.js");
      return initCommand(opts);
    });

  program
    .command("doctor")
    .description("Check environment and diagnose issues")
    .option("-f, --fix", "Auto-fix issues where possible")
    .option("-j, --json", "Output as JSON")
    .action(async (opts) => {
      const { doctorCommand } = await import("./commands/doctor.js");
      return doctorCommand(opts);
    });

  program
    .command("clean")
    .description("Remove orphaned data, old session logs, and temp files")
    .option("-n, --dry-run", "Show what would be removed without deleting")
    .option("--aggressive", "Delete all session logs regardless of age")
    .option("--keep-days <days>", "Keep main session logs newer than N days (default: 30)", parseInt)
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const { cleanCommand } = await import("./commands/clean.js");
      return cleanCommand(opts);
    });

  program
    .command("compact")
    .description("Remove agent logs while preserving main session history")
    .option("-n, --dry-run", "Show what would be removed without deleting")
    .option("--prune", "Also prune oversized main sessions (>14d old AND >10 MB)")
    .option("--prune-days <days>", "Override prune age threshold (default: 14)", parseInt)
    .option("-j, --json", "Output as JSON")
    .action(async (opts) => {
      const { compactCommand } = await import("./commands/compact.js");
      return compactCommand(opts);
    });

  program
    .command("stats")
    .description("Show session analytics and token usage")
    .option("-j, --json", "Output as JSON")
    .action(async (opts) => {
      const { statsCommand } = await import("./commands/stats.js");
      return statsCommand(opts);
    });

  program
    .command("config [action] [value]")
    .description("View or modify arcana configuration")
    .option("-j, --json", "Output as JSON")
    .addHelpText(
      "after",
      "\nExamples:\n  arcana config\n  arcana config path\n  arcana config defaultProvider arcana\n  arcana config reset",
    )
    .action(async (action, value, opts) => {
      const { configCommand } = await import("./commands/config.js");
      return configCommand(action, value, opts);
    });

  program
    .command("audit [skill]")
    .description("Audit skill quality (code examples, BAD/GOOD pairs, structure)")
    .option("-a, --all", "Audit all installed skills")
    .option("-j, --json", "Output as JSON")
    .option("--source <dir>", "Audit from source directory instead of install dir")
    .action(async (skill, opts) => {
      const { auditCommand } = await import("./commands/audit.js");
      return auditCommand(skill, opts);
    });

  program
    .command("scan [skill]")
    .description("Scan skills for security threats (prompt injection, malware, credential theft)")
    .option("-a, --all", "Scan all installed skills")
    .option("--strict", "Scan all lines including BAD/DON'T examples (no scope filtering)")
    .option("-v, --verbose", "Show suppressed findings from BAD/DON'T blocks")
    .option("-j, --json", "Output as JSON")
    .addHelpText(
      "after",
      "\nExamples:\n  arcana scan code-reviewer\n  arcana scan --all\n  arcana scan --all --strict\n  arcana scan --all --json",
    )
    .action(async (skill, opts) => {
      const { scanCommand } = await import("./commands/scan.js");
      return scanCommand(skill, opts);
    });

  program
    .command("optimize")
    .description("Analyze Claude Code setup and suggest token/performance improvements")
    .option("-j, --json", "Output as JSON")
    .action(async (opts) => {
      const { optimizeCommand } = await import("./commands/optimize.js");
      return optimizeCommand(opts);
    });

  // === Security ===

  program
    .command("verify [skill]")
    .description("Verify installed skill integrity against lockfile")
    .option("-a, --all", "Verify all installed skills")
    .option("-j, --json", "Output as JSON")
    .addHelpText(
      "after",
      "\nExamples:\n  arcana verify code-reviewer\n  arcana verify --all\n  arcana verify --all --json",
    )
    .action(async (skill, opts) => {
      const { verifyCommand } = await import("./commands/verify.js");
      return verifyCommand(skill, opts);
    });

  program
    .command("lock")
    .description("Generate or validate lockfile from installed skills")
    .option("--ci", "Validate lockfile matches installed skills (CI mode)")
    .option("-j, --json", "Output as JSON")
    .addHelpText("after", "\nExamples:\n  arcana lock\n  arcana lock --ci\n  arcana lock --json")
    .action(async (opts) => {
      const { lockCommand } = await import("./commands/lock.js");
      return lockCommand(opts);
    });

  // === Performance & Inspection ===

  program
    .command("benchmark [skill]")
    .description("Measure token cost of installed skills")
    .option("-a, --all", "Benchmark all installed skills")
    .option("--progressive", "Show before/after comparison with progressive disclosure")
    .option("-j, --json", "Output as JSON")
    .addHelpText(
      "after",
      "\nExamples:\n  arcana benchmark code-reviewer\n  arcana benchmark --all\n  arcana benchmark --all --progressive",
    )
    .action(async (skill, opts) => {
      const { benchmarkCommand } = await import("./commands/benchmark.js");
      return benchmarkCommand(skill, opts);
    });

  program
    .command("diff <skill>")
    .description("Show changes between installed and remote skill version")
    .option("-p, --provider <name>", "Provider to compare against")
    .option("-j, --json", "Output as JSON")
    .addHelpText("after", "\nExamples:\n  arcana diff code-reviewer\n  arcana diff code-reviewer --json")
    .action(async (skill, opts) => {
      const { diffCommand } = await import("./commands/diff.js");
      return diffCommand(skill, opts);
    });

  program
    .command("outdated")
    .description("List skills with newer versions available")
    .option("-p, --provider <name>", "Check against specific provider")
    .option("-j, --json", "Output as JSON")
    .action(async (opts) => {
      const { outdatedCommand } = await import("./commands/outdated.js");
      return outdatedCommand(opts);
    });

  // === Workflow & Team ===

  program
    .command("profile [action] [name] [skills...]")
    .description("Manage skill profiles (named sets of skills)")
    .option("-j, --json", "Output as JSON")
    .addHelpText(
      "after",
      "\nActions:\n  list          List all profiles (default)\n  create <name> Create a profile\n  delete <name> Delete a profile\n  show <name>   Show skills in a profile\n  apply <name>  Install all skills from a profile\n\nExamples:\n  arcana profile create security scan verify audit\n  arcana profile apply security",
    )
    .action(async (action, name, skills, opts) => {
      const { profileCommand } = await import("./commands/profile.js");
      return profileCommand(action, name, skills, opts);
    });

  program
    .command("team [action] [skill]")
    .description("Manage shared team skill configuration")
    .option("-j, --json", "Output as JSON")
    .addHelpText(
      "after",
      "\nActions:\n  init          Create .arcana/team.json\n  sync          Install skills from team config\n  add <skill>   Add a skill to team config\n  remove <skill> Remove a skill from team config\n\nExamples:\n  arcana team init\n  arcana team add code-reviewer\n  arcana team sync",
    )
    .action(async (action, skill, opts) => {
      const { teamCommand } = await import("./commands/team.js");
      return teamCommand(action, skill, opts);
    });

  program
    .command("export")
    .description("Export installed skills as a manifest")
    .option("--sbom", "Export as SPDX-lite software bill of materials")
    .option("-j, --json", "Output as JSON (default)")
    .action(async (opts) => {
      const { exportCommand } = await import("./commands/export-cmd.js");
      return exportCommand(opts);
    });

  program
    .command("import <file>")
    .description("Import and install skills from a manifest file")
    .option("-f, --force", "Reinstall even if already installed")
    .option("-j, --json", "Output as JSON")
    .addHelpText("after", "\nExamples:\n  arcana import manifest.json\n  arcana import manifest.json --force")
    .action(async (file, opts) => {
      const { importCommand } = await import("./commands/import-cmd.js");
      return importCommand(file, opts);
    });

  program
    .command("completions <shell>")
    .description("Generate shell completion scripts")
    .option("-j, --json", "Output as JSON")
    .addHelpText(
      "after",
      "\nSupported shells: bash, zsh, fish\n\nExamples:\n  arcana completions bash >> ~/.bashrc\n  arcana completions zsh >> ~/.zshrc\n  arcana completions fish > ~/.config/fish/completions/arcana.fish",
    )
    .action(async (shell, opts) => {
      const { completionsCommand } = await import("./commands/completions.js");
      return completionsCommand(shell, opts);
    });

  // ── Progressive Disclosure ─────────────────────────────────────

  program
    .command("index")
    .description("Generate skill metadata index for on-demand loading")
    .option("-j, --json", "Output as JSON")
    .action(async (opts) => {
      const { indexCommand } = await import("./commands/index.js");
      return indexCommand(opts);
    });

  program
    .command("load [skills...]")
    .description("Load full skill content on demand")
    .option("--append", "Write loaded skills to _loaded.md aggregate file")
    .option("-j, --json", "Output as JSON")
    .addHelpText(
      "after",
      "\nExamples:\n  arcana load golang-pro\n  arcana load golang-pro typescript\n  arcana load golang-pro --append",
    )
    .action(async (skills, opts) => {
      const { loadCommand } = await import("./commands/load.js");
      return loadCommand(skills, opts);
    });

  program
    .command("curate")
    .description("Auto-generate _active.md with budget-aware, project-relevant skills")
    .option("-b, --budget <pct>", "Max % of context window for skills (default: 30)", parseInt)
    .option("-m, --model <name>", "Target model for context budget (e.g. claude-opus-4.6, gpt-5.4)")
    .option("-i, --include <skills...>", "Force-include specific skills")
    .option("-j, --json", "Output as JSON")
    .addHelpText(
      "after",
      "\nExamples:\n  arcana curate\n  arcana curate --model gpt-5.4 --budget 40\n  arcana curate --include golang-pro typescript",
    )
    .action(async (opts) => {
      const { curateCommand } = await import("./commands/curate.js");
      return curateCommand(opts);
    });

  // ── Smart Recommendations ──────────────────────────────────────
  program
    .command("recommend")
    .description("Get smart skill recommendations for current project")
    .option("-j, --json", "Output as JSON")
    .option("-l, --limit <n>", "Max results per category", parseInt)
    .option("-p, --provider <name>", "Limit to provider")
    .addHelpText("after", "\nExamples:\n  arcana recommend\n  arcana recommend --json\n  arcana recommend --limit 5")
    .action(async (opts) => {
      const { recommendCommand } = await import("./commands/recommend.js");
      return recommendCommand(opts);
    });

  // ── Output Compression (RTK concept) ─────────────────────────

  program
    .command("compress [command...]")
    .description("Run a command with output compression (saves tokens)")
    .allowUnknownOption(true)
    .option("--stdin", "Read from stdin instead of running a command")
    .option("-t, --tool <name>", "Tool type hint for compression rules (git, npm, tsc, vitest)")
    .option("-j, --json", "Output stats as JSON")
    .action(async (command: string[], opts) => {
      const { compress, compressionStats, recordCompression } = await import("./compress/index.js");

      let input: string;
      if (opts.stdin) {
        // Read from stdin
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
        input = Buffer.concat(chunks).toString("utf-8");
      } else if (command.length > 0) {
        // Run the command and capture output
        const { execSync } = await import("node:child_process");
        try {
          input = execSync(command.join(" "), {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
            maxBuffer: 10 * 1024 * 1024,
          });
        } catch (err) {
          input =
            (err as { stdout?: string; stderr?: string }).stdout ?? "" + ((err as { stderr?: string }).stderr ?? "");
        }
      } else {
        console.error("Usage: arcana compress <command> or echo ... | arcana compress --stdin --tool git");
        process.exit(1);
        return;
      }

      const tool = opts.tool ?? command[0] ?? "unknown";
      const compressed = compress(input, tool);
      const stats = compressionStats(input, compressed);
      recordCompression(tool, stats.originalTokens, stats.compressedTokens);

      if (opts.json) {
        console.log(JSON.stringify(stats));
      } else {
        process.stdout.write(compressed);
      }
    });

  program
    .command("hook <action>")
    .description("Manage shell compression hooks (install, remove, status)")
    .action(async (action: string) => {
      const { installHook, removeHook, isHookInstalled } = await import("./compress/index.js");
      const { ui } = await import("./utils/ui.js");

      if (action === "install") {
        const result = installHook();
        if (result.installed) {
          console.log(`${ui.success("[OK]")} Hook installed at ${result.path}`);
          console.log(ui.dim("  Restart your shell to activate compression."));
        } else {
          console.log(`${ui.warn("[!!]")} ${result.error}`);
        }
      } else if (action === "remove") {
        const result = removeHook();
        if (result.removed) {
          console.log(`${ui.success("[OK]")} Hook removed from ${result.path}`);
        } else {
          console.log(ui.dim("  No hook found to remove."));
        }
      } else if (action === "status") {
        const installed = isHookInstalled();
        const { getCompressionStats } = await import("./compress/index.js");
        const stats = getCompressionStats();
        console.log(`  Hook: ${installed ? ui.success("installed") : ui.dim("not installed")}`);
        if (stats.totalInputTokens > 0) {
          console.log(`  Saved: ${stats.totalSaved.toLocaleString()} tokens (${stats.savingsPct}%)`);
          for (const [tool, ts] of Object.entries(stats.byTool)) {
            console.log(ui.dim(`    ${tool}: ${ts.calls} calls, ${ts.savedTokens.toLocaleString()} tokens saved`));
          }
        }
      } else {
        console.error("Usage: arcana hook <install|remove|status>");
        process.exit(1);
      }
    });

  // ── Memory (mem0 concept) ───────────────────────────────────

  program
    .command("remember [content...]")
    .description("Save a fact or preference for cross-session persistence")
    .option("-t, --tag <tags...>", "Tags for the memory")
    .option("-j, --json", "Output as JSON")
    .addHelpText(
      "after",
      '\nExamples:\n  arcana remember "always use pnpm"\n  arcana remember "use vitest" --tag testing',
    )
    .action(async (content: string[], opts) => {
      const { rememberCommand } = await import("./commands/remember.js");
      return rememberCommand(content, opts);
    });

  program
    .command("recall [query...]")
    .description("Search saved memories")
    .option("-a, --all", "List all memories")
    .option("-p, --project <name>", "Filter by project")
    .option("-j, --json", "Output as JSON")
    .addHelpText(
      "after",
      '\nExamples:\n  arcana recall "package manager"\n  arcana recall --all\n  arcana recall --project arcana',
    )
    .action(async (query: string[], opts) => {
      const { recallCommand } = await import("./commands/remember.js");
      return recallCommand(query, opts);
    });

  program
    .command("forget <id>")
    .description("Remove a saved memory by ID")
    .option("-j, --json", "Output as JSON")
    .action(async (id: string, opts) => {
      const { forgetCommand } = await import("./commands/remember.js");
      return forgetCommand(id, opts);
    });

  // ── Session Intelligence (CMV concept) ──────────────────────

  program
    .command("snapshot [name]")
    .description("Save a snapshot of the current session state")
    .option("-l, --list", "List all snapshots")
    .option("--delete <name>", "Delete a snapshot")
    .option("-j, --json", "Output as JSON")
    .addHelpText(
      "after",
      "\nExamples:\n  arcana snapshot analysis\n  arcana snapshot --list\n  arcana snapshot --delete analysis",
    )
    .action(async (name: string | undefined, opts) => {
      const { ui, banner } = await import("./utils/ui.js");

      if (opts.list) {
        const { listSnapshots } = await import("./session/snapshot.js");
        const snaps = listSnapshots();
        if (opts.json) {
          console.log(JSON.stringify(snaps));
          return;
        }
        banner();
        console.log(ui.bold("  Snapshots\n"));
        if (snaps.length === 0) {
          console.log(ui.dim("  No snapshots. Use: arcana snapshot <name>"));
        } else {
          for (const s of snaps) {
            console.log(
              `  ${ui.success(s.name)} ${s.project} (${(s.sizeBytes / 1024).toFixed(0)} KB, ${s.messageCount} messages)`,
            );
            console.log(ui.dim(`       ${s.created.slice(0, 19)}`));
          }
        }
        console.log();
        return;
      }

      if (opts.delete) {
        const { deleteSnapshot } = await import("./session/snapshot.js");
        const ok = deleteSnapshot(opts.delete);
        if (opts.json) {
          console.log(JSON.stringify({ deleted: ok, name: opts.delete }));
          return;
        }
        console.log(
          ok ? `${ui.success("[OK]")} Deleted ${opts.delete}` : `${ui.warn("[!!]")} Not found: ${opts.delete}`,
        );
        return;
      }

      if (!name) {
        console.error("Usage: arcana snapshot <name> or arcana snapshot --list");
        process.exit(1);
      }

      const { createSnapshot } = await import("./session/snapshot.js");
      const meta = createSnapshot(name, process.cwd());
      if (!meta) {
        if (opts.json) {
          console.log(JSON.stringify({ error: "No session found for current project" }));
          return;
        }
        console.log(`${ui.warn("[!!]")} No session found for current project.`);
        return;
      }
      if (opts.json) {
        console.log(JSON.stringify(meta));
        return;
      }
      banner();
      console.log(ui.bold("  Snapshot\n"));
      console.log(
        `  ${ui.success("[OK]")} Saved "${meta.name}" (${(meta.sizeBytes / 1024).toFixed(0)} KB, ${meta.messageCount} messages)`,
      );
      console.log();
    });

  program
    .command("trim")
    .description("Analyze and trim session bloat (tool output, base64)")
    .option("-n, --dry-run", "Analyze without trimming")
    .option("-j, --json", "Output as JSON")
    .action(async (opts) => {
      const { ui, banner } = await import("./utils/ui.js");
      const { findLatestSession } = await import("./session/snapshot.js");
      const { analyzeSession, trimSession } = await import("./session/trim.js");

      const sessionPath = findLatestSession(process.cwd());
      if (!sessionPath) {
        if (opts.json) {
          console.log(JSON.stringify({ error: "No session found" }));
          return;
        }
        console.log(`${ui.warn("[!!]")} No session found for current project.`);
        return;
      }

      if (opts.dryRun) {
        const analysis = analyzeSession(sessionPath);
        if (opts.json) {
          console.log(JSON.stringify(analysis));
          return;
        }
        banner();
        console.log(ui.bold("  Trim Analysis (dry run)\n"));
        console.log(`  Original: ${(analysis.originalBytes / 1024).toFixed(0)} KB (${analysis.originalLines} lines)`);
        console.log(`  Would trim: ${(analysis.savedBytes / 1024).toFixed(0)} KB (${analysis.savedPct}%)`);
        console.log(`  Tool results > 500 chars: ${analysis.toolResultsTrimmed}`);
        console.log(`  Base64 images: ${analysis.base64Removed}`);
        console.log();
        return;
      }

      const trimmed = trimSession(sessionPath);
      if (!trimmed) {
        if (opts.json) {
          console.log(JSON.stringify({ error: "Trim failed" }));
          return;
        }
        console.log(`${ui.warn("[!!]")} Trim failed.`);
        return;
      }
      if (opts.json) {
        console.log(JSON.stringify({ ...trimmed.result, destPath: trimmed.destPath }));
        return;
      }
      banner();
      console.log(ui.bold("  Session Trim\n"));
      console.log(
        `  ${ui.success("[OK]")} Saved ${(trimmed.result.savedBytes / 1024).toFixed(0)} KB (${trimmed.result.savedPct}%)`,
      );
      console.log(`  Tool results trimmed: ${trimmed.result.toolResultsTrimmed}`);
      console.log(`  Base64 removed: ${trimmed.result.base64Removed}`);
      console.log(ui.dim(`  Trimmed copy: ${trimmed.destPath}`));
      console.log(ui.dim("  Original session unchanged."));
      console.log();
    });

  // ── MCP Server Management (Context7 concept) ───────────────

  program
    .command("mcp <action> [name]")
    .description("Manage MCP servers (list, install, remove, status)")
    .option("-t, --tool <name>", "Target tool: claude or cursor (default: claude)")
    .option("-j, --json", "Output as JSON")
    .addHelpText(
      "after",
      "\nActions:\n  list              Show available MCP servers\n  install <name>    Install an MCP server\n  remove <name>     Remove an MCP server\n  status            Show configured MCP servers\n\nExamples:\n  arcana mcp list\n  arcana mcp install context7\n  arcana mcp status",
    )
    .action(async (action: string, name: string | undefined, opts) => {
      const { ui, banner } = await import("./utils/ui.js");

      if (action === "list") {
        const { listRegistry } = await import("./mcp/registry.js");
        const servers = listRegistry();
        if (opts.json) {
          console.log(JSON.stringify(servers));
          return;
        }
        banner();
        console.log(ui.bold("  Available MCP Servers\n"));
        for (const s of servers) {
          console.log(`  ${ui.success(s.name)} ${s.description}`);
          console.log(ui.dim(`       ${s.command} ${s.args.join(" ")}`));
        }
        console.log();
        return;
      }

      if (action === "install") {
        if (!name) {
          console.error("Usage: arcana mcp install <name>");
          process.exit(1);
        }
        const { installMcpServer } = await import("./mcp/install.js");
        const tool = (opts.tool ?? "claude") as "claude" | "cursor";
        const result = installMcpServer(name, tool, process.cwd());
        if (opts.json) {
          console.log(JSON.stringify(result));
          return;
        }
        if (result.installed) {
          console.log(`${ui.success("[OK]")} ${name} configured in ${result.path}`);
          if (result.error) console.log(ui.dim(`  Note: ${result.error}`));
        } else {
          console.log(`${ui.warn("[!!]")} ${result.error}`);
        }
        return;
      }

      if (action === "remove") {
        if (!name) {
          console.error("Usage: arcana mcp remove <name>");
          process.exit(1);
        }
        const { removeMcpServer } = await import("./mcp/install.js");
        const tool = (opts.tool ?? "claude") as "claude" | "cursor";
        const ok = removeMcpServer(name, tool, process.cwd());
        if (opts.json) {
          console.log(JSON.stringify({ removed: ok, name }));
          return;
        }
        console.log(ok ? `${ui.success("[OK]")} Removed ${name}` : `${ui.warn("[!!]")} ${name} not found`);
        return;
      }

      if (action === "status") {
        const { listConfiguredServers } = await import("./mcp/install.js");
        const tool = (opts.tool ?? "claude") as "claude" | "cursor";
        const servers = listConfiguredServers(tool, process.cwd());
        if (opts.json) {
          console.log(JSON.stringify({ tool, servers }));
          return;
        }
        banner();
        console.log(ui.bold(`  MCP Status (${tool})\n`));
        if (servers.length === 0) {
          console.log(ui.dim("  No MCP servers configured."));
        } else {
          for (const s of servers) {
            console.log(`  ${ui.success("[OK]")} ${s}`);
          }
        }
        console.log();
        return;
      }

      console.error("Usage: arcana mcp <list|install|remove|status> [name]");
      process.exit(1);
    });

  return program;
}
