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

FINDINGS=()

# Function to escape JSON string
json_escape() {
  printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || \
  printf '"%s"' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g' | tr -d '\n\r')"
}

# Function to add finding
add_finding() {
  local file="$1"
  local line_num="$2"
  local vuln_type="$3"
  local snippet="$4"

  # Skip if in excluded paths
  if [[ "$file" =~ node_modules|\.git|dist|build ]] || \
     [[ "$file" =~ \.test\.|\.spec\. ]]; then
    return
  fi

  FINDINGS+=("{\"file\":\"$file\",\"line\":$line_num,\"type\":\"$vuln_type\",\"snippet\":$(json_escape "${snippet:0:100}")}")
}

# 1. Search for eval() in JS/TS files
while IFS= read -r line; do
  if [[ -n "$line" ]]; then
    file=$(echo "$line" | cut -d: -f1)
    line_num=$(echo "$line" | cut -d: -f2)
    content=$(echo "$line" | cut -d: -f3-)
    add_finding "$file" "$line_num" "eval_usage" "$content"
  fi
done < <(find "$TARGET_DIR" -type f ! -type l \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) \
  ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" \
  -exec grep -n -I 'eval(' {} + 2>/dev/null || true)

# 2. Search for innerHTML/dangerouslySetInnerHTML
while IFS= read -r line; do
  if [[ -n "$line" ]]; then
    file=$(echo "$line" | cut -d: -f1)
    line_num=$(echo "$line" | cut -d: -f2)
    content=$(echo "$line" | cut -d: -f3-)
    add_finding "$file" "$line_num" "innerHTML_usage" "$content"
  fi
done < <(find "$TARGET_DIR" -type f ! -type l \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) \
  ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" \
  -exec grep -nE -I '(innerHTML|dangerouslySetInnerHTML)' {} + 2>/dev/null || true)

# 3. Search for SQL string concatenation
while IFS= read -r line; do
  if [[ -n "$line" ]]; then
    file=$(echo "$line" | cut -d: -f1)
    line_num=$(echo "$line" | cut -d: -f2)
    content=$(echo "$line" | cut -d: -f3-)
    add_finding "$file" "$line_num" "sql_injection_risk" "$content"
  fi
done < <(find "$TARGET_DIR" -type f ! -type l \( -name "*.js" -o -name "*.ts" -o -name "*.go" -o -name "*.py" \) \
  ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" \
  -exec grep -nE -I '(SELECT|INSERT|UPDATE|DELETE).*(\+|\$\{|%s)' {} + 2>/dev/null || true)

# 4. Search for child_process.exec with interpolation
while IFS= read -r line; do
  if [[ -n "$line" ]]; then
    file=$(echo "$line" | cut -d: -f1)
    line_num=$(echo "$line" | cut -d: -f2)
    content=$(echo "$line" | cut -d: -f3-)
    add_finding "$file" "$line_num" "command_injection_risk" "$content"
  fi
done < <(find "$TARGET_DIR" -type f ! -type l \( -name "*.js" -o -name "*.ts" \) \
  ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" \
  -exec grep -nE -I 'exec\s*\(.*(\$\{|`)' {} + 2>/dev/null || true)

# 5. Search for weak crypto (MD5/SHA1)
while IFS= read -r line; do
  if [[ -n "$line" ]]; then
    file=$(echo "$line" | cut -d: -f1)
    line_num=$(echo "$line" | cut -d: -f2)
    content=$(echo "$line" | cut -d: -f3-)
    add_finding "$file" "$line_num" "weak_crypto" "$content"
  fi
done < <(find "$TARGET_DIR" -type f ! -type l \( -name "*.js" -o -name "*.ts" -o -name "*.go" -o -name "*.py" \) \
  ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" \
  -exec grep -nE -I 'createHash\s*\(\s*["\x27](md5|sha1)["\x27]' {} + 2>/dev/null || true)

# 6. Search for http:// URLs (non-HTTPS)
while IFS= read -r line; do
  if [[ -n "$line" ]]; then
    file=$(echo "$line" | cut -d: -f1)
    line_num=$(echo "$line" | cut -d: -f2)
    content=$(echo "$line" | cut -d: -f3-)
    # Skip localhost and comments
    if [[ ! "$content" =~ localhost ]] && [[ ! "$content" =~ ^[[:space:]]*(//|#|\*) ]]; then
      add_finding "$file" "$line_num" "http_url" "$content"
    fi
  fi
done < <(find "$TARGET_DIR" -type f ! -type l \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.go" -o -name "*.py" \) \
  ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" \
  -exec grep -n -I 'http://' {} + 2>/dev/null || true)

# 7. Search for CORS wildcard
while IFS= read -r line; do
  if [[ -n "$line" ]]; then
    file=$(echo "$line" | cut -d: -f1)
    line_num=$(echo "$line" | cut -d: -f2)
    content=$(echo "$line" | cut -d: -f3-)
    add_finding "$file" "$line_num" "cors_wildcard" "$content"
  fi
done < <(find "$TARGET_DIR" -type f ! -type l \( -name "*.js" -o -name "*.ts" -o -name "*.go" -o -name "*.py" \) \
  ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" \
  -exec grep -n -I 'Access-Control-Allow-Origin.*\*' {} + 2>/dev/null || true)

# Output JSON array
if [[ ${#FINDINGS[@]} -eq 0 ]]; then
  echo "[]"
else
  printf '%s\n' "${FINDINGS[@]}" | jq -s . 2>/dev/null || echo "[$(IFS=,; echo "${FINDINGS[*]}")]"
fi
