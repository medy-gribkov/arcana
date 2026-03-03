import { existsSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { isSkillInstalled } from "../utils/fs.js";
import { handleCancel } from "./helpers.js";
import { doBatchInstall } from "./browse.js";
export async function quickSetup(allSkills, providerName) {
    const { detectProject, SKILL_SUGGESTIONS, SKILL_SUGGESTIONS_DEFAULT } = await import("../commands/init.js");
    const proj = detectProject(process.cwd());
    p.log.step(`Detected: ${chalk.cyan(proj.name)} (${proj.type})`);
    const suggestions = SKILL_SUGGESTIONS[proj.type] ?? SKILL_SUGGESTIONS_DEFAULT;
    const availableNames = new Set(allSkills.map((s) => s.name));
    const validSuggestions = suggestions.filter((s) => availableNames.has(s));
    if (validSuggestions.length === 0) {
        p.log.info("No specific recommendations for this project type.");
        return;
    }
    const notInstalled = validSuggestions.filter((s) => !isSkillInstalled(s));
    if (notInstalled.length === 0) {
        p.log.success("All recommended skills are already installed.");
        return;
    }
    const options = validSuggestions.map((name) => {
        const installed = isSkillInstalled(name);
        return {
            value: name,
            label: `${name}${installed ? chalk.green(" \u2713 installed") : ""}`,
            hint: installed ? "already installed" : "not installed",
        };
    });
    const selected = await p.multiselect({
        message: `Recommended skills for ${proj.type}`,
        options,
        required: false,
    });
    handleCancel(selected);
    const toInstall = selected.filter((s) => !isSkillInstalled(s));
    if (toInstall.length > 0) {
        await doBatchInstall(toInstall, providerName);
    }
    else if (selected.length > 0) {
        p.log.info("All selected skills are already installed.");
    }
    if (!existsSync(join(process.cwd(), "CLAUDE.md"))) {
        p.log.info(`Tip: Run ${chalk.cyan("arcana init")} to create project config files.`);
    }
}
