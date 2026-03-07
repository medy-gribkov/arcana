import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { getSkillDir } from "../utils/fs.js";
import { atomicWriteSync } from "../utils/atomic.js";
import { renderBanner } from "../utils/help.js";
import { NAME_REGEX } from "../utils/frontmatter.js";

function generateSkillMd(name: string, description: string): string {
  return `---
name: ${name}
description: ${description}
---

## Overview

${description}

## Workflow

<!-- Step-by-step instructions for the agent -->

1. Step one
2. Step two
3. Step three

## Examples

\`\`\`typescript
// BAD: Description of anti-pattern
const bad = "example";

// GOOD: Description of correct approach
const good = "example";
\`\`\`

## Anti-patterns

<!-- List common mistakes with BAD/GOOD pairs -->

## References

See \`references/\` for detailed documentation.
`;
}

/* v8 ignore start */
export async function createCommand(name: string): Promise<void> {
  console.log(renderBanner());
  console.log();
  p.intro(chalk.bold("Create a new skill"));

  if (!NAME_REGEX.test(name)) {
    p.cancel("Invalid skill name. Use lowercase letters, numbers, and hyphens. Must start with a letter.");
    process.exit(1);
  }

  const skillDir = getSkillDir(name);
  if (existsSync(skillDir)) {
    p.cancel(`Skill "${name}" already exists at ${skillDir}`);
    process.exit(1);
  }

  p.log.info(`Skill name: ${chalk.cyan(name)}`);

  const description = await p.text({
    message: "Description (80-1024 chars)",
    placeholder: "A skill that helps with...",
    validate: (val) => {
      if (!val || !val.trim()) return "Description is required";
      if (val.length < 10) return "Too short (minimum 10 chars)";
      return undefined;
    },
  });

  if (p.isCancel(description)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  const desc = (description as string).trim();

  if (desc.length < 80) {
    p.log.warn(`Description is short (${desc.length} chars). Recommend 80+ for discoverability.`);
  }

  if (desc.length > 1024) {
    p.log.warn(`Description is long (${desc.length} chars). Max 1024 for marketplace.`);
  }

  try {
    mkdirSync(skillDir, { recursive: true });
    atomicWriteSync(join(skillDir, "SKILL.md"), generateSkillMd(name, desc));

    const scriptsDir = join(skillDir, "scripts");
    const referencesDir = join(skillDir, "references");
    mkdirSync(scriptsDir, { recursive: true });
    mkdirSync(referencesDir, { recursive: true });
    atomicWriteSync(join(scriptsDir, ".gitkeep"), "");
    atomicWriteSync(join(referencesDir, ".gitkeep"), "");
  } catch (err) {
    p.cancel(`Failed to create skill: ${err instanceof Error ? err.message : "unknown error"}`);
    process.exit(1);
  }

  p.log.success(`Created skill: ${chalk.bold(name)}`);
  p.log.info(`Location: ${skillDir}`);
  p.log.info("Edit SKILL.md to add your skill instructions.");
  p.outro(`Next: ${chalk.cyan("arcana validate " + name)}`);
}
/* v8 ignore stop */
