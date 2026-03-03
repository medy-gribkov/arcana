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

STACK=()
HAS_TESTS=false
HAS_CI=false
HAS_DOCKER=false
HAS_ENV_EXAMPLE=false
FILE_COUNT=0
CRITICAL_FILES=()

# Count files (excluding node_modules, .git, dist, build)
FILE_COUNT=$(find "$TARGET_DIR" -type f ! -type l \
  ! -path "*/node_modules/*" \
  ! -path "*/.git/*" \
  ! -path "*/dist/*" \
  ! -path "*/build/*" \
  2>/dev/null | wc -l | tr -d ' ')

# Check for package.json and extract stack info
if [[ -f "$TARGET_DIR/package.json" ]]; then
  CRITICAL_FILES+=("package.json")

  # Check for TypeScript
  if grep -q '"typescript"' "$TARGET_DIR/package.json" 2>/dev/null || [[ -f "$TARGET_DIR/tsconfig.json" ]]; then
    STACK+=("typescript")
  fi

  # Check for frameworks/libraries
  if grep -q '"react"' "$TARGET_DIR/package.json" 2>/dev/null; then
    STACK+=("react")
  fi
  if grep -q '"next"' "$TARGET_DIR/package.json" 2>/dev/null; then
    STACK+=("next")
  fi
  if grep -q '"vue"' "$TARGET_DIR/package.json" 2>/dev/null; then
    STACK+=("vue")
  fi
  if grep -q '"@angular/core"' "$TARGET_DIR/package.json" 2>/dev/null; then
    STACK+=("angular")
  fi
  if grep -q '"express"' "$TARGET_DIR/package.json" 2>/dev/null; then
    STACK+=("express")
  fi
  if grep -q '"fastify"' "$TARGET_DIR/package.json" 2>/dev/null; then
    STACK+=("fastify")
  fi

  # Check for test frameworks
  if grep -qE '"(jest|vitest|mocha|chai|cypress|playwright)"' "$TARGET_DIR/package.json" 2>/dev/null; then
    HAS_TESTS=true
  fi
fi

# Check for Go
if [[ -f "$TARGET_DIR/go.mod" ]]; then
  STACK+=("go")
  CRITICAL_FILES+=("go.mod")
fi

# Check for Rust
if [[ -f "$TARGET_DIR/Cargo.toml" ]]; then
  STACK+=("rust")
  CRITICAL_FILES+=("Cargo.toml")
fi

# Check for Python
if [[ -f "$TARGET_DIR/requirements.txt" ]] || [[ -f "$TARGET_DIR/pyproject.toml" ]]; then
  STACK+=("python")
  [[ -f "$TARGET_DIR/requirements.txt" ]] && CRITICAL_FILES+=("requirements.txt")
  [[ -f "$TARGET_DIR/pyproject.toml" ]] && CRITICAL_FILES+=("pyproject.toml")
fi

# Check for Docker
if [[ -f "$TARGET_DIR/docker-compose.yml" ]] || [[ -f "$TARGET_DIR/Dockerfile" ]]; then
  HAS_DOCKER=true
  [[ -f "$TARGET_DIR/Dockerfile" ]] && CRITICAL_FILES+=("Dockerfile")
fi

# Check for CI
if [[ -d "$TARGET_DIR/.github/workflows" ]]; then
  HAS_CI=true
fi

# Check for TypeScript config
if [[ -f "$TARGET_DIR/tsconfig.json" ]]; then
  CRITICAL_FILES+=("tsconfig.json")
fi

# Check for .env.example
if [[ -f "$TARGET_DIR/.env.example" ]]; then
  HAS_ENV_EXAMPLE=true
fi

# Check for Prisma
if [[ -f "$TARGET_DIR/prisma/schema.prisma" ]]; then
  STACK+=("prisma")
  CRITICAL_FILES+=("prisma/schema.prisma")
fi

# Check for Drizzle
if [[ -f "$TARGET_DIR/drizzle.config.ts" ]]; then
  STACK+=("drizzle")
  CRITICAL_FILES+=("drizzle.config.ts")
fi

# Find additional critical files
if [[ -f "$TARGET_DIR/src/app/layout.tsx" ]]; then
  CRITICAL_FILES+=("src/app/layout.tsx")
fi
if [[ -f "$TARGET_DIR/src/index.ts" ]]; then
  CRITICAL_FILES+=("src/index.ts")
fi
if [[ -f "$TARGET_DIR/src/main.ts" ]]; then
  CRITICAL_FILES+=("src/main.ts")
fi
if [[ -f "$TARGET_DIR/main.go" ]]; then
  CRITICAL_FILES+=("main.go")
fi

# Build JSON output
STACK_JSON=$(printf '%s\n' "${STACK[@]}" | jq -R . | jq -s . 2>/dev/null || echo "[]")
CRITICAL_FILES_JSON=$(printf '%s\n' "${CRITICAL_FILES[@]}" | jq -R . | jq -s . 2>/dev/null || echo "[]")

cat <<EOF
{
  "stack": $STACK_JSON,
  "hasTests": $HAS_TESTS,
  "hasCi": $HAS_CI,
  "hasDocker": $HAS_DOCKER,
  "hasEnvExample": $HAS_ENV_EXAMPLE,
  "fileCount": $FILE_COUNT,
  "criticalFiles": $CRITICAL_FILES_JSON
}
EOF
