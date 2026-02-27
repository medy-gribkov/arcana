import { existsSync, readFileSync, readdirSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { getInstallDir, readSkillMeta } from "../utils/fs.js";
import { getProvider } from "../registry.js";
import { loadConfig } from "../utils/config.js";
import { validateSlug } from "../utils/validate.js";
import type { SkillFile } from "../types.js";

interface LocalFile {
  path: string;
  content: string;
}

interface ModifiedEntry {
  path: string;
  linesAdded: number;
  linesRemoved: number;
}

interface DiffResult {
  skill: string;
  localVersion: string;
  remoteVersion: string;
  added: string[];
  removed: string[];
  modified: ModifiedEntry[];
}

function readDirRecursive(dir: string): LocalFile[] {
  const results: LocalFile[] = [];
  const queue: Array<{ fullDir: string; relPrefix: string }> = [
    { fullDir: dir, relPrefix: "" },
  ];

  while (queue.length > 0) {
    const { fullDir, relPrefix } = queue.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(fullDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = join(fullDir, entry);
      try {
        const stat = lstatSync(fullPath);
        if (stat.isSymbolicLink()) continue;
        const relPath = relPrefix ? `${relPrefix}/${entry}` : entry;
        if (stat.isDirectory()) {
          queue.push({ fullDir: fullPath, relPrefix: relPath });
        } else {
          results.push({
            path: relPath,
            content: readFileSync(fullPath, "utf-8"),
          });
        }
      } catch {
        // skip unreadable entries
      }
    }
  }

  return results;
}

function computeLineDiff(
  localContent: string,
  remoteContent: string,
): { linesAdded: number; linesRemoved: number } {
  const localLines = localContent.split("\n");
  const remoteLines = remoteContent.split("\n");

  const localSet = new Set(localLines);
  const remoteSet = new Set(remoteLines);

  let linesAdded = 0;
  let linesRemoved = 0;

  for (const line of remoteLines) {
    if (!localSet.has(line)) {
      linesAdded++;
    }
  }

  for (const line of localLines) {
    if (!remoteSet.has(line)) {
      linesRemoved++;
    }
  }

  return { linesAdded, linesRemoved };
}

export async function diffCommand(
  skill: string,
  opts: { provider?: string; json?: boolean },
): Promise<void> {
  try {
    validateSlug(skill, "skill name");
  } catch (err) {
    console.error(err instanceof Error ? err.message : "Invalid skill name");
    process.exit(1);
  }

  const installDir = getInstallDir();
  const skillDir = join(installDir, skill);

  if (!existsSync(skillDir)) {
    console.error(`Skill "${skill}" is not installed.`);
    process.exit(1);
  }

  const providerName = opts.provider ?? loadConfig().defaultProvider;
  const provider = getProvider(providerName);

  let remoteFiles: SkillFile[];
  try {
    remoteFiles = await provider.fetch(skill);
  } catch (err) {
    console.error(
      `Failed to fetch remote skill "${skill}": ${err instanceof Error ? err.message : "unknown error"}`,
    );
    process.exit(1);
  }

  const localFiles = readDirRecursive(skillDir);
  const meta = readSkillMeta(skill);
  const localVersion = meta?.version ?? "0.0.0";

  let remoteVersion = "0.0.0";
  try {
    const remoteInfo = await provider.info(skill);
    if (remoteInfo) {
      remoteVersion = remoteInfo.version;
    }
  } catch {
    // keep default
  }

  const localMap = new Map<string, string>();
  for (const file of localFiles) {
    localMap.set(file.path, file.content);
  }

  const remoteMap = new Map<string, string>();
  for (const file of remoteFiles) {
    remoteMap.set(file.path, file.content);
  }

  const added: string[] = [];
  const removed: string[] = [];
  const modified: ModifiedEntry[] = [];

  for (const [path] of remoteMap) {
    if (!localMap.has(path)) {
      added.push(path);
    }
  }

  for (const [path] of localMap) {
    if (!remoteMap.has(path)) {
      removed.push(path);
    }
  }

  for (const [path, remoteContent] of remoteMap) {
    const localContent = localMap.get(path);
    if (localContent !== undefined && localContent !== remoteContent) {
      const { linesAdded, linesRemoved } = computeLineDiff(
        localContent,
        remoteContent,
      );
      modified.push({ path, linesAdded, linesRemoved });
    }
  }

  const result: DiffResult = {
    skill,
    localVersion,
    remoteVersion,
    added,
    removed,
    modified,
  };

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Console output
  console.log(`Diff: ${skill}`);
  console.log(`  Local version:  ${localVersion}`);
  console.log(`  Remote version: ${remoteVersion}`);
  console.log();

  if (added.length === 0 && removed.length === 0 && modified.length === 0) {
    console.log("  No differences found.");
    return;
  }

  if (added.length > 0) {
    console.log(`  Added (${added.length}):`);
    for (const path of added) {
      console.log(`    + ${path}`);
    }
  }

  if (removed.length > 0) {
    console.log(`  Removed (${removed.length}):`);
    for (const path of removed) {
      console.log(`    - ${path}`);
    }
  }

  if (modified.length > 0) {
    console.log(`  Modified (${modified.length}):`);
    for (const entry of modified) {
      console.log(
        `    ~ ${entry.path}  (+${entry.linesAdded} / -${entry.linesRemoved})`,
      );
    }
  }
}
