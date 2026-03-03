#!/usr/bin/env bash
# check-errors.sh - Find unchecked errors in Go code
# Zero token cost: executed, not loaded as context
# Usage: bash check-errors.sh [directory]

set -euo pipefail

TARGET="${1:-.}"

# Input validation: reject paths with shell metacharacters
if [[ "$TARGET" =~ [\$\`\;\|\&\(] ]]; then
  echo '{"error": "Invalid path: contains shell metacharacters"}' >&2
  exit 1
fi

red() { printf '\033[0;31m%s\033[0m\n' "$1"; }
green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
dim() { printf '\033[0;90m%s\033[0m\n' "$1"; }

echo "Go error handling scan: $TARGET"
FOUND=0

# 1. Ignored error returns (assigned to _)
hits=$(grep -rn -I ', *_ *:*= *' "$TARGET" --include="*.go" \
  | grep -Ev '(vendor/|_test\.go|testdata/)' \
  | grep -i 'err\|error' || true)
if [ -n "$hits" ]; then
  count=$(echo "$hits" | wc -l)
  red "WARN: $count ignored error return(s):"
  echo "$hits" | head -10 | while IFS= read -r line; do dim "  $line"; done
  FOUND=$((FOUND + count))
fi

# 2. Bare error returns without wrapping
hits=$(grep -rn -I 'return.*err$' "$TARGET" --include="*.go" \
  | grep -Ev '(vendor/|_test\.go|fmt\.Errorf|errors\.Wrap|errors\.New)' || true)
if [ -n "$hits" ]; then
  count=$(echo "$hits" | wc -l)
  red "INFO: $count bare error return(s) without context wrapping:"
  echo "$hits" | head -10 | while IFS= read -r line; do dim "  $line"; done
fi

# 3. panic() usage outside tests
hits=$(grep -rn -I 'panic(' "$TARGET" --include="*.go" \
  | grep -Ev '(vendor/|_test\.go|testdata/|recover)' || true)
if [ -n "$hits" ]; then
  count=$(echo "$hits" | wc -l)
  red "WARN: $count panic() call(s) in non-test code:"
  echo "$hits" | head -10 | while IFS= read -r line; do dim "  $line"; done
  FOUND=$((FOUND + count))
fi

# 4. fmt.Println in non-test code (should use slog/zerolog)
hits=$(grep -rn -I 'fmt\.Print\|log\.Print\|log\.Fatal' "$TARGET" --include="*.go" \
  | grep -Ev '(vendor/|_test\.go|testdata/|main\.go)' || true)
if [ -n "$hits" ]; then
  count=$(echo "$hits" | wc -l)
  red "INFO: $count unstructured log call(s) (prefer slog/zerolog):"
  echo "$hits" | head -5 | while IFS= read -r line; do dim "  $line"; done
fi

if [ "$FOUND" -eq 0 ]; then
  green "OK: No critical error handling issues"
else
  red "Found $FOUND issue(s) requiring attention."
fi
