import * as p from "@clack/prompts";
import chalk from "chalk";
import { isSkillInstalled } from "../utils/fs.js";
import { getProvider } from "../registry.js";
import { installOneCore } from "../utils/install-core.js";
import { appendHistory } from "../utils/history.js";
import { ui } from "../utils/ui.js";
import type { SkillInfo } from "../types.js";
import { handleCancel, truncate } from "./helpers.js";
import { SKILL_CATEGORIES } from "./categories.js";
import { skillDetailFlow } from "./skill-detail.js";

async function doBatchInstall(names: string[], providerName: string): Promise<number> {
  if (names.length === 0) return 0;
  const provider = getProvider(providerName);
  const s = p.spinner();
  s.start(`Installing ${names.length} skill${names.length > 1 ? "s" : ""}...`);
  let installed = 0;
  for (const name of names) {
    try {
      s.message(`Installing ${chalk.bold(name)} (${installed + 1}/${names.length})...`);
      const result = await installOneCore(name, provider, {});
      if (result.success) {
        installed++;
        appendHistory("install", name);
      }
    } catch (err) {
      s.stop(`Failed: ${name}`);
      if (err instanceof Error) p.log.error(ui.dim(err.message));
      if (installed + 1 < names.length) s.start(`Installing next...`);
    }
  }
  s.stop(`Installed ${installed} skill${installed !== 1 ? "s" : ""}`);
  return installed;
}

export async function browseByCategory(allSkills: SkillInfo[], providerName: string): Promise<void> {
  const availableNames = new Set(allSkills.map((s) => s.name));

  while (true) {
    const categoryOptions = Object.entries(SKILL_CATEGORIES).map(([name, skills]) => {
      const valid = skills.filter((s) => availableNames.has(s));
      const installedCount = valid.filter((s) => isSkillInstalled(s)).length;
      return {
        value: name,
        label: name,
        hint: `${valid.length} skills, ${installedCount} installed`,
      };
    });

    const category = await p.select({
      message: "Browse > Select category",
      options: [...categoryOptions, { value: "__back", label: "Back" }],
    });
    handleCancel(category);
    if (category === "__back") return;

    await categorySkillList(category as string, SKILL_CATEGORIES[category as string] ?? [], allSkills, providerName);
  }
}

async function categorySkillList(
  categoryName: string,
  skillNames: string[],
  allSkills: SkillInfo[],
  providerName: string,
): Promise<void> {
  const availableNames = new Set(allSkills.map((s) => s.name));
  const validSkills = skillNames.filter((s) => availableNames.has(s));

  if (validSkills.length === 0) {
    p.log.warn("No skills found in this category.");
    return;
  }

  while (true) {
    const options = validSkills.map((name) => {
      const info = allSkills.find((s) => s.name === name);
      const installed = isSkillInstalled(name);
      return {
        value: name,
        label: `${name}${installed ? chalk.green(" \u2713") : ""}`,
        hint: truncate(info?.description ?? "", 50),
      };
    });

    const notInstalled = validSkills.filter((s) => !isSkillInstalled(s));
    const extraOptions: { value: string; label: string; hint?: string }[] = [];
    if (notInstalled.length > 0) {
      extraOptions.push({
        value: "__install_all",
        label: `Install all uninstalled`,
        hint: `${notInstalled.length} skill${notInstalled.length > 1 ? "s" : ""}`,
      });
    }
    extraOptions.push({ value: "__back", label: "Back to categories" });

    const picked = await p.select({
      message: `Browse > ${categoryName}`,
      options: [...options, ...extraOptions],
    });
    handleCancel(picked);

    if (picked === "__back") return;
    if (picked === "__install_all") {
      await doBatchInstall(notInstalled, providerName);
      continue;
    }

    const result = await skillDetailFlow(picked as string, allSkills, providerName);
    if (result === "menu") return;
  }
}

export { doBatchInstall };
