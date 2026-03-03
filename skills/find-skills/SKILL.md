---
name: find-skills
description: Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities. This skill should be used when the user is looking for functionality that might exist as an installable skill.
---

# Find Skills

Discover and install skills from the open agent skills ecosystem.

## When to Use

- User asks "how do I do X" where X might have an existing skill
- "Find a skill for X" or "is there a skill for X"
- "Can you do X" where X is specialized
- User wants to extend agent capabilities or search for tools

## Skills CLI

The Skills CLI (`npx skills`) is the package manager for agent skills. Skills are modular packages that extend capabilities.

**Commands:**
- `npx skills find [query]` - Search for skills
- `npx skills add <package>` - Install from GitHub
- `npx skills check` - Check for updates
- `npx skills update` - Update all skills

**Browse:** https://skills.sh/

## Workflow

### 1. Understand Need

Identify domain, task, and likelihood a skill exists.

### 2. Search

Run the find command with a relevant query:

```bash
npx skills find [query]
```

For example:

- User asks "how do I make my React app faster?" → `npx skills find react performance`
- User asks "can you help me with PR reviews?" → `npx skills find pr review`
- User asks "I need to create a changelog" → `npx skills find changelog`

Returns:
```
vercel-labs/agent-skills@vercel-react-best-practices
└ https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices
```

### 3. Present Options

Show: name, purpose, install command, link.

Example:

```
Found: "vercel-react-best-practices" - React/Next.js optimization from Vercel.

Install: npx skills add vercel-labs/agent-skills@vercel-react-best-practices
Details: https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices
```

### 4. Install

Install for the user:

```bash
npx skills add <owner/repo@skill> -g -y
```

Flags: `-g` (global), `-y` (skip prompts).

## Skill Categories

| Category        | Example Queries                          |
| --------------- | ---------------------------------------- |
| Web Development | react, nextjs, typescript, css, tailwind |
| Testing         | testing, jest, playwright, e2e           |
| DevOps          | deploy, docker, kubernetes, ci-cd        |
| Documentation   | docs, readme, changelog, api-docs        |
| Code Quality    | review, lint, refactor, best-practices   |
| Design          | ui, ux, design-system, accessibility     |
| Productivity    | workflow, automation, git                |

## Search Tips

- Specific keywords: "react testing" > "testing"
- Try alternatives: "deploy" / "deployment" / "ci-cd"
- Check: `vercel-labs/agent-skills`, `ComposioHQ/awesome-claude-skills`

## No Results

Acknowledge, offer direct help, suggest creating a skill with `npx skills init`.
