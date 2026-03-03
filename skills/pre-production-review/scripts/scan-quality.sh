#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-.}"

# Input validation: reject paths with shell metacharacters
if [[ "$TARGET_DIR" =~ [\$\`\;\|\&\(] ]]; then
  echo '{"error": "Invalid path: contains shell metacharacters"}' >&2
  exit 1
fi

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "{\"error\": \"Directory not found: $TARGET_DIR\"}" >&2
  exit 1
fi

ANY_COUNT=0
TODO_COUNT=0
ESLINT_DISABLE_COUNT=0
TS_IGNORE_COUNT=0
LONG_FILES=()

# Count 'any' and 'as any' in TypeScript files (exclude .d.ts)
ANY_COUNT=$(find "$TARGET_DIR" -type f ! -type l \( -name "*.ts" -o -name "*.tsx" \) \
  ! -name "*.d.ts" \
  ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" \
  -exec grep -ohE -I '\bany\b|as any' {} + 2>/dev/null | wc -l | tr -d ' ')

# Count TODO, FIXME, HACK, XXX comments
TODO_COUNT=$(find "$TARGET_DIR" -type f ! -type l \
  ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" \
  -exec grep -ohE -I '(TODO|FIXME|HACK|XXX)' {} + 2>/dev/null | wc -l | tr -d ' ')

# Count eslint-disable comments
ESLINT_DISABLE_COUNT=$(find "$TARGET_DIR" -type f ! -type l \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) \
  ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" \
  -exec grep -ohE -I 'eslint-disable' {} + 2>/dev/null | wc -l | tr -d ' ')

# Count @ts-ignore and @ts-nocheck
TS_IGNORE_COUNT=$(find "$TARGET_DIR" -type f ! -type l \( -name "*.ts" -o -name "*.tsx" \) \
  ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" \
  -exec grep -ohE -I '@ts-(ignore|nocheck)' {} + 2>/dev/null | wc -l | tr -d ' ')

# Find files over 500 lines
while IFS= read -r file; do
  if [[ -f "$file" ]]; then
    line_count=$(wc -l < "$file" 2>/dev/null | tr -d ' ')
    if [[ $line_count -gt 500 ]]; then
      # Get relative path from TARGET_DIR
      rel_path="${file#$TARGET_DIR/}"
      LONG_FILES+=("$rel_path:$line_count")
    fi
  fi
done < <(find "$TARGET_DIR" -type f ! -type l \
  \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.go" -o -name "*.py" \) \
  ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" 2>/dev/null)

# Build JSON for long files
LONG_FILES_JSON="[]"
if [[ ${#LONG_FILES[@]} -gt 0 ]]; then
  LONG_FILES_JSON=$(printf '%s\n' "${LONG_FILES[@]}" | jq -R . | jq -s . 2>/dev/null || echo "[]")
fi

# Output JSON
cat <<EOF
{
  "anyCount": $ANY_COUNT,
  "todoCount": $TODO_COUNT,
  "eslintDisableCount": $ESLINT_DISABLE_COUNT,
  "tsIgnoreCount": $TS_IGNORE_COUNT,
  "longFiles": $LONG_FILES_JSON
}
EOF
