import { ui, banner, table, noopSpinner, spinner } from "../utils/ui.js";
import { loadConfig, addProvider, removeProvider } from "../utils/config.js";
import { httpGet } from "../utils/http.js";
import { parseProviderSlug, clearProviderCache } from "../registry.js";

export async function providersCommand(opts: { add?: string; remove?: string; json?: boolean }): Promise<void> {
  /* v8 ignore next */
  if (!opts.json) banner();

  if (opts.add) {
    const { owner, repo } = parseProviderSlug(opts.add);
    const name = `${owner}/${repo}`;
    /* v8 ignore next */
    const s = opts.json ? noopSpinner() : spinner(`Validating ${opts.add}...`);
    s.start();
    try {
      await httpGet(`https://raw.githubusercontent.com/${owner}/${repo}/main/.claude-plugin/marketplace.json`);
      s.succeed(`Provider ${opts.add} verified`);
    } catch {
      try {
        await httpGet(`https://raw.githubusercontent.com/${owner}/${repo}/master/.claude-plugin/marketplace.json`);
        s.succeed(`Provider ${opts.add} verified`);
      } catch {
        if (opts.json) {
          console.log(JSON.stringify({ error: `Could not find marketplace.json at ${opts.add}` }));
          process.exit(1);
        }
        /* v8 ignore start */
        s.fail(`Could not find marketplace.json at ${opts.add}`);
        console.log(ui.dim("  Ensure the repo has .claude-plugin/marketplace.json"));
        console.log();
        process.exit(1);
        /* v8 ignore stop */
      }
    }
    addProvider({ name, type: "github", url: opts.add, enabled: true });
    clearProviderCache();
    if (opts.json) {
      console.log(JSON.stringify({ action: "add", provider: name, success: true }));
      return;
    }
    /* v8 ignore start */
    console.log(ui.success(`  Added provider: ${name}`));
    console.log(ui.dim(`  Use: arcana list --provider ${name}`));
    console.log();
    return;
    /* v8 ignore stop */
  }

  if (opts.remove) {
    if (opts.remove === "arcana") {
      if (opts.json) {
        console.log(JSON.stringify({ error: "Cannot remove the default provider" }));
        process.exit(1);
      }
      /* v8 ignore start */
      console.log(ui.error("  Cannot remove the default provider."));
      console.log();
      process.exit(1);
      /* v8 ignore stop */
    }
    const removed = removeProvider(opts.remove);
    if (removed) clearProviderCache();
    if (opts.json) {
      console.log(JSON.stringify({ action: "remove", provider: opts.remove, success: removed }));
      return;
    }
    /* v8 ignore start */
    if (removed) {
      console.log(ui.success(`  Removed provider: ${opts.remove}`));
    } else {
      console.log(ui.error(`  Provider "${opts.remove}" not found.`));
    }
    console.log();
    return;
    /* v8 ignore stop */
  }

  const config = loadConfig();

  if (opts.json) {
    console.log(
      JSON.stringify({
        providers: config.providers.map((p) => ({
          name: p.name,
          type: p.type,
          url: p.url,
          enabled: p.enabled,
          default: p.name === config.defaultProvider,
        })),
      }),
    );
    return;
  }

  /* v8 ignore start */
  console.log(ui.bold("  Configured providers:"));
  console.log();

  const rows = config.providers.map((p) => [
    p.name === config.defaultProvider ? ui.brand(p.name) + ui.dim(" (default)") : ui.bold(p.name),
    ui.dim(p.type),
    ui.dim(p.url),
    p.enabled ? ui.success("enabled") : ui.dim("disabled"),
  ]);

  table(rows);
  console.log();
  console.log(ui.dim("  Add:    arcana providers --add owner/repo"));
  console.log(ui.dim("  Remove: arcana providers --remove name"));
  console.log();
  /* v8 ignore stop */
}
