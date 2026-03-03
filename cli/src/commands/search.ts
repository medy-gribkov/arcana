import { ui, banner, spinner, noopSpinner, table, printErrorWithHint } from "../utils/ui.js";
import { isSkillInstalled } from "../utils/fs.js";
import { getProviders } from "../registry.js";
import { detectProjectContext } from "../utils/project-context.js";
import type { SkillInfo } from "../types.js";

export async function searchCommand(
  query: string,
  opts: { provider?: string; cache?: boolean; json?: boolean; tag?: string; smart?: boolean },
): Promise<void> {
  if (!opts.json) banner();

  const providers = getProviders(opts.provider);

  if (opts.cache === false) {
    for (const provider of providers) provider.clearCache();
  }
  const s = opts.json ? noopSpinner() : spinner(`Searching for "${query}"...`);
  s.start();

  let results: (SkillInfo & { installed: boolean })[] = [];

  try {
    for (const provider of providers) {
      const skills = await provider.search(query);
      for (const skill of skills) {
        results.push({
          ...skill,
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

  // Filter by tag
  if (opts.tag) {
    const tag = opts.tag.toLowerCase();
    results = results.filter((r) => r.tags?.some((t) => t.toLowerCase() === tag));
  }

  // Smart ranking: boost results matching project context
  if (opts.smart) {
    const context = detectProjectContext(process.cwd());
    results.sort((a, b) => {
      const aScore = (a.tags ?? []).filter((t) => context.tags.includes(t)).length;
      const bScore = (b.tags ?? []).filter((t) => context.tags.includes(t)).length;
      return bScore - aScore;
    });
  }

  s.stop();

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          query,
          results: results.map((r) => ({
            name: r.name,
            description: r.description,
            source: r.source,
            installed: r.installed,
            tags: r.tags,
            verified: r.verified,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (results.length === 0) {
    console.log(ui.dim(`  No skills matching "${query}"${opts.tag ? ` with tag "${opts.tag}"` : ""}`));
  } else {
    console.log(ui.bold(`  ${results.length} results for "${query}":`));
    console.log();
    const rows = results.map((r) => [
      ui.bold(r.name) + (r.verified ? " " + ui.success("[V]") : ""),
      r.description.slice(0, 60) + (r.description.length > 60 ? "..." : ""),
      r.tags?.slice(0, 3).join(", ") ?? "",
      ui.dim(r.source),
      r.installed ? ui.success("[installed]") : "",
    ]);
    table(rows);
  }

  console.log();
}
