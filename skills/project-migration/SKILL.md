---
name: project-migration
description: Migrate project folders while preserving Claude Code session data. Use when moving, renaming, or reorganizing project directories. Handles path encoding, data migration, history.jsonl updates, and orphan cleanup.
---

# Project Migration

## Overview

Move, rename, or reorganize project directories without losing Claude Code session history. Handles the `.claude/projects/` path-encoded data directories, `history.jsonl` path references, and orphan cleanup.

## When to Use

- Moving a project to a new location (e.g., Desktop to Coding/)
- Renaming a project directory
- Reorganizing folder structure (archiving, restructuring)
- Cleaning up orphaned `.claude/projects/` directories after manual moves

## Quick Start

### Migrate a project
```bash
python scripts/migrate.py <source> <dest> [--dry-run] [--delete-bulky]
```

### Clean orphaned Claude data
```bash
python scripts/cleanup_orphans.py [--dry-run] [--delete]
```

### Run tests
```bash
python scripts/test_migrate.py -v
```

## Migrate Workflow

1. **Dry run first** — always preview what will happen:
   ```bash
   python scripts/migrate.py "C:\Users\User\Desktop\my-project" "C:\Users\User\Coding\Personal\my-project" --dry-run
   ```

2. **Execute migration** — moves files + Claude data:
   ```bash
   python scripts/migrate.py "C:\Users\User\Desktop\my-project" "C:\Users\User\Coding\Personal\my-project"
   ```

3. **With bulky cleanup** — removes node_modules, .next, __pycache__ before moving:
   ```bash
   python scripts/migrate.py <source> <dest> --delete-bulky
   ```

### What migrate.py does
1. Checks for uncommitted git changes (warns if dirty)
2. Computes old and new Claude path keys (see references/claude-data-structure.md)
3. Renames the `.claude/projects/<old-key>` directory to `<new-key>`
4. Moves the project folder to the new location
5. Updates `~/.claude/history.jsonl` path references
6. Optionally deletes bulky directories first (node_modules, .venv, etc.)

## Orphan Cleanup

After manual moves or deletions, orphaned Claude data directories accumulate.

```bash
# Preview orphans
python scripts/cleanup_orphans.py --dry-run

# Delete confirmed orphans
python scripts/cleanup_orphans.py --delete
```

Reports: key name, decoded path, directory size, session count.

## Path Encoding Reference

Claude Code encodes project paths as directory names:
- `C:\Users\User\Desktop\foo` → `c--Users-User-Desktop-foo`
- Colon → dash, backslash → dash, space → dash, underscore → dash
- Drive letter lowercased

See [references/claude-data-structure.md](references/claude-data-structure.md) for full details.

## Cross-Platform

All scripts use Python 3.7+ with `pathlib.Path`. Works on:
- Windows (cmd, PowerShell, Git Bash)
- macOS / Linux

Windows-specific path handling documented in [references/windows-path-gotchas.md](references/windows-path-gotchas.md).

## Scripts

| Script | Purpose |
|--------|---------|
| `migrate.py` | Move project + Claude data |
| `cleanup_orphans.py` | Find/delete orphaned Claude dirs |
| `encoding_utils.py` | UTF-8 Windows console fix |
| `test_migrate.py` | 20 unit tests |
