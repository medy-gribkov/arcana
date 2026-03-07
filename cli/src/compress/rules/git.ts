import { registerRule } from "../engine.js";

registerRule({
  name: "git-status",
  tools: ["git"],
  compress(lines: string[]): string[] {
    // Detect git status output and compact it
    const isStatus = lines.some((l) => /^(On branch|Changes|Untracked|modified:|new file:|deleted:)/.test(l.trim()));
    if (!isStatus) return lines;

    const result: string[] = [];
    let branch = "";
    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];

    let section: "none" | "staged" | "unstaged" | "untracked" = "none";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("On branch ")) {
        branch = trimmed.replace("On branch ", "");
      } else if (trimmed.startsWith("Changes to be committed")) {
        section = "staged";
      } else if (trimmed.startsWith("Changes not staged")) {
        section = "unstaged";
      } else if (trimmed.startsWith("Untracked files")) {
        section = "untracked";
      } else if (/^\s*(modified|new file|deleted|renamed|copied):/.test(line)) {
        const file = trimmed.replace(/^(modified|new file|deleted|renamed|copied):\s*/, "");
        if (section === "staged") staged.push(file);
        else unstaged.push(file);
      } else if (section === "untracked" && trimmed && !trimmed.startsWith("(") && !trimmed.startsWith("no changes")) {
        untracked.push(trimmed);
      }
    }

    if (branch) result.push(`branch: ${branch}`);
    if (staged.length > 0)
      result.push(
        `staged (${staged.length}): ${staged.slice(0, 5).join(", ")}${staged.length > 5 ? ` +${staged.length - 5}` : ""}`,
      );
    if (unstaged.length > 0)
      result.push(
        `modified (${unstaged.length}): ${unstaged.slice(0, 5).join(", ")}${unstaged.length > 5 ? ` +${unstaged.length - 5}` : ""}`,
      );
    if (untracked.length > 0)
      result.push(
        `untracked (${untracked.length}): ${untracked.slice(0, 3).join(", ")}${untracked.length > 3 ? ` +${untracked.length - 3}` : ""}`,
      );
    if (result.length === 0) result.push("clean");

    return result.length > 0 ? result : lines;
  },
});

registerRule({
  name: "git-log",
  tools: ["git"],
  compress(lines: string[]): string[] {
    // Detect git log output (lines starting with "commit ")
    const isLog = lines.some((l) => /^commit [0-9a-f]{40}$/.test(l.trim()));
    if (!isLog) return lines;

    const result: string[] = [];
    let currentHash = "";
    let currentMsg = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^commit [0-9a-f]{40}$/.test(trimmed)) {
        if (currentHash && currentMsg) {
          result.push(`${currentHash.slice(0, 7)} ${currentMsg}`);
        }
        currentHash = trimmed.replace("commit ", "");
        currentMsg = "";
      } else if (
        trimmed &&
        !trimmed.startsWith("Author:") &&
        !trimmed.startsWith("Date:") &&
        !trimmed.startsWith("Merge:")
      ) {
        if (!currentMsg) currentMsg = trimmed;
      }
    }
    if (currentHash && currentMsg) {
      result.push(`${currentHash.slice(0, 7)} ${currentMsg}`);
    }

    return result.length > 0 ? result : lines;
  },
});

registerRule({
  name: "git-diff-stat",
  tools: ["git"],
  compress(lines: string[]): string[] {
    // Compact large diffs: keep stat summary, trim hunks
    const statLine = lines.findIndex((l) => /^\s*\d+ files? changed/.test(l));
    if (statLine === -1) return lines;

    // Keep everything up to and including the stat summary
    const result = lines.slice(0, statLine + 1);

    // After stat, only keep hunk headers and first 3 lines of each hunk
    let hunkLines = 0;
    for (let i = statLine + 1; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.startsWith("diff --git") || line.startsWith("@@")) {
        result.push(line);
        hunkLines = 0;
      } else if (hunkLines < 3) {
        result.push(line);
        hunkLines++;
      }
    }

    return result;
  },
});
