#!/usr/bin/env python3
"""Tests for project migration — path encoding, decoding, and migration logic."""

import os
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

# Import from sibling module
import sys
sys.path.insert(0, str(Path(__file__).parent))
from migrate import (
    encode_claude_path,
    decode_claude_path,
    find_claude_dir,
    normalize_path,
    check_git_dirty,
    PROJECTS_DIR,
)
from cleanup_orphans import decode_claude_key, find_orphans


class TestEncodeClaudePath(unittest.TestCase):
    """Test encode_claude_path against known real-world pairs."""

    def test_simple_windows_path(self):
        self.assertEqual(
            encode_claude_path(r"C:\Users\User\Desktop\ai-model"),
            "c--Users-User-Desktop-ai-model",
        )

    def test_deep_path(self):
        self.assertEqual(
            encode_claude_path(r"C:\Users\User\Coding\Personal\Archive\logan-agent-copy"),
            "c--Users-User-Coding-Personal-Archive-logan-agent-copy",
        )

    def test_path_with_spaces(self):
        self.assertEqual(
            encode_claude_path(r"C:\Users\User\Desktop\microGPT Brain"),
            "c--Users-User-Desktop-microGPT-Brain",
        )

    def test_path_with_underscores(self):
        self.assertEqual(
            encode_claude_path(r"C:\Users\User\Coding\Personal\Gaming_test"),
            "c--Users-User-Coding-Personal-Gaming-test",
        )

    def test_git_bash_path(self):
        self.assertEqual(
            encode_claude_path("/c/Users/User/Desktop/foo"),
            "c--Users-User-Desktop-foo",
        )

    def test_forward_slash_path(self):
        self.assertEqual(
            encode_claude_path("C:/Users/User/Desktop/bar"),
            "c--Users-User-Desktop-bar",
        )

    def test_trailing_slash_stripped(self):
        self.assertEqual(
            encode_claude_path(r"C:\Users\User\Desktop\test/"),
            "c--Users-User-Desktop-test",
        )

    def test_home_dir(self):
        self.assertEqual(
            encode_claude_path(r"C:\Users\User"),
            "c--Users-User",
        )

    def test_production_path(self):
        self.assertEqual(
            encode_claude_path(r"C:\Users\User\Coding\SporeSec\Production\lead-scraper"),
            "c--Users-User-Coding-SporeSec-Production-lead-scraper",
        )


class TestDecodeClaudePath(unittest.TestCase):
    """Test decode_claude_path for reasonable round-trip behavior."""

    def test_simple_decode(self):
        decoded = decode_claude_path("c--Users-User-Desktop-ai-model")
        self.assertEqual(decoded, r"C:\Users\User\Desktop\ai\model")
        # Note: lossy — 'ai-model' becomes 'ai\model' because we can't
        # distinguish path separators from hyphens in names.

    def test_empty_key(self):
        self.assertEqual(decode_claude_path(""), "")

    def test_home_dir(self):
        decoded = decode_claude_path("c--Users-User")
        self.assertEqual(decoded, r"C:\Users\User")


class TestDecodeClaudeKey(unittest.TestCase):
    """Test cleanup_orphans decode function."""

    def test_matches_migrate_decode(self):
        key = "c--Users-User-Desktop-foo"
        self.assertEqual(decode_claude_key(key), decode_claude_path(key))


class TestNormalizePath(unittest.TestCase):
    """Test path normalization."""

    def test_backslashes(self):
        result = normalize_path(r"C:\Users\User\Desktop")
        self.assertEqual(result, f"C:{os.sep}Users{os.sep}User{os.sep}Desktop")

    def test_git_bash(self):
        result = normalize_path("/c/Users/User/Desktop")
        self.assertEqual(result, f"C:{os.sep}Users{os.sep}User{os.sep}Desktop")

    def test_forward_slashes(self):
        result = normalize_path("C:/Users/User")
        self.assertEqual(result, f"C:{os.sep}Users{os.sep}User")


class TestFindClaudeDir(unittest.TestCase):
    """Test find_claude_dir with mock filesystem."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.mock_projects = Path(self.tmpdir) / "projects"
        self.mock_projects.mkdir()

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_find_lowercase(self):
        (self.mock_projects / "c--Users-User-Desktop-test").mkdir()
        with patch("migrate.PROJECTS_DIR", self.mock_projects):
            result = find_claude_dir("c--Users-User-Desktop-test")
            self.assertIsNotNone(result)
            self.assertEqual(result.name, "c--Users-User-Desktop-test")

    def test_find_uppercase_variant(self):
        (self.mock_projects / "C--Users-User-Desktop-test").mkdir()
        with patch("migrate.PROJECTS_DIR", self.mock_projects):
            result = find_claude_dir("c--Users-User-Desktop-test")
            self.assertIsNotNone(result)
            # On case-insensitive filesystems (Windows), both variants resolve
            self.assertIn(result.name.lower(), ["c--users-user-desktop-test"])

    def test_not_found(self):
        with patch("migrate.PROJECTS_DIR", self.mock_projects):
            result = find_claude_dir("c--Users-User-Desktop-nonexistent")
            self.assertIsNone(result)


class TestMigrateDryRun(unittest.TestCase):
    """Test that dry run makes no filesystem changes."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.source = Path(self.tmpdir) / "source-project"
        self.source.mkdir()
        (self.source / "test.txt").write_text("hello")
        self.dest = Path(self.tmpdir) / "dest-project"

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_dry_run_no_move(self):
        from migrate import migrate_project

        migrate_project(str(self.source), str(self.dest), dry_run=True)
        # Source should still exist, dest should not
        self.assertTrue(self.source.exists())
        self.assertFalse(self.dest.exists())


if __name__ == "__main__":
    unittest.main()
