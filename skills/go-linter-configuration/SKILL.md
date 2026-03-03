---
name: go-linter-configuration
description: Configure and troubleshoot golangci-lint for Go projects. Includes complete .golangci.yml examples, import resolution fixes, CI optimization, and linter selection workflows.
---

## Installation

```bash
# BAD: install via go get (deprecated)
go get -u github.com/golangci/golangci-lint/cmd/golangci-lint

# GOOD: install latest with go install
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Or use installation script for specific version
curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh \
  | sh -s -- -b $(go env GOPATH)/bin v1.61.0
```

Verify installation:
```bash
golangci-lint --version
# golangci-lint has version 1.61.0 built with go1.23.4
```

## Complete Configuration Examples

### Minimal (CI with Import Issues)

When CI fails with "undefined: package" errors despite local builds working:

```yaml
# .golangci.yml
run:
  timeout: 5m
  tests: false           # Skip test files (often have complex imports)
  build-tags: []         # No build tags
  skip-dirs:             # Skip generated/vendor code
    - vendor
    - third_party
    - testdata

linters:
  disable-all: true      # Start from scratch
  enable:
    - gofmt              # Only check formatting (no type-checking)
    - goimports          # Check imports

linters-settings:
  gofmt:
    simplify: true       # Use gofmt -s

issues:
  exclude-use-default: false
  max-issues-per-linter: 0   # Report all issues
  max-same-issues: 0         # No deduplication

output:
  formats:
    - format: colored-line-number
  sort-results: true
```

### Standard (Local Development)

```yaml
# .golangci.yml
run:
  timeout: 5m
  tests: true
  build-tags:
    - integration
  skip-dirs:
    - vendor
    - third_party
  modules-download-mode: readonly  # Don't modify go.mod

linters:
  enable:
    - gofmt              # Format checking
    - goimports          # Import organization
    - govet              # Go vet built-in
    - errcheck           # Unchecked errors
    - staticcheck        # Static analysis
    - unused             # Unused code
    - gosimple           # Simplifications
    - ineffassign        # Ineffective assignments
    - typecheck          # Type errors
    - misspell           # Spelling
    - gocyclo            # Cyclomatic complexity
    - dupl               # Code duplication
    - gosec              # Security issues

linters-settings:
  govet:
    enable-all: true
    disable:
      - shadow           # Too noisy for most projects

  errcheck:
    check-type-assertions: true
    check-blank: true

  staticcheck:
    checks: ["all"]

  gocyclo:
    min-complexity: 15   # Flag functions with complexity > 15

  dupl:
    threshold: 100       # Tokens threshold for duplication

  gosec:
    excludes:
      - G104             # Unhandled errors (covered by errcheck)

  misspell:
    locale: US

issues:
  exclude-rules:
    # Exclude linters for test files
    - path: _test\.go
      linters:
        - gocyclo
        - dupl

    # Exclude known false positives
    - text: "weak cryptographic primitive"
      linters:
        - gosec
      path: test/

  max-issues-per-linter: 50
  max-same-issues: 3

output:
  formats:
    - format: colored-line-number
  print-issued-lines: true
  print-linter-name: true
  sort-results: true
```

### Production (Strict)

```yaml
# .golangci.yml
run:
  timeout: 10m
  tests: true
  build-tags:
    - integration
    - e2e

linters:
  enable-all: true
  disable:
    # Disable overly opinionated/noisy linters
    - exhaustruct        # Requires all struct fields
    - varnamelen         # Variable name length
    - tagliatelle        # Struct tag format
    - ireturn            # Interface return types
    - wrapcheck          # Wrapping errors
    - nlreturn           # Newline before return
    - wsl                # Whitespace linter (too strict)

linters-settings:
  govet:
    enable-all: true

  errcheck:
    check-type-assertions: true
    check-blank: true

  gocyclo:
    min-complexity: 10   # Stricter than default

  gocognit:
    min-complexity: 15

  nestif:
    min-complexity: 4

  funlen:
    lines: 100           # Maximum function length
    statements: 50

  cyclop:
    max-complexity: 10

  lll:
    line-length: 120     # Maximum line length

  revive:
    rules:
      - name: exported
        arguments:
          - disableStutteringCheck
      - name: var-naming
      - name: error-return
      - name: error-naming
      - name: if-return
      - name: increment-decrement

issues:
  exclude-rules:
    - path: _test\.go
      linters:
        - funlen
        - gocyclo
        - dupl
        - gomnd

    - path: cmd/
      linters:
        - gochecknoglobals  # Allow globals in main

    - source: "^//go:generate "
      linters:
        - lll

  max-issues-per-linter: 0   # Report all
  max-same-issues: 0
```

