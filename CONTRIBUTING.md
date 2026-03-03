# Contributing to Arcana

Thanks for considering a contribution. Here is how to add a skill or improve an existing one.

## Adding a New Skill

1. Fork the repo
2. Create a new directory under `skills/your-skill-name/`
3. Add a `SKILL.md` with YAML frontmatter (see below)
4. Optional: add `scripts/`, `references/`, or `assets/` directories
5. Open a PR

### SKILL.md Format

```yaml
---
name: your-skill-name
description: What it does. When to use it. Trigger phrases. (80-1024 characters)
license: MIT
---
```

The description is the most important part. It controls when the skill gets loaded. Include:
- WHAT the skill does
- WHEN to use it (concrete scenarios)
- Trigger phrases (words that should activate it)

After the frontmatter, write the skill instructions in markdown. Keep it under 150 lines. If you need more detail, put it in `references/` files.

## Skill Quality Checklist

Before submitting a PR, make sure:

- [ ] SKILL.md has YAML frontmatter with `name` and `description`
- [ ] Description is 80-1024 characters
- [ ] Description includes what, when, and trigger phrases
- [ ] SKILL.md is under 150 lines
- [ ] No hardcoded personal paths or machine-specific configs
- [ ] Scripts work cross-platform (Windows + macOS + Linux) where applicable
- [ ] Tests exist for any Python scripts (test_*.py files)
- [ ] No secrets, API keys, or credentials anywhere in the skill

## Improving an Existing Skill

Open a PR with the changes. Explain what you changed and why in the PR description.

## Writing Style

- No em dashes. Use periods or commas.
- No emojis.
- Short sentences. Direct.
- Say what it does, not what it "aims to do."
- Active voice. "This skill reviews code" not "Code can be reviewed using this skill."

## Reporting Issues

Use the issue templates. Include the skill name and what went wrong.

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Be respectful. Keep feedback constructive.
