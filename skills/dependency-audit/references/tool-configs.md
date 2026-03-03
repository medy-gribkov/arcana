# Dependency Audit Tool Configurations

## Dependabot

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
    open-pull-requests-limit: 10
    labels:
      - dependencies
      - automated
    ignore:
      # Don't auto-update major versions
      - dependency-name: "*"
        update-types: ["version-update:semver-major"]
    groups:
      eslint:
        patterns:
          - "eslint*"
          - "@typescript-eslint/*"

  - package-ecosystem: gomod
    directory: "/"
    schedule:
      interval: weekly
    open-pull-requests-limit: 5

  - package-ecosystem: pip
    directory: "/"
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
```

## Renovate

```json
{
  "extends": ["config:base"],
  "packageRules": [
    {
      "matchUpdateTypes": ["patch"],
      "automerge": true,
      "automergeType": "pr",
      "automergeStrategy": "squash"
    },
    {
      "matchPackagePatterns": ["^@types/"],
      "groupName": "type definitions"
    }
  ],
  "schedule": ["after 10pm every weekday"]
}
```

## Snyk

### CLI Usage

```bash
# Install
npm install -g snyk

# Authenticate
snyk auth

# Test for vulnerabilities
snyk test

# Monitor project (adds to Snyk dashboard)
snyk monitor

# Test specific manifest
snyk test --file=package.json
snyk test --file=go.mod
snyk test --file=requirements.txt
```

### CI Integration

```yaml
# .github/workflows/snyk.yml
name: Snyk Security
on:
  push:
    branches: [main]
  pull_request:

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high
```

### .snyk Policy File

```yaml
# .snyk
version: v1.25.0
ignore:
  SNYK-JS-LODASH-1234567:
    - '*':
        reason: 'Not exploitable in our usage. Lodash merge never receives user input.'
        expires: 2024-06-01T00:00:00.000Z
patch: {}
```

## Socket.dev

### GitHub App Setup

1. Install Socket GitHub App from GitHub Marketplace.
2. Socket automatically analyzes PRs that add or update dependencies.
3. Flags: typosquatting, install scripts, obfuscated code, network access.

### CLI Usage

```bash
# Install
npm install -g @socketsecurity/cli

# Scan package.json
socket npm audit

# Scan specific package before installing
socket npm info <package-name>
```

### What Socket Catches That npm audit Misses

- Supply chain attacks (malicious publish of popular package name)
- Packages with install scripts that run arbitrary code
- Packages that access network/filesystem unexpectedly
- Typosquatting (e.g., `lodassh` instead of `lodash`)

## License Scanning

### license-checker (npm)

```bash
npx license-checker --json > licenses.json
npx license-checker --failOn "GPL;AGPL;SSPL"
```

### go-licenses (Go)

```bash
go install github.com/google/go-licenses@latest
go-licenses report ./... --template licenses.tpl > licenses.txt
```

### pip-licenses (Python)

```bash
pip install pip-licenses
pip-licenses --format=json > licenses.json
pip-licenses --fail-on="GPL"
```

## SBOM Generation

```bash
# syft (multi-language)
syft dir:. -o spdx-json > sbom.spdx.json

# cdxgen (Node/Python/Go)
npm install -g @cyclonedx/cdxgen
cdxgen -o sbom.json
```

Attach to GitHub releases:
```yaml
- name: Generate SBOM
  run: syft dir:. -o spdx-json > sbom.spdx.json
- uses: softprops/action-gh-release@v1
  with:
    files: sbom.spdx.json
```

## CI Audit Pipeline (All Ecosystems)

```yaml
# .github/workflows/audit.yml
name: Dependency Audit
on:
  schedule:
    - cron: '0 0 * * 1'  # Weekly Monday
  push:
    branches: [main]

jobs:
  audit-npm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm audit --audit-level=high

  audit-go:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.23'
      - run: |
          go install golang.org/x/vuln/cmd/govulncheck@latest
          govulncheck ./...

  audit-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: |
          pip install pip-audit
          pip-audit -r requirements.txt
```
