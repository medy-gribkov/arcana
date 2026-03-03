# Changelog Automation

## Conventional Commits Format

```
type(scope): subject

body

footer
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding tests
- `chore`: Maintenance

**Examples:**
```bash
git commit -m "feat(auth): add JWT refresh token support"
git commit -m "fix(api): prevent race condition in user creation"
git commit -m "docs: update API authentication guide"
```

## Generate Changelog with standard-version

```bash
npm install -D standard-version

# First release
npx standard-version --first-release

# Subsequent releases
npx standard-version
```

**Generated CHANGELOG.md:**
```markdown
# Changelog

## [1.2.0](https://github.com/user/repo/compare/v1.1.0...v1.2.0) (2024-02-14)

### Features

* **auth:** add JWT refresh token support ([abc123](https://github.com/user/repo/commit/abc123))

### Bug Fixes

* **api:** prevent race condition in user creation ([def456](https://github.com/user/repo/commit/def456))
```

## Automate with GitHub Actions (Release Please)

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: google-github-actions/release-please-action@v3
        with:
          release-type: node
          package-name: my-package
```

Release Please creates a PR that:
- Updates CHANGELOG.md
- Bumps version in package.json
- When merged, creates a GitHub Release

## CI Documentation Pipeline

```yaml
# .github/workflows/docs.yml
name: Documentation

on:
  push:
    branches: [main]

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate OpenAPI spec
        run: |
          npm run generate-openapi
          spectral lint openapi.yaml

      - name: Render Mermaid diagrams
        run: |
          npm install -g @mermaid-js/mermaid-cli
          mmdc -i docs/architecture.mmd -o docs/architecture.svg

      - name: Build docs site
        run: npm run docs:build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs-build
```
