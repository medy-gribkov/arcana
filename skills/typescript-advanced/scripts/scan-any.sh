#!/usr/bin/env bash
# scan-any.sh - Count `any` and `as any` usage in TypeScript files
# Zero token cost: executed, not loaded as context
# Usage: bash scan-any.sh [directory]

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

echo "TypeScript 'any' usage scan: $TARGET"

# Count explicit `any` type annotations
any_count=$(grep -rn -I ': any\b\|: any;\|: any,\|: any)\|<any>' "$TARGET" \
  --include="*.ts" --include="*.tsx" \
  | grep -Ev '(node_modules|dist|\.test\.|\.spec\.|\.d\.ts)' \
  | wc -l)

# Count `as any` casts
as_any_count=$(grep -rn -I 'as any' "$TARGET" \
  --include="*.ts" --include="*.tsx" \
  | grep -Ev '(node_modules|dist|\.test\.|\.spec\.|\.d\.ts)' \
  | wc -l)

total=$((any_count + as_any_count))

echo "---"
echo "  : any    = $any_count"
echo "  as any   = $as_any_count"
echo "  total    = $total"
echo "---"

if [ "$total" -gt 0 ]; then
  red "Locations:"
  grep -rn -I ': any\b\|as any' "$TARGET" \
    --include="*.ts" --include="*.tsx" \
    | grep -Ev '(node_modules|dist|\.test\.|\.spec\.|\.d\.ts)' \
    | head -20 \
    | while IFS= read -r line; do dim "  $line"; done

  if [ "$total" -gt 20 ]; then
    dim "  ... and $((total - 20)) more"
  fi
fi

if [ "$total" -eq 0 ]; then
  green "OK: No 'any' usage found"
elif [ "$total" -le 5 ]; then
  green "OK: $total 'any' usage(s) found (acceptable)"
else
  red "WARN: $total 'any' usage(s) found. Consider adding proper types."
fi
