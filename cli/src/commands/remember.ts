import { basename } from "node:path";
import { addMemory, searchMemories, listMemories, removeMemory } from "../utils/memory.js";
import { ui, banner } from "../utils/ui.js";

export async function rememberCommand(
  content: string[],
  opts: { tag?: string[]; json?: boolean },
): Promise<void> {
  const text = content.join(" ").trim();
  if (!text) {
    if (opts.json) {
      console.log(JSON.stringify({ error: "Provide content to remember" }));
    } else {
      console.error("Usage: arcana remember \"your fact or preference\"");
    }
    process.exit(1);
  }

  const memory = addMemory(text, { tags: opts.tag, project: basename(process.cwd()) });

  if (opts.json) {
    console.log(JSON.stringify(memory));
    return;
  }

  banner();
  console.log(ui.bold("  Remember\n"));
  console.log(`  ${ui.success("[OK]")} Saved: "${text}"`);
  console.log(ui.dim(`       ID: ${memory.id} | Tags: ${memory.tags.join(", ")} | Project: ${memory.project}`));
  console.log();
}

export async function recallCommand(
  query: string[],
  opts: { all?: boolean; project?: string; json?: boolean },
): Promise<void> {
  if (opts.all) {
    const memories = listMemories({ project: opts.project });

    if (opts.json) {
      console.log(JSON.stringify(memories));
      return;
    }

    banner();
    console.log(ui.bold("  Recall\n"));
    if (memories.length === 0) {
      console.log(ui.dim("  No memories stored. Use: arcana remember \"your fact\""));
    } else {
      for (const m of memories) {
        console.log(`  ${ui.success(m.id)} ${m.content}`);
        console.log(ui.dim(`       Tags: ${m.tags.join(", ")} | Project: ${m.project ?? "global"} | ${m.created.slice(0, 10)}`));
      }
      console.log();
      console.log(ui.dim(`  ${memories.length} memories total`));
    }
    console.log();
    return;
  }

  const q = query.join(" ").trim();
  if (!q) {
    if (opts.json) {
      console.log(JSON.stringify({ error: "Provide a search query or use --all" }));
    } else {
      console.error("Usage: arcana recall \"search query\" or arcana recall --all");
    }
    process.exit(1);
  }

  const results = searchMemories(q, { project: opts.project });

  if (opts.json) {
    console.log(JSON.stringify(results));
    return;
  }

  banner();
  console.log(ui.bold("  Recall\n"));
  if (results.length === 0) {
    console.log(ui.dim(`  No memories matching "${q}"`));
  } else {
    for (const m of results) {
      console.log(`  ${ui.success(m.id)} ${m.content}`);
      console.log(ui.dim(`       Tags: ${m.tags.join(", ")} | Project: ${m.project ?? "global"} | ${m.created.slice(0, 10)}`));
    }
    console.log();
    console.log(ui.dim(`  ${results.length} result${results.length > 1 ? "s" : ""}`));
  }
  console.log();
}

export async function forgetCommand(
  id: string,
  opts: { json?: boolean },
): Promise<void> {
  if (!id) {
    if (opts.json) {
      console.log(JSON.stringify({ error: "Provide a memory ID to forget" }));
    } else {
      console.error("Usage: arcana forget <id>");
    }
    process.exit(1);
  }

  const removed = removeMemory(id);

  if (opts.json) {
    console.log(JSON.stringify({ removed, id }));
    return;
  }

  banner();
  console.log(ui.bold("  Forget\n"));
  if (removed) {
    console.log(`  ${ui.success("[OK]")} Memory ${id} removed`);
  } else {
    console.log(`  ${ui.warn("[!!]")} Memory ${id} not found`);
  }
  console.log();
}
