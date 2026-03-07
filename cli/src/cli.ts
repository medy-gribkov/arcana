import { createRequire } from "node:module";
import { Command } from "commander";
import { ui } from "./utils/ui.js";
import { COMMANDS } from "./command-defs.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

export function createCli(): Command {
  const program = new Command();

  program.name("arcana").description("Universal AI development CLI").version(pkg.version);

  // Custom help formatter for root command
  const defaultFormatHelp = program.createHelp().formatHelp.bind(program.createHelp());
  program.configureHelp({
    formatHelp: (cmd, helper) => {
      if (cmd.name() === "arcana") {
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

  // Default action: interactive menu or help
  program.argument("[command]", "", "").action(async (cmd: string | undefined) => {
    if (cmd) {
      console.error();
      console.error(ui.error("  Error: ") + `unknown command '${cmd}'`);
      const { findClosestCommand } = await import("./command-defs.js");
      const match = findClosestCommand(cmd);
      if (match) {
        console.error(ui.dim(`  Did you mean '${match}'?`));
      }
      console.error(ui.dim("  Run arcana --help for all commands"));
      console.error();
      process.exit(1);
    }
    const { isFirstRun, showWelcome, markInitialized, buildCustomHelp } = await import("./utils/help.js");

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

  // Register all commands from definitions
  for (const def of COMMANDS) {
    const cmd = program.command(def.command).description(def.description);
    if (def.allowUnknownOption) cmd.allowUnknownOption(true);
    for (const opt of def.options ?? []) {
      if (opt.parseAs === "int") {
        cmd.option(opt.flags, opt.description, parseInt);
      } else {
        cmd.option(opt.flags, opt.description);
      }
    }
    if (def.helpText) cmd.addHelpText("after", def.helpText);
    cmd.action(async (...args: unknown[]) => {
      const mod = (await import(def.module)) as Record<string, (...a: unknown[]) => Promise<void>>;
      // Commander passes: [positionalArgs..., opts, Command] — strip Command
      return mod[def.handler]!(...args.slice(0, -1));
    });
  }

  return program;
}
