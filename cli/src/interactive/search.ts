import * as p from "@clack/prompts";
import chalk from "chalk";
import { isSkillInstalled } from "../utils/fs.js";
import { getProvider } from "../registry.js";
import { ui } from "../utils/ui.js";
import { appendHistory } from "../utils/history.js";
import type { SkillInfo } from "../types.js";
import { handleCancel, truncate } from "./helpers.js";
import { skillDetailFlow } from "./skill-detail.js";

export async function searchFlow(allSkills: SkillInfo[], providerName: string): Promise<void> {
  while (true) {
    const query = await p.text({
      message: "Search for:",
      placeholder: "e.g. testing, review, golang",
      validate: (v) => (!v || v.trim().length === 0 ? "Enter a search term" : undefined),
    });
    handleCancel(query);

    const provider = getProvider(providerName);
    const s = p.spinner();
    s.start(`Searching "${query as string}"...`);
    let results: SkillInfo[];
    try {
      results = await provider.search(query as string);
    } catch (err) {
      s.stop("Search failed");
      if (err instanceof Error) p.log.error(ui.dim(err.message));
      return;
    }
    s.stop(`${results.length} result${results.length !== 1 ? "s" : ""}`);
    appendHistory("search", query as string);

    if (results.length === 0) {
      p.log.info("No skills matched. Try a different query.");
      const again = await p.confirm({ message: "Search again?" });
      handleCancel(again);
      if (!again) return;
      continue;
    }

    const nav = await searchResultsPicker(results, allSkills, providerName);
    if (nav === "done") return;
    // "search" continues the loop
  }
}

async function searchResultsPicker(
  results: SkillInfo[],
  allSkills: SkillInfo[],
  providerName: string,
): Promise<"done" | "search"> {
  while (true) {
    const options = results.map((skill) => ({
      value: skill.name,
      label: `${skill.name}${isSkillInstalled(skill.name) ? chalk.green(" \u2713") : ""}`,
      hint: truncate(skill.description, 50),
    }));

    const picked = await p.select({
      message: `Search > Results`,
      options: [...options, { value: "__search", label: "Search again" }, { value: "__back", label: "Back" }],
    });
    handleCancel(picked);

    if (picked === "__search") return "search";
    if (picked === "__back") return "done";

    const result = await skillDetailFlow(picked as string, allSkills, providerName);
    if (result === "menu") return "done";
  }
}
