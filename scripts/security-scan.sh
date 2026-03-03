#!/usr/bin/env bash
# security-scan.sh - Scan repo for leaked secrets, hardcoded paths, and personal data
# Run: bash scripts/security-scan.sh
# Exit 1 if any issues found

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FOUND=0

red() { printf '\033[0;31m%s\033[0m\n' "$1"; }
green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
dim() { printf '\033[0;90m%s\033[0m\n' "$1"; }

echo "Security scan: $REPO_ROOT"
echo "---"

# 1. Hardcoded absolute paths (Windows and Unix)
echo "Checking for hardcoded paths..."
PATH_PATTERNS='(/Users/[A-Za-z]|/home/[A-Za-z]|C:\\Users\\[A-Za-z]|/c/Users/[A-Za-z])'
EXCLUDE_DIRS='(node_modules|dist|\.git/|package-lock\.json|\.claude/)'

path_hits=$(grep -rEn "$PATH_PATTERNS" "$REPO_ROOT" \
  --include="*.ts" --include="*.js" --include="*.json" --include="*.md" --include="*.yml" --include="*.yaml" --include="*.sh" \
  | grep -Ev "$EXCLUDE_DIRS" \
  | grep -Ev '(CHANGELOG\.md|CLAUDE\.md|\.claude/|rules/|memory/|project-migration/)' \
  | grep -Ev 'Users.Dev|/home/product/' \
  || true)

if [ -n "$path_hits" ]; then
  red "FAIL: Hardcoded paths found:"
  echo "$path_hits" | while IFS= read -r line; do dim "  $line"; done
  FOUND=$((FOUND + 1))
else
  green "OK: No hardcoded paths"
fi

# 2. Secret patterns
echo "Checking for secrets..."
SECRET_PATTERNS='(PRIVATE KEY|sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|npm_[a-zA-Z0-9]{36}|glpat-[a-zA-Z0-9-]{20,}|xox[bpoas]-[a-zA-Z0-9-]+|:[^@\s]+@[a-zA-Z0-9.-]+\.[a-z]{2,})'

secret_hits=$(grep -rEn "$SECRET_PATTERNS" "$REPO_ROOT" \
  --include="*.ts" --include="*.js" --include="*.json" --include="*.md" --include="*.yml" --include="*.yaml" --include="*.sh" --include="*.env*" \
  | grep -Ev "$EXCLUDE_DIRS" \
  | grep -Ev '(security-scan\.sh|scan-secrets\.sh|security\.yml|CHANGELOG\.md|SECURITY\.md|README\.md|scanner\.test\.ts|\.example|@example\.com|@b\.com|package\.json|NOTICE|CITATION\.cff|RELEASING\.md)' \
  || true)

if [ -n "$secret_hits" ]; then
  red "FAIL: Possible secrets found:"
  echo "$secret_hits" | while IFS= read -r line; do dim "  $line"; done
  FOUND=$((FOUND + 1))
else
  green "OK: No secrets detected"
fi

# 3. .env files committed (should never be in repo)
echo "Checking for .env files..."
env_files=$(find "$REPO_ROOT" -name ".env" -o -name ".env.local" -o -name ".env.production" 2>/dev/null \
  | grep -v node_modules \
  | grep -v '.env.example' \
  || true)

if [ -n "$env_files" ]; then
  red "FAIL: .env files found in repo:"
  echo "$env_files" | while IFS= read -r line; do dim "  $line"; done
  FOUND=$((FOUND + 1))
else
  green "OK: No .env files"
fi

# 4. Personal identifiers in skill files
echo "Checking skills for personal data..."
PERSONAL_PATTERNS='([a-zA-Z0-9._%+-]+@(gmail|hotmail|yahoo|outlook)\.[a-z]{2,}|mahdy|gribkov)'

personal_hits=$(grep -rEin "$PERSONAL_PATTERNS" "$REPO_ROOT/skills/" \
  --include="*.md" \
  || true)

if [ -n "$personal_hits" ]; then
  red "FAIL: Personal data in skills:"
  echo "$personal_hits" | while IFS= read -r line; do dim "  $line"; done
  FOUND=$((FOUND + 1))
else
  green "OK: No personal data in skills"
fi

# 5. Check SKILL.md files don't reference local machine
echo "Checking skills for machine-specific references..."
# Only flag machine-specific patterns that suggest real config, not code examples
MACHINE_PATTERNS='(%APPDATA%|%USERPROFILE%|%LOCALAPPDATA%)'

machine_hits=$(grep -rEn "$MACHINE_PATTERNS" "$REPO_ROOT/skills/" \
  --include="*.md" \
  || true)

if [ -n "$machine_hits" ]; then
  # Filter out legitimate references (like documentation about localhost)
  real_hits=$(echo "$machine_hits" | grep -Ev '(example|documentation|config|pattern|template|placeholder)' || true)
  if [ -n "$real_hits" ]; then
    red "WARN: Machine-specific references in skills:"
    echo "$real_hits" | while IFS= read -r line; do dim "  $line"; done
    FOUND=$((FOUND + 1))
  else
    green "OK: Machine references are documentation only"
  fi
else
  green "OK: No machine-specific references"
fi

echo "---"
if [ "$FOUND" -gt 0 ]; then
  red "FAILED: $FOUND issue(s) found"
  exit 1
else
  green "PASSED: All security checks clean"
  exit 0
fi
