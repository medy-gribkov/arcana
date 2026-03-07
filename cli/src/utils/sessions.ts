import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/** Find the most recent session JSONL for the current project. */
export function findLatestSession(cwd: string): string | null {
  const projectsDir = join(homedir(), ".claude", "projects");
  if (!existsSync(projectsDir)) return null;

  // Encode the project path the way Claude Code does
  const encoded = cwd.replace(/[:/\\]/g, "-").replace(/^-+/, "");
  const variants = [encoded, encoded.toLowerCase()];

  for (const variant of variants) {
    const projDir = join(projectsDir, variant);
    if (!existsSync(projDir)) continue;

    // Find newest .jsonl file
    let newest: { path: string; mtime: number } | null = null;
    try {
      for (const file of readdirSync(projDir)) {
        if (!file.endsWith(".jsonl")) continue;
        const fullPath = join(projDir, file);
        const stat = statSync(fullPath);
        if (!newest || stat.mtimeMs > newest.mtime) {
          newest = { path: fullPath, mtime: stat.mtimeMs };
        }
      }
    } catch {
      continue;
    }
    if (newest) return newest.path;
  }

  return null;
}