## Troubleshooting Workflow

### Problem: "undefined: package" in CI

```bash
# Symptom
golangci-lint run ./...
# Error: could not import example.com/user/project/internal/db (undefined: sql)

# Diagnosis: Check if imports resolve
go list -m all
go mod tidy

# Solution 1: Ensure dependencies downloaded
go mod download
golangci-lint cache clean
golangci-lint run ./...

# Solution 2: Use minimal linter set (see config above)
# Create .golangci.yml with disable-all: true and only gofmt

# Solution 3: Skip type-checking linters in CI
cat > .golangci.ci.yml <<'EOF'
linters:
  disable:
    - typecheck
    - unused
    - staticcheck
EOF

golangci-lint run --config .golangci.ci.yml ./...
```

### Problem: Too Slow in CI

```bash
# BAD: run on entire codebase every time
golangci-lint run ./...  # 5 minutes

# GOOD: run only on new code
git fetch origin main
golangci-lint run --new-from-rev=origin/main ./...  # 30 seconds
```

### Problem: Too Many False Positives

```yaml
# .golangci.yml
issues:
  exclude-rules:
    # Ignore "magic number" in test files
    - path: _test\.go
      linters:
        - gomnd

    # Ignore long lines in generated code
    - path: \.pb\.go$
      linters:
        - lll

    # Ignore specific error messages
    - text: "G404: Use of weak random number generator"
      linters:
        - gosec
      path: test/

  exclude-files:
    - ".*\\.pb\\.go$"    # Protocol buffers
    - ".*mock.*\\.go$"   # Mocks
```

### Problem: Different Results Locally vs CI

```bash
# Cause: Different golangci-lint versions
golangci-lint --version  # Local: v1.59.1
# CI: v1.61.0 (different rules)

# Solution: Pin version in CI
# .github/workflows/lint.yml
- name: Install golangci-lint
  run: |
    curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh \
      | sh -s -- -b $(go env GOPATH)/bin v1.61.0

# Also pin in Makefile
.PHONY: lint
lint:
	@which golangci-lint > /dev/null || \
		curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh \
		| sh -s -- -b $(go env GOPATH)/bin v1.61.0
	golangci-lint run ./...
```

## GitHub Actions Integration

```yaml
# .github/workflows/lint.yml
name: Lint

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  golangci-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: '1.23'
          cache: true

      # Download dependencies first
      - name: Download dependencies
        run: go mod download

      # Use official golangci-lint action
      - name: golangci-lint
        uses: golangci/golangci-lint-action@v6
        with:
          version: v1.61.0
          args: --timeout=10m --config=.golangci.yml
          only-new-issues: true  # Only flag new issues in PRs
```

## Linter Selection Guide

```bash
# Check which linters are enabled
golangci-lint linters

# Run specific linter only
golangci-lint run --disable-all --enable=errcheck ./...

# Run all except specific linters
golangci-lint run --disable=typecheck,unused ./...
```

**Recommended progressive adoption:**

```yaml
# Week 1: Start with basics
linters:
  enable:
    - gofmt
    - goimports
    - govet

# Week 2: Add error checking
linters:
  enable:
    - gofmt
    - goimports
    - govet
    - errcheck
    - staticcheck

# Week 3: Add code quality
linters:
  enable:
    - gofmt
    - goimports
    - govet
    - errcheck
    - staticcheck
    - unused
    - gosimple
    - ineffassign
    - gocyclo

# Month 2: Enable most linters, disable noisy ones
linters:
  enable-all: true
  disable:
    - exhaustruct
    - varnamelen
    - wsl
```
