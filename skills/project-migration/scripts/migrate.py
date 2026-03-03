#!/usr/bin/env python3
"""
Project Migration Tool — Move projects while preserving Claude Code session data.

Usage:
    python migrate.py <source> <dest> [--delete-bulky] [--dry-run]

Examples:
    python migrate.py "C:\\Users\\User\\Desktop\\my-app" "C:\\Users\\User\\Coding\\Personal\\my-app"
    python migrate.py /c/Users/User/Desktop/my-app /c/Users/User/Coding/Personal/my-app --dry-run
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

# Add scripts dir to path for encoding_utils
sys.path.insert(0, str(Path(__file__).parent))
from encoding_utils import configure_utf8_console

configure_utf8_console()

CLAUDE_DIR = Path.home() / ".claude"
PROJECTS_DIR = CLAUDE_DIR / "projects"
HISTORY_FILE = CLAUDE_DIR / "history.jsonl"

BULKY_DIRS = ["node_modules", ".bun", "dist", ".next", "__pycache__", ".venv"]


def normalize_path(p: str) -> str:
    """Normalize a path to Windows format (C:\\Users\\...)."""
    p = p.replace("\\", "/").rstrip("/")
    # Handle Git Bash paths: /c/Users/... -> C:/Users/...
    m = re.match(r"^/([a-zA-Z])/(.*)$", p)
    if m:
        p = f"{m.group(1).upper()}:/{m.group(2)}"
    return p.replace("/", os.sep)


def encode_claude_path(path: str) -> str:
    """Encode an absolute path to Claude's project directory key.

    C:\\Users\\User\\Desktop\\ai-model -> c--Users-User-Desktop-ai-model
    """
    p = path.replace("\\", "/").rstrip("/")
    # Handle Git Bash paths: /c/Users/... -> C:/Users/...
    m = re.match(r"^/([a-zA-Z])/(.*)$", p)
    if m:
        p = f"{m.group(1).upper()}:/{m.group(2)}"
    # Replace colon with dash: C:/Users -> C-/Users
    p = p.replace(":", "-")
    # Replace / with dash: C-/Users -> C--Users
    p = p.replace("/", "-")
    # Replace spaces with dash
    p = p.replace(" ", "-")
    # Replace underscores with dash
    p = p.replace("_", "-")
    # Lowercase drive letter: C-- -> c--
    if len(p) >= 1:
        p = p[0].lower() + p[1:]
    return p


def decode_claude_path(key: str) -> str:
    """Decode a Claude project directory key back to a Windows path (best effort).

    c--Users-User-Desktop-ai-model -> C:\\Users\\User\\Desktop\\ai-model

    Note: This is lossy — spaces, underscores, and hyphens all map to '-'.
    Used for display/estimation, not exact reconstruction.
    """
    if not key:
        return ""
    # Uppercase drive letter: c-- -> C--
    p = key[0].upper() + key[1:]
    # First dash after drive letter is the colon: C-- -> C:-
    if len(p) >= 2 and p[1] == "-":
        p = p[0] + ":" + p[2:]
    # Remaining dashes become backslashes (best guess)
    p = p.replace("-", "\\")
    return p


def find_claude_dir(key: str) -> Path | None:
    """Find Claude project data dir, checking both c-- and C-- variants."""
    if not PROJECTS_DIR.exists():
        return None
    candidate = PROJECTS_DIR / key
    if candidate.is_dir():
        return candidate
    # Try uppercase C variant
    upper_key = key[0].upper() + key[1:] if key else key
    candidate = PROJECTS_DIR / upper_key
    if candidate.is_dir():
        return candidate
    return None


def check_git_dirty(path: Path) -> bool:
    """Check if a git repo has uncommitted changes. Returns True if dirty."""
    git_dir = path / ".git"
    if not git_dir.exists():
        return False
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=str(path),
            capture_output=True,
            text=True,
            timeout=10,
            env=os.environ.copy(),
        )
        return bool(result.stdout.strip())
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def get_dir_size(path: Path) -> int:
    """Get total size of directory in bytes."""
    total = 0
    try:
        for entry in path.rglob("*"):
            if entry.is_file():
                try:
                    total += entry.stat().st_size
                except OSError:
                    pass
    except OSError:
        pass
    return total


def format_size(size_bytes: int) -> str:
    """Format bytes as human-readable string."""
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


def migrate_project(
    source: str, dest: str, delete_bulky: bool = False, dry_run: bool = False
) -> bool:
    """Migrate a project folder and its Claude Code session data.

    Returns True on success, False on failure.
    """
    source_path = Path(normalize_path(source))
    dest_path = Path(normalize_path(dest))

    print("=" * 50)
    print("  Claude Project Migration Tool")
    print("=" * 50)
    print(f"\nSource: {source_path}")
    print(f"Dest:   {dest_path}")

    # Pre-flight checks
    if not source_path.is_dir():
        print(f"\nERROR: Source does not exist: {source_path}")
        return False

    if not dest_path.parent.is_dir():
        print(f"\nERROR: Destination parent does not exist: {dest_path.parent}")
        return False

    if dest_path.exists():
        print(f"\nERROR: Destination already exists: {dest_path}")
        return False

    # Git dirty check
    if check_git_dirty(source_path):
        print("\nWARNING: Git working tree has uncommitted changes!")
        subprocess.run(
            ["git", "status", "--short"],
            cwd=str(source_path),
            env=os.environ.copy(),
        )

    # Compute Claude keys
    old_key = encode_claude_path(str(source_path))
    new_key = encode_claude_path(str(dest_path))
    print(f"\nClaude key mapping:")
    print(f"  Old: {old_key}")
    print(f"  New: {new_key}")

    old_claude_dir = find_claude_dir(old_key)
    if old_claude_dir:
        session_count = len(list(old_claude_dir.glob("*.jsonl")))
        print(f"  Found Claude data: {session_count} session(s)")
    else:
        print("  No Claude data found (will skip data migration)")

    if dry_run:
        print("\n=== DRY RUN — no changes made ===\n")
        print("Would do:")
        if delete_bulky:
            print(f"  1. Delete {', '.join(BULKY_DIRS)} from source")
        print(f"  2. Move {source_path} -> {dest_path}")
        if old_claude_dir:
            print(f"  3. Rename Claude dir: {old_claude_dir.name} -> {new_key}")
        print("  4. Update history.jsonl path references")
        return True

    # Step 1: Delete bulky dirs
    if delete_bulky:
        print("\nCleaning bulky directories...")
        for dirname in BULKY_DIRS:
            bulky = source_path / dirname
            if bulky.is_dir():
                size = get_dir_size(bulky)
                print(f"  Deleting {dirname} ({format_size(size)})...")
                shutil.rmtree(bulky, ignore_errors=True)

    # Step 2: Move the project
    print("\nMoving project...")
    try:
        # Try rename first (instant on same drive)
        source_path.rename(dest_path)
    except OSError:
        # Fall back to shutil.move for cross-drive
        shutil.move(str(source_path), str(dest_path))
    print(f"Moved: {source_path} -> {dest_path}")

    # Step 3: Migrate Claude data
    if old_claude_dir:
        print("\nMigrating Claude session data...")
        new_claude_dir = PROJECTS_DIR / new_key
        if new_claude_dir.exists():
            print(f"  WARNING: Target Claude dir already exists: {new_key}")
            print("  Skipping Claude data rename to avoid data loss.")
        else:
            old_claude_dir.rename(new_claude_dir)
            print(f"  Renamed: {old_claude_dir.name} -> {new_key}")

    # Step 4: Update history.jsonl
    if HISTORY_FILE.is_file():
        old_json_path = str(source_path).replace("\\", "\\\\")
        new_json_path = str(dest_path).replace("\\", "\\\\")
        try:
            content = HISTORY_FILE.read_text(encoding="utf-8")
            if old_json_path in content:
                print("\nUpdating history.jsonl...")
                content = content.replace(old_json_path, new_json_path)
                HISTORY_FILE.write_text(content, encoding="utf-8")
                print("  Updated path references")
            else:
                print("\nNo references to old path in history.jsonl (OK)")
        except (OSError, UnicodeDecodeError) as e:
            print(f"\nWARNING: Could not update history.jsonl: {e}")

    # Summary
    print("\n" + "=" * 50)
    print("  Migration complete!")
    print("=" * 50)
    print(f"\nProject: {dest_path}")
    if old_claude_dir:
        print(f"Claude data: {PROJECTS_DIR / new_key}")
    print("\nNext steps:")
    print("  - Open the project in VS Code at the new location")
    print("  - If Node.js project: run npm install / bun install")
    print("  - Claude will find your session history automatically")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Migrate project folders while preserving Claude Code session data."
    )
    parser.add_argument("source", help="Source project path")
    parser.add_argument("dest", help="Destination project path")
    parser.add_argument(
        "--delete-bulky",
        action="store_true",
        help="Delete node_modules, .bun, dist, .next before moving",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Show what would happen without doing it"
    )
    args = parser.parse_args()

    success = migrate_project(args.source, args.dest, args.delete_bulky, args.dry_run)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
