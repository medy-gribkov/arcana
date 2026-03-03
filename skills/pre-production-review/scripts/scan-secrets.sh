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

# Patterns to search for
declare -A PATTERNS=(
  ["api_key_sk"]='sk-[a-zA-Z0-9]{20,}'
  ["api_key_pk"]='pk_[a-zA-Z0-9]{20,}'
  ["aws_key"]='AKIA[0-9A-Z]{16}'
  ["github_token"]='gh[pus]_[a-zA-Z0-9]{36,}'
  ["password_quoted"]='"password"\s*[:=]\s*"[^"]+"'
  ["passwd"]='"passwd"\s*[:=]\s*"[^"]+"'
  ["secret_quoted"]='"secret"\s*[:=]\s*"[^"]+"'
  ["bearer_token"]='Bearer\s+[a-zA-Z0-9_-]{20,}'
  ["jwt"]='eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+'
  ["postgres_creds"]='postgresql://[^:]+:[^@]+@'
  ["mongodb_creds"]='mongodb://[^:]+:[^@]+@'
  ["redis_creds"]='redis://[^:]+:[^@]+@'
  ["private_key"]="-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY""-----"
)

# Function to escape JSON string
json_escape() {
  printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || \
  printf '"%s"' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g' | tr -d '\n\r')"
}

# Search for each pattern
for pattern_name in "${!PATTERNS[@]}"; do
  pattern="${PATTERNS[$pattern_name]}"

  while IFS= read -r line; do
    if [[ -n "$line" ]]; then
      # Parse grep output: filename:line_number:content
      file=$(echo "$line" | cut -d: -f1)
      line_num=$(echo "$line" | cut -d: -f2)
      content=$(echo "$line" | cut -d: -f3-)

      # Skip if in excluded paths
      if [[ "$file" =~ node_modules|\.git|dist|build|\.min\.js|\.env\.example ]] || \
         [[ "$file" =~ \.test\.|\.spec\. ]]; then
        continue
      fi

      # Create JSON finding
      FINDINGS+=("{\"file\":\"$file\",\"line\":$line_num,\"pattern\":\"$pattern_name\",\"snippet\":$(json_escape "${content:0:100}")}")
    fi
  done < <(grep -rn -I -E "$pattern" "$TARGET_DIR" 2>/dev/null || true)
done

# Output JSON array
if [[ ${#FINDINGS[@]} -eq 0 ]]; then
  echo "[]"
else
  printf '%s\n' "${FINDINGS[@]}" | jq -s . 2>/dev/null || echo "[$(IFS=,; echo "${FINDINGS[*]}")]"
fi
