import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import semver from "semver";
import { getInstallDir, readSkillMeta } from "../utils/fs.js";
import { getProvider, getProviders } from "../registry.js";
import { loadConfig } from "../utils/config.js";

interface OutdatedEntry {
  name: string;
  current: string;
  available: string;
  source: string;
}

interface OutdatedResult {
  outdated: OutdatedEntry[];
  upToDate: number;
  total: number;
}

function listInstalledSkills(installDir: string): string[] {
  if (!existsSync(installDir)) return [];

  let entries: string[];
  try {
    entries = readdirSync(installDir);
  } catch {
    return [];
  }

  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = join(installDir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory() && existsSync(join(fullPath, "SKILL.md"))) {
        results.push(entry);
      }
    } catch {
      // skip unreadable
    }
  }

  return results;
}

export async function outdatedCommand(opts: { provider?: string; json?: boolean }): Promise<void> {
  const installDir = getInstallDir();
  const skills = listInstalledSkills(installDir);

  if (skills.length === 0) {
    if (opts.json) {
      console.log(JSON.stringify({ outdated: [], upToDate: 0, total: 0 }));
      process.exit(0);
    }
    /* v8 ignore next 2 */
    console.log("No skills installed.");
    process.exit(0);
  }

  const providerName = opts.provider ?? loadConfig().defaultProvider;
  const providers = opts.provider ? [getProvider(providerName)] : getProviders();

  if (providers.length === 0) {
    if (opts.json) {
      console.log(
        JSON.stringify({
          error: "No providers configured",
          outdated: [],
          upToDate: 0,
          total: 0,
        }),
      );
      process.exit(0);
    }
    /* v8 ignore next 2 */
    console.error("No providers configured. Run: arcana providers --add owner/repo");
    process.exit(0);
  }

  const outdated: OutdatedEntry[] = [];
  let upToDate = 0;
  let checked = 0;

  for (const skillName of skills) {
    const meta = readSkillMeta(skillName);
    const localVersion = meta?.version ?? "0.0.0";
    const preferredSource = meta?.source;

    // Try the provider that installed this skill first, then fall back to others
    const orderedProviders = [...providers];
    if (preferredSource) {
      const idx = orderedProviders.findIndex((p) => p.name === preferredSource);
      if (idx > 0) {
        const [pref] = orderedProviders.splice(idx, 1);
        orderedProviders.unshift(pref!);
      }
    }

    let found = false;
    for (const provider of orderedProviders) {
      try {
        const remoteInfo = await provider.info(skillName);
        if (!remoteInfo) continue;

        const remoteVersion = remoteInfo.version;
        const coercedRemote = semver.valid(semver.coerce(remoteVersion)) ?? "0.0.0";
        const coercedLocal = semver.valid(semver.coerce(localVersion)) ?? "0.0.0";

        if (semver.gt(coercedRemote, coercedLocal)) {
          outdated.push({
            name: skillName,
            current: localVersion,
            available: remoteVersion,
            source: provider.name,
          });
        } else {
          upToDate++;
        }

        found = true;
        checked++;
        break;
      } catch {
        // try next provider
      }
    }

    if (!found) {
      // Could not check this skill, count it as up-to-date for totals
      upToDate++;
      checked++;
    }
  }

  const result: OutdatedResult = {
    outdated,
    upToDate,
    total: checked,
  };

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  /* v8 ignore start -- display-only console table output */
  // Console output: aligned table
  console.log(`Checked ${result.total} installed skills.`);
  console.log();

  if (outdated.length === 0) {
    console.log("All skills are up to date.");
    process.exit(0);
  }

  // Calculate column widths
  const nameWidth = Math.max(4, ...outdated.map((e) => e.name.length));
  const currentWidth = Math.max(7, ...outdated.map((e) => e.current.length));
  const availableWidth = Math.max(9, ...outdated.map((e) => e.available.length));
  const sourceWidth = Math.max(6, ...outdated.map((e) => e.source.length));

  const header =
    "Name".padEnd(nameWidth) +
    "  " +
    "Current".padEnd(currentWidth) +
    "  " +
    "Available".padEnd(availableWidth) +
    "  " +
    "Source".padEnd(sourceWidth);

  const separator =
    "-".repeat(nameWidth) +
    "  " +
    "-".repeat(currentWidth) +
    "  " +
    "-".repeat(availableWidth) +
    "  " +
    "-".repeat(sourceWidth);

  console.log(header);
  console.log(separator);

  for (const entry of outdated) {
    console.log(
      entry.name.padEnd(nameWidth) +
        "  " +
        entry.current.padEnd(currentWidth) +
        "  " +
        entry.available.padEnd(availableWidth) +
        "  " +
        entry.source.padEnd(sourceWidth),
    );
  }

  console.log();
  console.log(`${outdated.length} outdated, ${upToDate} up to date, ${result.total} total`);

  process.exit(0);
  /* v8 ignore stop */
}
