import { existsSync, readdirSync, readFileSync, statSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getInstallDir } from "../utils/fs.js";
import { atomicWriteSync } from "../utils/atomic.js";
import { LOADED_FILENAME } from "../constants.js";
import { ui, banner } from "../utils/ui.js";
import { recordLoad } from "../utils/usage.js";

/** Read full content of a skill (SKILL.md + references/ + rules/). */
export function readSkillContent(skillName: string): { content: string; files: number; bytes: number } | null {
  const installDir = getInstallDir();
  const skillDir = join(installDir, skillName);
  if (!existsSync(skillDir)) return null;

  const skillMd = join(skillDir, "SKILL.md");
  if (!existsSync(skillMd)) return null;

  const parts: string[] = [];
  let totalBytes = 0;
  let fileCount = 0;

  // Main SKILL.md
  const mainContent = readFileSync(skillMd, "utf-8");
  parts.push(mainContent);
  totalBytes += mainContent.length;
  fileCount++;

  // References directory (if exists)
  const refsDir = join(skillDir, "references");
  if (existsSync(refsDir)) {
    try {
      for (const ref of readdirSync(refsDir).sort()) {
        const refPath = join(refsDir, ref);
        if (!statSync(refPath).isFile()) continue;
        const refContent = readFileSync(refPath, "utf-8");
        parts.push(`\n---\n\n## Reference: ${ref}\n\n${refContent}`);
        totalBytes += refContent.length;
        fileCount++;
      }
    } catch {
      /* skip unreadable refs */
    }
  }

  // Rules directory (if exists)
  const rulesDir = join(skillDir, "rules");
  if (existsSync(rulesDir)) {
    try {
      for (const rule of readdirSync(rulesDir).sort()) {
        const rulePath = join(rulesDir, rule);
        if (!statSync(rulePath).isFile()) continue;
        const ruleContent = readFileSync(rulePath, "utf-8");
        parts.push(`\n---\n\n## Rule: ${rule}\n\n${ruleContent}`);
        totalBytes += ruleContent.length;
        fileCount++;
      }
    } catch {
      /* skip unreadable rules */
    }
  }

  return { content: parts.join("\n"), files: fileCount, bytes: totalBytes };
}

export async function loadCommand(
  skillNames: string[],
  opts: { json?: boolean; append?: boolean },
): Promise<void> {
  if (skillNames.length === 0) {
    if (opts.json) {
      console.log(JSON.stringify({ error: "Specify one or more skill names" }));
    } else {
      console.error("Specify one or more skill names.");
      console.error("Usage: arcana load <skill> [skill2 ...]");
      console.error("       arcana load golang-pro typescript --append");
    }
    process.exit(1);
  }

  const results: { name: string; files: number; bytes: number; error?: string }[] = [];
  const loadedParts: string[] = [];

  for (const name of skillNames) {
    const result = readSkillContent(name);
    if (!result) {
      results.push({ name, files: 0, bytes: 0, error: `Skill "${name}" not found` });
      continue;
    }
    results.push({ name, files: result.files, bytes: result.bytes });
    loadedParts.push(result.content);
    try { recordLoad(name); } catch { /* best-effort */ }
  }

  if (opts.json) {
    console.log(
      JSON.stringify({
        loaded: results.filter((r) => !r.error).map((r) => ({ name: r.name, files: r.files, bytes: r.bytes })),
        failed: results.filter((r) => r.error).map((r) => ({ name: r.name, error: r.error })),
      }),
    );
    return;
  }

  if (opts.append) {
    // Write aggregated content to _loaded.md
    const installDir = getInstallDir();
    mkdirSync(installDir, { recursive: true });
    const loadedPath = join(installDir, LOADED_FILENAME);
    const content = loadedParts.join("\n\n---\n\n");
    atomicWriteSync(loadedPath, content, 0o644);

    banner();
    console.log(ui.bold("  Load Skills\n"));

    for (const r of results) {
      if (r.error) {
        console.log(`  ${ui.warn("[!!]")} ${r.name}: ${r.error}`);
      } else {
        console.log(`  ${ui.success("[OK]")} ${r.name} (${r.files} files, ${(r.bytes / 1024).toFixed(1)} KB)`);
      }
    }
    console.log();
    console.log(ui.dim(`  Written to: ${loadedPath}`));
    console.log();
  } else {
    // Print to stdout for piping
    for (const r of results) {
      if (r.error) {
        console.error(`Error: ${r.error}`);
        continue;
      }
    }
    process.stdout.write(loadedParts.join("\n\n---\n\n"));
  }
}
