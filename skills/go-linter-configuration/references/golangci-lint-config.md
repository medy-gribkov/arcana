# Complete Annotated .golangci.yml

A single, thoroughly annotated config file. Copy and adjust per project.

```yaml
# .golangci.yml - Production config with annotations
# Docs: https://golangci-lint.run/usage/configuration/

run:
  # Timeout for the entire run. Increase for large codebases.
  timeout: 10m

  # Include test files in analysis. Set false if tests have complex deps.
  tests: true

  # Build tags to include. Add "integration", "e2e" as needed.
  build-tags:
    - integration

  # Don't modify go.mod during lint (safe for CI).
  modules-download-mode: readonly

  # Directories to skip. Paths relative to project root.
  skip-dirs:
    - vendor
    - third_party
    - testdata
    - node_modules
    - ".git"

  # File patterns to skip entirely.
  skip-files:
    - ".*\\.pb\\.go$"         # protobuf generated
    - ".*_gen\\.go$"          # code-generated files
    - ".*mock.*\\.go$"        # mock files

# ─────────────────────────────────────────────
# LINTER SELECTION
# ─────────────────────────────────────────────
linters:
  # Two strategies:
  # 1. enable-all + disable noisy ones (strict, catches new linters on upgrade)
  # 2. disable-all + enable specific (predictable, no surprises)
  # This config uses strategy 1 for production.

  enable-all: true

  disable:
    # Overly opinionated / high false-positive rate
    - exhaustruct              # requires every struct field set
    - varnamelen               # variable name length rules
    - tagliatelle              # struct tag casing rules
    - ireturn                  # forbids returning interfaces
    - wrapcheck                # requires wrapping all errors
    - nlreturn                 # blank line before return
    - wsl                      # whitespace formatting (too strict)
    - depguard                 # import allow/deny lists (configure if needed)

    # Deprecated linters (may not exist in newer versions)
    # - golint                 # replaced by revive
    # - maligned               # replaced by govet fieldalignment
    # - scopelint              # replaced by exportloopref

# ─────────────────────────────────────────────
# LINTER SETTINGS
# ─────────────────────────────────────────────
linters-settings:

  # --- Static analysis ---
  govet:
    enable-all: true
    disable:
      - shadow                 # too noisy; enable once codebase is clean

  staticcheck:
    checks: ["all"]            # all SA*, S*, ST*, QF* checks

  # --- Error handling ---
  errcheck:
    check-type-assertions: true   # catch unchecked type assertions
    check-blank: true             # catch _ = err patterns
    exclude-functions:
      - fmt.Fprintf              # writing to stdout rarely fails
      - fmt.Fprintln

  # --- Complexity ---
  gocyclo:
    min-complexity: 12         # flag functions above this

  gocognit:
    min-complexity: 15         # cognitive complexity threshold

  nestif:
    min-complexity: 4          # max nesting depth

  funlen:
    lines: 80                  # max function length in lines
    statements: 40             # max function statements

  cyclop:
    max-complexity: 12

  # --- Style ---
  lll:
    line-length: 120           # max line length

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
      - name: range
      - name: receiver-naming
      - name: indent-error-flow

  gocritic:
    enabled-tags:
      - diagnostic
      - style
      - performance
    disabled-checks:
      - hugeParam              # too aggressive for most projects

  # --- Security ---
  gosec:
    excludes:
      - G104                   # unhandled errors (covered by errcheck)
      - G304                   # file path from variable (common in CLIs)

  # --- Spelling ---
  misspell:
    locale: US

  # --- Import order ---
  goimports:
    local-prefixes: example.com/myorg  # CHANGE to your module path

# ─────────────────────────────────────────────
# ISSUE FILTERING
# ─────────────────────────────────────────────
issues:
  # Don't use default excludes. Be explicit.
  exclude-use-default: false

  exclude-rules:
    # Relax rules in test files
    - path: _test\.go
      linters:
        - funlen
        - gocyclo
        - gocognit
        - dupl
        - gosec
        - goconst

    # Allow globals in cmd/ (main packages)
    - path: cmd/
      linters:
        - gochecknoglobals

    # Ignore line length in go:generate directives
    - source: "^//go:generate "
      linters:
        - lll

    # Ignore long lines in struct tags
    - source: "`.*`"
      linters:
        - lll

  # Report ALL issues (0 = unlimited)
  max-issues-per-linter: 0
  max-same-issues: 0

  # Show all issues, not just new ones (set true in CI PRs)
  # new: false
  # new-from-rev: origin/main   # uncomment for PR-only checks

# ─────────────────────────────────────────────
# OUTPUT
# ─────────────────────────────────────────────
output:
  formats:
    - format: colored-line-number
  print-issued-lines: true
  print-linter-name: true
  sort-results: true
  sort-order:
    - file
    - linter
    - severity

# ─────────────────────────────────────────────
# SEVERITY OVERRIDES (optional)
# ─────────────────────────────────────────────
severity:
  default-severity: warning
  rules:
    - linters:
        - errcheck
        - govet
      severity: error
    - linters:
        - misspell
        - lll
      severity: info
```

## Quick Customization Checklist

1. Replace `example.com/myorg` in `goimports.local-prefixes` with your module path.
2. Adjust `funlen.lines` and complexity thresholds to match team standards.
3. Add project-specific `exclude-rules` for known false positives.
4. For new projects, start with `disable-all: true` and enable progressively (see SKILL.md adoption guide).
5. Pin golangci-lint version in CI to avoid drift.
