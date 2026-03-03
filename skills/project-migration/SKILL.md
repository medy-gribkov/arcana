---
name: project-migration
description: Migrate project folders while preserving Claude Code session data. Includes Python path normalization examples, symlink handling, and data migration workflows.
---

## Path Encoding Rules

Claude Code encodes project paths as directory names in `~/.claude/projects/`:

```python
# Example transformations
# C:\Users\User\Desktop\myproject → C--Users-User-Desktop-myproject
# /home/user/dev/app → home-user-dev-app
# C:\Code\my app → C--Code-my-app

def encode_path(path: str) -> str:
    """Encode filesystem path to Claude directory name."""
    # Windows: C:\foo\bar → c--foo-bar
    # Unix: /foo/bar → foo-bar

    path = str(Path(path).resolve())  # Normalize

    # Replace separators
    path = path.replace('\\', '-').replace('/', '-')

    # Handle drive letter (Windows)
    if len(path) > 1 and path[1] == ':':
        path = path[0].lower() + '-' + path[2:]

    # Remove leading separator
    path = path.lstrip('-')

    # Replace spaces and underscores
    path = path.replace(' ', '-').replace('_', '-')

    return path

# Test examples
assert encode_path("C:\\Users\\Dev\\Desktop\\foo") == "c--Users-Dev-Desktop-foo"
assert encode_path("/home/user/projects/bar") == "home-user-projects-bar"
assert encode_path("C:\\Code\\my app") == "c--Code-my-app"
```

## Decode Path from Directory Name

```python
def decode_path(encoded: str, platform: str = "win32") -> str:
    """Decode Claude directory name back to filesystem path."""
    # c--Users-Dev-Desktop-foo → C:\Users\Dev\Desktop\foo
    # home-user-dev-app → /home/user/dev/app

    if platform == "win32":
        # Windows path
        if len(encoded) > 2 and encoded[1:3] == "--":
            # Has drive letter
            drive = encoded[0].upper() + ":"
            rest = encoded[3:].replace('-', '\\')
            return f"{drive}\\{rest}"
        else:
            # Relative or network path (rare)
            return encoded.replace('-', '\\')
    else:
        # Unix path
        return '/' + encoded.replace('-', '/')

# Test decoding
assert decode_path("c--Users-Dev-Desktop-foo", "win32") == "C:\\Users\\Dev\\Desktop\\foo"
assert decode_path("home-user-dev-app", "linux") == "/home/user/dev/app"
```

## Migration Workflow

```bash
# 1. Dry run (preview changes)
python scripts/migrate.py "C:\Users\Dev\Desktop\myproject" "C:\Dev\myproject" --dry-run

# Output:
# [DRY RUN] Would perform:
# 1. Move: C:\Users\Dev\Desktop\myproject → C:\Dev\myproject
# 2. Rename Claude data: c--Users-Dev-Desktop-myproject → c--Dev-myproject
# 3. Update 15 history.jsonl entries

# 2. Execute migration
python scripts/migrate.py "C:\Users\Dev\Desktop\myproject" "C:\Dev\myproject"

# Output:
# ✓ Checked git status (clean)
# ✓ Moved project directory
# ✓ Renamed Claude data directory
# ✓ Updated history.jsonl (15 entries)
# Migration complete.

# 3. With bulky directory cleanup
python scripts/migrate.py <source> <dest> --delete-bulky
# Deletes node_modules, .next, __pycache__, dist, build before moving
```

## Update history.jsonl Path References

```python
import json
from pathlib import Path

def update_history_paths(old_path: str, new_path: str):
    """Update path references in ~/.claude/history.jsonl."""
    history_file = Path.home() / ".claude" / "history.jsonl"

    if not history_file.exists():
        print("No history.jsonl found")
        return

    # Read all entries
    entries = []
    with open(history_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                entries.append(json.loads(line))

    # Update paths
    old_path_normalized = str(Path(old_path).resolve())
    new_path_normalized = str(Path(new_path).resolve())
    updated_count = 0

    for entry in entries:
        if 'projectPath' in entry:
            if Path(entry['projectPath']).resolve() == Path(old_path_normalized):
                entry['projectPath'] = new_path_normalized
                updated_count += 1

    # Write back
    with open(history_file, 'w', encoding='utf-8') as f:
        for entry in entries:
            f.write(json.dumps(entry) + '\n')

    print(f"Updated {updated_count} history entries")

# Usage
update_history_paths(
    "C:\\Users\\Dev\\Desktop\\myproject",
    "C:\\Dev\\myproject"
)
```

## Handle Symlinks

```python
from pathlib import Path

def is_symlink_or_junction(path: Path) -> bool:
    """Check if path is a symlink or Windows junction."""
    if path.is_symlink():
        return True

    # Windows junction check
    if os.name == 'nt':
        import ctypes
        FILE_ATTRIBUTE_REPARSE_POINT = 0x400
        attrs = ctypes.windll.kernel32.GetFileAttributesW(str(path))
        return attrs != -1 and (attrs & FILE_ATTRIBUTE_REPARSE_POINT)

    return False

def resolve_symlinks(path: Path) -> Path:
    """Resolve symlinks to real path."""
    try:
        return path.resolve(strict=True)
    except FileNotFoundError:
        # Broken symlink
        return path

# Usage in migration
source = Path(source_path)
if is_symlink_or_junction(source):
    print(f"Warning: {source} is a symlink")
    real_source = resolve_symlinks(source)
    print(f"Real path: {real_source}")
    # Decide: migrate symlink or real path?
```

