#!/usr/bin/env python3
"""
Orphaned Claude Data Cleanup — Find and remove .claude/projects/ dirs with no matching project.

Usage:
    python cleanup_orphans.py [--delete] [--dry-run]

Examples:
    python cleanup_orphans.py                # Report orphans
    python cleanup_orphans.py --delete       # Delete after confirmation
    python cleanup_orphans.py --dry-run      # Show what --delete would do
"""

import argparse
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from encoding_utils import configure_utf8_console

configure_utf8_console()

CLAUDE_DIR = Path.home() / ".claude"
PROJECTS_DIR = CLAUDE_DIR / "projects"


def decode_claude_key(key: str) -> str:
    """Decode a Claude project key back to a Windows path (best effort).

    c--Users-User-Desktop-ai-model -> C:\\Users\\User\\Desktop\\ai-model

    This is lossy (spaces/underscores/hyphens all became '-'),
    but sufficient to check if the base directory exists.
    """
    if not key:
        return ""
    p = key[0].upper() + key[1:]
    if len(p) >= 2 and p[1] == "-":
        p = p[0] + ":" + p[2:]
    p = p.replace("-", "\\")
    return p


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


def count_sessions(path: Path) -> int:
    """Count .jsonl session files in a Claude project dir."""
    return len(list(path.glob("*.jsonl")))


def find_orphans() -> list[dict]:
    """Find Claude project dirs whose original project path doesn't exist."""
    if not PROJECTS_DIR.is_dir():
        print(f"No projects directory found at {PROJECTS_DIR}")
        return []

    orphans = []
    for entry in sorted(PROJECTS_DIR.iterdir()):
        if not entry.is_dir():
            continue

        decoded = decode_claude_key(entry.name)
        original_path = Path(decoded)

        # Check if the original project path exists
        if not original_path.exists():
            size = get_dir_size(entry)
            sessions = count_sessions(entry)
            orphans.append(
                {
                    "dir": entry,
                    "key": entry.name,
                    "decoded_path": decoded,
                    "size": size,
                    "sessions": sessions,
                }
            )

    return orphans


def main():
    parser = argparse.ArgumentParser(
        description="Find and remove orphaned Claude Code project data."
    )
    parser.add_argument(
        "--delete", action="store_true", help="Delete orphaned directories"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what --delete would do without deleting",
    )
    args = parser.parse_args()

    print("Scanning for orphaned Claude project data...\n")
    orphans = find_orphans()

    if not orphans:
        print("No orphans found. All project data has matching directories.")
        return

    total_size = sum(o["size"] for o in orphans)
    print(f"Found {len(orphans)} orphaned project data dir(s) ({format_size(total_size)} total):\n")

    for i, o in enumerate(orphans, 1):
        print(f"  {i}. {o['key']}")
        print(f"     Decoded: {o['decoded_path']}")
        print(f"     Size: {format_size(o['size'])}  |  Sessions: {o['sessions']}")
        print()

    if args.dry_run:
        print(f"DRY RUN: Would delete {len(orphans)} dirs, freeing {format_size(total_size)}")
        return

    if args.delete:
        confirm = input(f"Delete {len(orphans)} orphaned dirs ({format_size(total_size)})? [y/N] ")
        if confirm.lower() != "y":
            print("Aborted.")
            return

        deleted = 0
        freed = 0
        for o in orphans:
            try:
                shutil.rmtree(o["dir"])
                deleted += 1
                freed += o["size"]
                print(f"  Deleted: {o['key']}")
            except OSError as e:
                print(f"  FAILED: {o['key']} — {e}")

        print(f"\nDeleted {deleted}/{len(orphans)} dirs, freed {format_size(freed)}")
    else:
        print("Run with --delete to remove, or --dry-run to preview.")


if __name__ == "__main__":
    main()
