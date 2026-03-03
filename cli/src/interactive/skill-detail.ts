import { existsSync, rmSync } from "node:fs";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { isSkillInstalled, readSkillMeta, getSkillDir } from "../utils/fs.js";
import { getProvider } from "../registry.js";
import { appendHistory } from "../utils/history.js";
import { installOneCore } from "../utils/install-core.js";
import type { SkillInfo } from "../types.js";
import { removeSymlinksFor } from "../commands/uninstall.js";
import { ui } from "../utils/ui.js";
import { handleCancel } from "./helpers.js";
import { getCategoryFor, getRelatedSkills } from "./categories.js";

async function doInstall(skillName: string, providerName: string): Promise<boolean> {
  const provider = getProvider(providerName);
  const s = p.spinner();
  s.start(`Installing ${chalk.bold(skillName)}...`);
  try {
    const result = await installOneCore(skillName, provider, {});
    if (!result.success) {
      s.stop(`Failed to install ${skillName}`);
      if (result.error) p.log.error(ui.dim(result.error));
      return false;
    }
    s.stop(`Installed ${chalk.bold(skillName)} (${result.files?.length ?? 0} files)`);
    appendHistory("install", skillName);
    return true;
  } catch (err) {
    s.stop(`Failed to install ${skillName}`);
    if (err instanceof Error) p.log.error(ui.dim(err.message));
    return false;
  }
}

function doUninstall(skillName: string): boolean {
  const skillDir = getSkillDir(skillName);
  if (!existsSync(skillDir)) return false;
  try {
    rmSync(skillDir, { recursive: true, force: true });
    removeSymlinksFor(skillName);
    appendHistory("uninstall", skillName);
    return true;
  } catch {
    return false;
  }
}

export async function skillDetailFlow(
  skillName: string,
  allSkills: SkillInfo[],
  providerName: string,
): Promise<"back" | "menu"> {
  const info = allSkills.find((s) => s.name === skillName);
  const installed = isSkillInstalled(skillName);
  const meta = installed ? readSkillMeta(skillName) : null;

  // Build info block
  const lines: string[] = [];
  lines.push(`${chalk.bold(skillName)} ${info ? `v${info.version}` : ""}`);
  if (info?.description) lines.push(info.description);
  lines.push("");

  if (info?.verified) lines.push(`Trust: ${chalk.green("Verified")} (official)`);
  else lines.push(`Trust: Community`);
  if (info?.author) lines.push(`Author: ${info.author}`);
  if (info?.tags && info.tags.length > 0) lines.push(`Tags: ${info.tags.join(", ")}`);

  const category = getCategoryFor(skillName);
  if (category) lines.push(`Category: ${category}`);
  if (info?.source) lines.push(`Source: ${info.source}`);

  if (info?.companions && info.companions.length > 0) {
    lines.push(`Companions: ${info.companions.join(", ")}`);
  }
  if (info?.conflicts && info.conflicts.length > 0) {
    lines.push(`${chalk.red("Conflicts:")} ${info.conflicts.join(", ")}`);
  }

  if (installed && meta) {
    const date = meta.installedAt ? new Date(meta.installedAt).toLocaleDateString() : "";
    lines.push(`Status: ${chalk.green("installed")} (v${meta.version}${date ? `, ${date}` : ""})`);
  } else {
    lines.push(`Status: ${chalk.dim("not installed")}`);
  }

  const related = getRelatedSkills(skillName);
  if (related.length > 0) {
    lines.push(`Related: ${related.join(", ")}`);
  }

  p.note(lines.join("\n"), skillName);

  // Action menu
  const actions: { value: string; label: string }[] = [];
  if (installed) {
    actions.push({ value: "reinstall", label: "Reinstall (overwrite)" });
    actions.push({ value: "uninstall", label: "Uninstall (remove files)" });
  } else {
    actions.push({ value: "install", label: "Install this skill" });
  }
  actions.push({ value: "back", label: "Back" });

  const action = await p.select({ message: "Action", options: actions });
  handleCancel(action);

  switch (action) {
    case "install":
    case "reinstall": {
      await doInstall(skillName, providerName);
      return "back";
    }
    case "uninstall": {
      const ok = await p.confirm({ message: `Uninstall ${chalk.bold(skillName)}?` });
      handleCancel(ok);
      if (ok) {
        const success = doUninstall(skillName);
        if (success) {
          p.log.success(`Removed ${chalk.bold(skillName)}`);
        } else {
          p.log.error(`Failed to remove ${skillName}`);
        }
      }
      return "back";
    }
    default:
      return "back";
  }
}

export { doInstall, doUninstall };
