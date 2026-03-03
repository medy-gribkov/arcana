import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ui, banner, spinner, noopSpinner, table, printErrorWithHint } from "../utils/ui.js";
import { isSkillInstalled, getInstallDir, readSkillMeta } from "../utils/fs.js";
import { getProviders } from "../registry.js";

const DESC_TRUNCATE_LENGTH = 80;

export async function listCommand(opts: {
  provider?: string;
  all?: boolean;
  cache?: boolean;
  installed?: boolean;
  json?: boolean;
}): Promise<void> {
  if (!opts.json) banner();

  if (opts.installed) {
    listInstalled(opts.json);
    return;
  }

  const providers = getProviders(opts.all ? undefined : opts.provider);

  if (opts.cache === false) {
    for (const provider of providers) provider.clearCache();
  }

  const s = opts.json ? noopSpinner() : spinner("Fetching skills...");
  s.start();

  try {
    const skills: {
      name: string;
      version: string;
      description: string;
      source: string;
      installed: boolean;
      verified?: boolean;
      tags?: string[];
    }[] = [];

    for (const provider of providers) {
      const results = await provider.list();
      for (const skill of results) {
        skills.push({
          name: skill.name,
          version: skill.version,
          description: skill.description,
          source: skill.source,
          installed: isSkillInstalled(skill.name),
          verified: skill.verified,
          tags: skill.tags,
        });
      }
    }

    s.stop();

    if (opts.json) {
      console.log(JSON.stringify({ skills }, null, 2));
      return;
    }

    if (skills.length === 0) {
      console.log(ui.dim("  No skills found."));
    } else {
      console.log(ui.bold(`  ${skills.length} skills available:`));
      console.log();
      const rows = skills.map((skill) => [
        ui.bold(skill.name) + (skill.verified ? " " + ui.success("[V]") : ""),
        ui.dim(`v${skill.version}`),
        skill.description.slice(0, DESC_TRUNCATE_LENGTH) +
          (skill.description.length > DESC_TRUNCATE_LENGTH ? "..." : ""),
        skill.tags?.slice(0, 3).join(", ") ?? "",
        providers.length > 1 ? ui.dim(skill.source) : "",
        skill.installed ? ui.success("[installed]") : "",
      ]);
      table(rows);
    }

    console.log();
  } catch (err) {
    if (opts.json) {
      console.log(JSON.stringify({ error: err instanceof Error ? err.message : "Failed to fetch skills" }));
      process.exit(1);
    }
    s.fail("Failed to fetch skills");
    printErrorWithHint(err, true);
    process.exit(1);
  }
}

function listInstalled(json?: boolean): void {
  const installDir = getInstallDir();
  const dirs = existsSync(installDir)
    ? readdirSync(installDir).filter((d) => statSync(join(installDir, d)).isDirectory())
    : [];

  if (json) {
    const skills = dirs.map((name) => {
      const meta = readSkillMeta(name);
      return {
        name,
        version: meta?.version ?? "unknown",
        source: meta?.source ?? "local",
        installedAt: meta?.installedAt ?? null,
      };
    });
    console.log(JSON.stringify({ skills }, null, 2));
    return;
  }

  if (dirs.length === 0) {
    console.log(ui.dim("  No skills installed."));
    console.log();
    return;
  }

  const rows: string[][] = [];
  for (const name of dirs) {
    const meta = readSkillMeta(name);
    rows.push([
      ui.bold(name),
      ui.dim(meta ? `v${meta.version}` : "unknown"),
      ui.dim(meta?.source ?? "local"),
      ui.dim(meta?.installedAt ? new Date(meta.installedAt).toLocaleDateString() : ""),
    ]);
  }

  console.log(ui.bold(`  ${rows.length} skills installed:`));
  console.log();
  table(rows);
  console.log();
}
