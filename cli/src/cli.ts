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
      const commands = [
        "list",
        "install",
        "info",
        "search",
        "providers",
        "create",
        "validate",
        "update",
        "uninstall",
        "init",
        "doctor",
        "clean",
        "compact",
        "stats",
        "config",
        "audit",
        "scan",
        "optimize",
      ];
      const match = commands.find((c) => c.startsWith(cmd.slice(0, 3)));
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
    const { showInteractiveMenu } = await import("./interactive.js");
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
    .option("-j, --json", "Output as JSON")
    .addHelpText("after", '\nExamples:\n  arcana search testing\n  arcana search "code review"')
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
    .action(async (skill, opts) => {
      const { auditCommand } = await import("./commands/audit.js");
      return auditCommand(skill, opts);
    });

  program
    .command("scan [skill]")
    .description("Scan skills for security threats (prompt injection, malware, credential theft)")
    .option("-a, --all", "Scan all installed skills")
    .option("-j, --json", "Output as JSON")
    .addHelpText("after", "\nExamples:\n  arcana scan code-reviewer\n  arcana scan --all\n  arcana scan --all --json")
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

  return program;
}
