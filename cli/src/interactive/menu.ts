import * as p from "@clack/prompts";
import chalk from "chalk";
import { renderBanner } from "../utils/help.js";
import { loadConfig } from "../utils/config.js";
import { getProviders, clearProviderCache } from "../registry.js";
import { getCliReference } from "../command-registry.js";
import type { SkillInfo } from "../types.js";
import { AMBER, countInstalled, buildMenuOptions } from "./helpers.js";
import { SKILL_CATEGORIES } from "./categories.js";
import { browseByCategory } from "./browse.js";
import { searchFlow } from "./search.js";
import { quickSetup } from "./setup.js";
import { manageInstalled } from "./manage.js";
import { checkHealth } from "./health.js";

export async function showInteractiveMenu(version: string): Promise<void> {
  const config = loadConfig();
  const providerName = config.defaultProvider;

  // Fetch skill list once for the session
  const allSkills: SkillInfo[] = [];
  let availableCount = 0;
  try {
    const providers = getProviders();
    for (const provider of providers) {
      const skills = await provider.list();
      allSkills.push(...skills);
    }
    availableCount = allSkills.length;
  } catch {
    // Offline mode
  }

  // Banner (shown once)
  const installedOnEntry = countInstalled();
  console.log();
  console.log(renderBanner());
  console.log();
  console.log(`  ${AMBER.bold("arcana")} ${chalk.dim(`v${version}`)}`);
  console.log(`  ${chalk.dim("Expert skills for AI coding agents. Install what you need.")}`);
  console.log();

  if (availableCount > 0 && installedOnEntry > 0) {
    if (installedOnEntry > availableCount) {
      console.log(
        `  ${chalk.dim(`${installedOnEntry} installed (${availableCount} in marketplace) | provider: ${providerName}`)}`,
      );
    } else {
      const pct = Math.round((installedOnEntry / availableCount) * 100);
      console.log(
        `  ${chalk.dim(`${installedOnEntry}/${availableCount} installed (${pct}%) | provider: ${providerName}`)}`,
      );
    }
  } else if (availableCount > 0) {
    console.log(`  ${chalk.dim(`${availableCount} skills across ${Object.keys(SKILL_CATEGORIES).length} categories`)}`);
  } else {
    console.log(`  ${chalk.dim(`${installedOnEntry} installed | offline mode`)}`);
  }
  console.log();

  // First-time guided setup
  if (installedOnEntry === 0 && availableCount > 0) {
    const wantsSetup = await p.confirm({
      message: "First time? Let's find the right skills for your project.",
      initialValue: true,
    });
    if (!p.isCancel(wantsSetup) && wantsSetup) {
      await quickSetup(allSkills, providerName);
    }
  }

  // Main loop
  while (true) {
    const installedCount = countInstalled();
    const options = buildMenuOptions(installedCount, availableCount);

    const selected = await p.select({
      message: "What would you like to do?",
      options,
    });

    if (p.isCancel(selected) || selected === "exit") {
      clearProviderCache();
      p.outro(chalk.dim("Until next time."));
      return;
    }

    console.log();

    try {
      switch (selected) {
        case "browse":
          await browseByCategory(allSkills, providerName);
          break;
        case "search":
          await searchFlow(allSkills, providerName);
          break;
        case "setup":
          await quickSetup(allSkills, providerName);
          break;
        case "installed":
          await manageInstalled(allSkills, providerName);
          break;
        case "health":
          await checkHealth();
          break;
        case "ref":
          p.note(getCliReference(), "CLI Reference");
          break;
      }
    } catch (err) {
      if (err instanceof Error) {
        p.log.error(err.message);
      }
    }
  }
}
