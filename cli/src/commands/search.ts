import { ui, banner, spinner, noopSpinner, table, printErrorWithHint } from "../utils/ui.js";
import { isSkillInstalled } from "../utils/fs.js";
import { getProviders } from "../registry.js";

export async function searchCommand(
  query: string,
  opts: { provider?: string; cache?: boolean; json?: boolean },
): Promise<void> {
  if (!opts.json) banner();

  const providers = getProviders(opts.provider);

  if (opts.cache === false) {
    for (const provider of providers) provider.clearCache();
  }
  const s = opts.json ? noopSpinner() : spinner(`Searching for "${query}"...`);
  s.start();

  const results: { name: string; description: string; source: string; installed: boolean }[] = [];

  try {
    for (const provider of providers) {
      const skills = await provider.search(query);
      for (const skill of skills) {
        results.push({
          name: skill.name,
          description: skill.description,
          source: skill.source,
          installed: isSkillInstalled(skill.name),
        });
      }
    }
  } catch (err) {
    if (opts.json) {
      console.log(JSON.stringify({ error: err instanceof Error ? err.message : "Search failed" }));
      process.exit(1);
    }
    s.fail("Search failed due to a network or provider error.");
    printErrorWithHint(err, true);
    process.exit(1);
  }

  s.stop();

  if (opts.json) {
    console.log(JSON.stringify({ query, results }, null, 2));
    return;
  }

  if (results.length === 0) {
    console.log(ui.dim(`  No skills matching "${query}"`));
  } else {
    console.log(ui.bold(`  ${results.length} results for "${query}":`));
    console.log();
    const rows = results.map((r) => [
      ui.bold(r.name),
      r.description.slice(0, 80) + (r.description.length > 80 ? "..." : ""),
      ui.dim(r.source),
      r.installed ? ui.success("[installed]") : "",
    ]);
    table(rows);
  }

  console.log();
}