## Data Migration Script

```python
#!/usr/bin/env python3
import shutil
import json
from pathlib import Path
import sys

def migrate_project(source: str, dest: str, delete_bulky: bool = False):
    """
    Migrate project and Claude Code data.

    1. Verify source exists
    2. Check git status
    3. Optionally delete bulky dirs
    4. Move project directory
    5. Rename Claude data directory
    6. Update history.jsonl
    """
    source_path = Path(source).resolve()
    dest_path = Path(dest).resolve()

    # 1. Verify source
    if not source_path.exists():
        print(f"Error: {source_path} does not exist")
        sys.exit(1)

    # 2. Check git status
    if (source_path / ".git").exists():
        import subprocess
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=source_path,
            capture_output=True,
            text=True
        )
        if result.stdout.strip():
            print("Warning: Uncommitted changes detected")
            if input("Continue? (y/N): ").lower() != 'y':
                sys.exit(0)

    # 3. Delete bulky directories
    if delete_bulky:
        bulky_dirs = [
            "node_modules", ".next", "__pycache__", "dist", "build",
            ".venv", "venv", "target", ".tox"
        ]
        for bulky in bulky_dirs:
            bulky_path = source_path / bulky
            if bulky_path.exists():
                print(f"Deleting {bulky}...")
                shutil.rmtree(bulky_path)

    # 4. Move project
    print(f"Moving {source_path} → {dest_path}")
    shutil.move(str(source_path), str(dest_path))

    # 5. Rename Claude data directory
    old_key = encode_path(str(source_path))
    new_key = encode_path(str(dest_path))

    claude_dir = Path.home() / ".claude" / "projects"
    old_data = claude_dir / old_key
    new_data = claude_dir / new_key

    if old_data.exists():
        print(f"Renaming Claude data: {old_key} → {new_key}")
        old_data.rename(new_data)

    # 6. Update history.jsonl
    update_history_paths(str(source_path), str(dest_path))

    print("✓ Migration complete")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Migrate Claude Code project")
    parser.add_argument("source", help="Source project path")
    parser.add_argument("dest", help="Destination project path")
    parser.add_argument("--delete-bulky", action="store_true",
                        help="Delete node_modules, .next, etc. before moving")
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview changes without executing")

    args = parser.parse_args()

    if args.dry_run:
        print(f"[DRY RUN] Would migrate:")
        print(f"  {args.source} → {args.dest}")
        if args.delete_bulky:
            print("  (with bulky directory deletion)")
    else:
        migrate_project(args.source, args.dest, args.delete_bulky)
```

## Orphan Cleanup

```python
#!/usr/bin/env python3
from pathlib import Path
import shutil

def find_orphaned_claude_data():
    """Find Claude data directories with no matching project."""
    claude_projects = Path.home() / ".claude" / "projects"

    if not claude_projects.exists():
        print("No .claude/projects directory found")
        return []

    orphans = []

    for data_dir in claude_projects.iterdir():
        if not data_dir.is_dir():
            continue

        # Decode to get original project path
        decoded_path = decode_path(data_dir.name)
        project_path = Path(decoded_path)

        if not project_path.exists():
            # Project doesn't exist = orphan
            size = sum(f.stat().st_size for f in data_dir.rglob('*') if f.is_file())
            session_count = len(list(data_dir.glob("**/sessions/*.json")))

            orphans.append({
                'key': data_dir.name,
                'path': decoded_path,
                'size_mb': size / (1024 * 1024),
                'sessions': session_count,
                'dir': data_dir
            })

    return orphans

def cleanup_orphans(dry_run: bool = True):
    """Remove orphaned Claude data directories."""
    orphans = find_orphaned_claude_data()

    if not orphans:
        print("No orphaned directories found")
        return

    print(f"Found {len(orphans)} orphaned Claude data directories:\n")

    for orphan in orphans:
        print(f"  {orphan['key']}")
        print(f"    Path: {orphan['path']}")
        print(f"    Size: {orphan['size_mb']:.2f} MB")
        print(f"    Sessions: {orphan['sessions']}")
        print()

    if dry_run:
        print("[DRY RUN] Use --delete to remove these directories")
    else:
        if input("Delete all orphans? (y/N): ").lower() == 'y':
            for orphan in orphans:
                print(f"Deleting {orphan['key']}...")
                shutil.rmtree(orphan['dir'])
            print(f"✓ Deleted {len(orphans)} orphaned directories")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Clean orphaned Claude data")
    parser.add_argument("--delete", action="store_true", help="Delete orphans")
    args = parser.parse_args()

    cleanup_orphans(dry_run=not args.delete)
```
