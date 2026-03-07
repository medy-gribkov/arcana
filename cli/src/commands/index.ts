import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { getInstallDir } from "../utils/fs.js";
import { atomicWriteSync } from "../utils/atomic.js";
import { INDEX_FILENAME } from "../constants.js";
import { ui, banner } from "../utils/ui.js";

interface SkillEntry {
  name: string;
  description: string;
}

/** Parse frontmatter description from a SKILL.md file. */
function extractDescription(skillDir: string): string {
  const skillMd = join(skillDir, "SKILL.md");
  if (!existsSync(skillMd)) return "";
  try {
    const content = readFileSync(skillMd, "utf-8");
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return "";
    const fmLine = match[1]!.split("\n").find((l) => l.startsWith("description:"));
    if (!fmLine) return "";
    // Strip quotes and trim
    return fmLine
      .replace(/^description:\s*/, "")
      .replace(/^["']|["']$/g, "")
      .trim();
  } catch {
    return "";
  }
}

/** Collect all installed skills with their descriptions. */
function collectSkillEntries(): SkillEntry[] {
  const installDir = getInstallDir();
  if (!existsSync(installDir)) return [];

  const entries: SkillEntry[] = [];
  for (const name of readdirSync(installDir).sort()) {
    const skillDir = join(installDir, name);
    try {
      if (!statSync(skillDir).isDirectory()) continue;
    } catch {
      continue;
    }
    // Skip index and loaded files
    if (name.startsWith("_")) continue;
    const description = extractDescription(skillDir);
    entries.push({ name, description });
  }
  return entries;
}

/** Generate the index markdown content. */
function generateIndexContent(entries: SkillEntry[]): string {
  const lines: string[] = [];
  lines.push(`# Installed Skills (${entries.length})`);
  lines.push("");
  lines.push("| Skill | Description |");
  lines.push("|-------|-------------|");
  for (const entry of entries) {
    // Truncate description to keep index compact
    const desc = entry.description.length > 120 ? entry.description.slice(0, 117) + "..." : entry.description;
    lines.push(`| ${entry.name} | ${desc} |`);
  }
  lines.push("");
  lines.push("To load a skill into context: `arcana load <skill-name>`");
  lines.push("");
  return lines.join("\n");
}

/** Regenerate the skill index file. Returns the number of skills indexed. */
export function regenerateIndex(): number {
  const entries = collectSkillEntries();
  const installDir = getInstallDir();
  if (!existsSync(installDir)) return 0;

  const indexPath = join(installDir, INDEX_FILENAME);
  const content = generateIndexContent(entries);
  atomicWriteSync(indexPath, content, 0o644);
  return entries.length;
}

export async function indexCommand(opts: { json?: boolean }): Promise<void> {
  if (!opts.json) {
    banner();
    console.log(ui.bold("  Skill Index\n"));
  }

  const count = regenerateIndex();
  const installDir = getInstallDir();
  const indexPath = join(installDir, INDEX_FILENAME);

  if (opts.json) {
    console.log(
      JSON.stringify({
        indexed: count,
        path: indexPath,
      }),
    );
    return;
  }

  if (count === 0) {
    console.log(ui.dim("  No skills installed."));
  } else {
    console.log(ui.success(`  [OK]`) + ` Indexed ${count} skills`);
    console.log(ui.dim(`  Path: ${indexPath}`));
    console.log();
    console.log(ui.dim("  Agents load this index instead of all skills at once."));
    console.log(ui.dim("  Use arcana load <skill> to load full skill content on demand."));
  }
  console.log();
}
