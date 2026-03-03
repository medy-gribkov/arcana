---
name: dependency-audit
description: Audit dependencies for vulnerabilities, license compliance, and outdated packages across npm, Go, and Python. Includes reading audit output, prioritizing fixes, and CI automation.
---

# Dependency Audit

## Audit Workflow

Follow this pattern for all ecosystems:

1. **Scan** - Run audit tools to detect issues
2. **Read** - Parse output, understand severity
3. **Prioritize** - Sort by risk (critical > high > medium)
4. **Fix** - Apply patches or upgrade
5. **Automate** - Add to CI to prevent regressions

## npm Audit

```bash
npm audit                     # Interactive report
npm audit --json > audit.json # JSON for CI parsing
npm audit --omit=dev          # Production deps only
npm audit fix                 # Auto-fix compatible updates
npm audit fix --force         # Include breaking changes (review first!)
```

**BAD - Ignoring transitive vulnerabilities:**
```json
{
  "dependencies": {
    "express": "4.17.0"
  }
}
```

**GOOD - Force resolution to patched version:**
```json
{
  "dependencies": {
    "express": "4.17.0"
  },
  "overrides": {
    "lodash": "4.17.21"
  }
}
```

## Go Module Auditing

```bash
go install golang.org/x/vuln/cmd/govulncheck@latest
govulncheck ./...             # Scan project
govulncheck -json ./...       # JSON output
```

govulncheck shows "Call stacks in your code" so you only fix vulnerabilities you actually use.

```bash
go get github.com/lib/pq@v1.10.9  # Update specific module
go mod tidy                         # Clean up
go mod verify                       # Verify checksums
```

## Python Dependency Auditing

```bash
pip install pip-audit
pip-audit                          # Audit installed packages
pip-audit -r requirements.txt      # Audit requirements file
pip-audit --fix                    # Auto-upgrade vulnerable packages
```

**BAD - Unpinned dependencies:**
```
requests
flask
```

**GOOD - Pinned with pip-compile:**
```
# requirements.in
requests>=2.28.0
flask>=2.3.0

# pip-compile requirements.in -> requirements.txt with exact versions
```

## License Compliance

```bash
# npm
npx license-checker --json > licenses.json

# Go
go-licenses report ./... --template licenses.tpl > licenses.txt

# Python
pip-licenses --format=json > licenses.json
```

## Severity Prioritization

```
Critical: Fix immediately (< 24 hours)
High:     Fix in next sprint (< 1 week)
Medium:   Fix when convenient
Low:      Monitor, fix if easy
```

## Automated Updates and Tool Configs

Dependabot, Renovate, Snyk, Socket.dev configurations, SBOM generation, and multi-ecosystem CI audit pipelines.

See references/tool-configs.md for complete configuration files and CI workflow templates.

## Lockfile Hygiene

```
npm:    Commit package-lock.json, use npm ci in CI
Go:     Commit go.sum, run go mod verify
Python: Commit requirements.txt (from pip-compile) or poetry.lock
```

---

**Use this skill**: When security vulnerabilities are detected, before major releases, or when setting up dependency monitoring in CI.
