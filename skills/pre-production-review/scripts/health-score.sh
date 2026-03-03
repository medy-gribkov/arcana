#!/usr/bin/env bash
set -euo pipefail

INPUT="${1:-}"

# Input validation: reject paths with shell metacharacters
if [[ -n "$INPUT" ]] && [[ "$INPUT" != "-" ]] && [[ "$INPUT" =~ [\$\`\;\|\&\(] ]]; then
  echo '{"error": "Invalid path: contains shell metacharacters"}' >&2
  exit 1
fi

# Read JSON from file or stdin
if [[ -z "$INPUT" ]] || [[ "$INPUT" == "-" ]]; then
  JSON_DATA=$(head -c 1048576)  # Max 1MB
elif [[ -f "$INPUT" ]]; then
  JSON_DATA=$(cat "$INPUT")
else
  echo "{\"error\": \"Invalid input: $INPUT\"}" >&2
  exit 1
fi

# Count findings by severity
# Assume the JSON is an array of findings with a "severity" or "type" field
# For secrets and security scans, we need to map types to severity

CRITICAL=0
HIGH=0
MEDIUM=0
LOW=0

# Process JSON and count by severity
# This is a simplified version - in production, you'd map specific types to severity levels
while IFS= read -r finding; do
  type=$(echo "$finding" | jq -r '.type // .pattern // "unknown"' 2>/dev/null)

  case "$type" in
    # Critical: hardcoded secrets, private keys
    api_key_*|aws_key|github_token|private_key|postgres_creds|mongodb_creds|redis_creds)
      ((CRITICAL++))
      ;;
    # High: security vulnerabilities
    eval_usage|sql_injection_risk|command_injection_risk)
      ((HIGH++))
      ;;
    # Medium: weak security practices
    innerHTML_usage|weak_crypto|cors_wildcard|password_quoted|secret_quoted|bearer_token|jwt)
      ((MEDIUM++))
      ;;
    # Low: code quality issues
    http_url|passwd|unknown)
      ((LOW++))
      ;;
    *)
      # Default to low for unknown types
      ((LOW++))
      ;;
  esac
done < <(echo "$JSON_DATA" | jq -c '.[]' 2>/dev/null || echo "")

# Calculate health score
SCORE=100

# Critical: -20 each (capped at -60)
CRITICAL_PENALTY=$((CRITICAL * 20))
if [[ $CRITICAL_PENALTY -gt 60 ]]; then
  CRITICAL_PENALTY=60
fi
SCORE=$((SCORE - CRITICAL_PENALTY))

# High: -10 each (capped at -40)
HIGH_PENALTY=$((HIGH * 10))
if [[ $HIGH_PENALTY -gt 40 ]]; then
  HIGH_PENALTY=40
fi
SCORE=$((SCORE - HIGH_PENALTY))

# Medium: -3 each
SCORE=$((SCORE - MEDIUM * 3))

# Low: -1 each
SCORE=$((SCORE - LOW))

# Minimum score is 0
if [[ $SCORE -lt 0 ]]; then
  SCORE=0
fi

# Determine rating
RATING="CRITICAL"
if [[ $SCORE -ge 90 ]]; then
  RATING="EXCELLENT"
elif [[ $SCORE -ge 70 ]]; then
  RATING="GOOD"
elif [[ $SCORE -ge 50 ]]; then
  RATING="NEEDS_WORK"
fi

# Determine deploy readiness
DEPLOY_READY=false
if [[ $SCORE -ge 70 ]] && [[ $CRITICAL -eq 0 ]]; then
  DEPLOY_READY=true
fi

# Output JSON
cat <<EOF
{
  "score": $SCORE,
  "breakdown": {
    "critical": $CRITICAL,
    "high": $HIGH,
    "medium": $MEDIUM,
    "low": $LOW
  },
  "rating": "$RATING",
  "deployReady": $DEPLOY_READY
}
EOF
