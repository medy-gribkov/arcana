#!/usr/bin/env bash
# lint-migration.sh - Check SQL migration files for safety issues
# Zero token cost: executed, not loaded as context
# Usage: bash lint-migration.sh [file-or-directory]

set -euo pipefail

TARGET="${1:-.}"

# Input validation: reject paths with shell metacharacters
if [[ "$TARGET" =~ [\$\`\;\|\&\(] ]]; then
  echo '{"error": "Invalid path: contains shell metacharacters"}' >&2
  exit 1
fi

FOUND=0

red() { printf '\033[0;31m%s\033[0m\n' "$1"; }
green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
dim() { printf '\033[0;90m%s\033[0m\n' "$1"; }

echo "Migration safety scan: $TARGET"

# 1. DROP TABLE without backup
hits=$(grep -rni -I 'DROP TABLE' "$TARGET" --include="*.sql" \
  | grep -Ev '(IF EXISTS|backup|archive|_old|_bak)' || true)
if [ -n "$hits" ]; then
  red "DANGER: DROP TABLE without safety check:"
  echo "$hits" | while IFS= read -r line; do dim "  $line"; done
  FOUND=$((FOUND + 1))
fi

# 2. NOT NULL without DEFAULT on existing table
hits=$(grep -rni -I 'ADD.*COLUMN.*NOT NULL' "$TARGET" --include="*.sql" \
  | grep -Evi 'DEFAULT' || true)
if [ -n "$hits" ]; then
  red "DANGER: NOT NULL column without DEFAULT (will fail on existing rows):"
  echo "$hits" | while IFS= read -r line; do dim "  $line"; done
  FOUND=$((FOUND + 1))
fi

# 3. RENAME COLUMN (can break application code)
hits=$(grep -rni -I 'RENAME COLUMN\|RENAME TO' "$TARGET" --include="*.sql" || true)
if [ -n "$hits" ]; then
  red "WARN: Column/table rename (may break application code):"
  echo "$hits" | while IFS= read -r line; do dim "  $line"; done
  FOUND=$((FOUND + 1))
fi

# 4. ALTER TYPE without migration strategy
hits=$(grep -rni -I 'ALTER.*TYPE\|SET DATA TYPE' "$TARGET" --include="*.sql" || true)
if [ -n "$hits" ]; then
  red "WARN: Type change detected (may require data migration):"
  echo "$hits" | while IFS= read -r line; do dim "  $line"; done
  FOUND=$((FOUND + 1))
fi

# 5. Missing down migration
for f in $(find "$TARGET" -type f ! -type l -name "*up*.sql" -o -name "*migrate*.sql" 2>/dev/null); do
  dir=$(dirname "$f")
  base=$(basename "$f")
  down=$(echo "$base" | sed 's/up/down/g')
  if [ ! -f "$dir/$down" ] && echo "$base" | grep -qi 'up'; then
    red "WARN: No down migration for: $f"
    FOUND=$((FOUND + 1))
  fi
done

if [ "$FOUND" -eq 0 ]; then
  green "OK: Migration files look safe"
else
  red "Found $FOUND migration safety issue(s). Review above."
fi

exit "$FOUND"
