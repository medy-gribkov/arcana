---
name: ci-cd-pipelines
description: GitHub Actions and GitLab CI/CD pipeline expertise. Workflow syntax, job matrix, dependency caching (npm, pip, go, docker layers), artifact management, reusable workflows, composite actions, environment secrets, deployment patterns (blue-green, canary, rolling), Docker builds in CI, version bumping, branch protection, status checks. Use when creating CI/CD pipelines, optimizing build times, setting up deployment automation, or configuring GitHub Actions workflows.
---

You are a senior DevOps engineer who builds fast, reliable CI/CD pipelines with zero tolerance for flaky builds.

## Use this skill when

- Creating or modifying GitHub Actions or GitLab CI workflows
- Optimizing CI build times or caching strategies
- Setting up deployment automation (staging, production)
- Configuring Docker builds in CI
- Designing branch protection and merge requirements
- Automating version bumping or changelog generation

## GitHub Actions: Workflow Fundamentals

### Minimal Production Workflow
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test -- --coverage
      - run: pnpm build
```

Critical rules:
- Always set `timeout-minutes`. Default is 360 (6 hours). A hung job burns your minutes.
- Always use `concurrency` with `cancel-in-progress` on PRs. No reason to test stale commits.
- Always pin action versions to major (`@v4`) or SHA for security-critical actions.
- Always use `--frozen-lockfile` / `--ci` to prevent lockfile drift.

### Job Matrix
```yaml
jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [18, 20, 22]
        exclude:
          - os: windows-latest
            node: 18
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
```

Set `fail-fast: false` to see all failures, not just the first. Exclude combinations that don't matter.

## Caching Strategies

### Node.js (pnpm)
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: "pnpm"
# This caches the pnpm store. For node_modules caching:
- uses: actions/cache@v4
  with:
    path: node_modules
    key: modules-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
```

### Go
```yaml
- uses: actions/setup-go@v5
  with:
    go-version: "1.23"
    cache: true  # Caches ~/go/pkg/mod and ~/.cache/go-build
```

### Python (pip)
```yaml
- uses: actions/setup-python@v5
  with:
    python-version: "3.12"
    cache: "pip"
    cache-dependency-path: requirements*.txt
```

### Docker Layer Caching
```yaml
- uses: docker/build-push-action@v5
  with:
    context: .
    push: ${{ github.ref == 'refs/heads/main' }}
    tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

`type=gha` uses GitHub Actions cache backend -- no external registry needed. `mode=max` caches all layers, not just final.

## Reusable Workflows

### Caller
```yaml
# .github/workflows/ci.yml
jobs:
  test:
    uses: ./.github/workflows/reusable-test.yml
    with:
      node-version: 20
    secrets: inherit
```

### Callee
```yaml
# .github/workflows/reusable-test.yml
on:
  workflow_call:
    inputs:
      node-version:
        type: number
        default: 20
    secrets:
      NPM_TOKEN:
        required: false

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
```

Use `secrets: inherit` to pass all secrets. Use explicit `secrets:` block for cross-repo calls.

## Composite Actions

For reusable steps (not jobs). Lives in `.github/actions/<name>/action.yml`.

```yaml
# .github/actions/setup-project/action.yml
name: Setup Project
description: Install deps and cache
inputs:
  node-version:
    default: "20"
runs:
  using: composite
  steps:
    - uses: pnpm/action-setup@v4
      with:
        version: 9
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: "pnpm"
    - run: pnpm install --frozen-lockfile
      shell: bash
```

Every `run` step in a composite action MUST specify `shell: bash`.

## Secrets & Environments

```yaml
jobs:
  deploy-staging:
    environment: staging  # Requires approval if configured
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
    steps:
      - run: echo "Deploying to staging"

  deploy-production:
    needs: deploy-staging
    environment: production  # Separate approvers, separate secrets
    steps:
      - run: echo "Deploying to production"
```

Never log secrets. Use `::add-mask::` if you must construct a secret dynamically:
```yaml
- run: |
    TOKEN=$(generate-token)
    echo "::add-mask::$TOKEN"
    echo "TOKEN=$TOKEN" >> $GITHUB_ENV
```

## Deployment Patterns

### Blue-Green (zero-downtime swap)
```yaml
deploy:
  steps:
    - run: |
        # Deploy to inactive slot
        az webapp deployment slot create --name myapp --slot staging
        az webapp deploy --slot staging --src-path dist.zip
        # Smoke test staging
        curl --fail https://myapp-staging.azurewebsites.net/health
        # Swap
        az webapp deployment slot swap --name myapp --slot staging --target-slot production
```

### Canary (gradual rollout)
```yaml
- run: |
    kubectl set image deployment/app app=myimage:${{ github.sha }}
    kubectl rollout status deployment/app --timeout=120s
    # Route 10% traffic to new version
    kubectl apply -f canary-10-percent.yaml
    sleep 300
    # Check error rate, proceed or rollback
    ERROR_RATE=$(curl -s prometheus/api/v1/query?query=error_rate)
    if [ $(echo "$ERROR_RATE > 0.01" | bc) -eq 1 ]; then
      kubectl rollout undo deployment/app
      exit 1
    fi
    kubectl apply -f canary-100-percent.yaml
```

### Rolling (Kubernetes default)
Kubernetes `RollingUpdate` with `maxSurge: 1` and `maxUnavailable: 0` for zero-downtime.

## Docker in CI

### Multi-stage Dockerfile optimized for CI
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
CMD ["dist/index.js"]
```

Order layers by change frequency: OS < runtime < deps < source. Each line is a cache layer.

## Version Bumping with Changesets

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
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - uses: changesets/action@v1
        with:
          publish: pnpm release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Branch Protection Checklist

Configure in repo Settings > Branches > Branch protection rules:
- Require PR reviews (1 minimum, dismiss stale on new push)
- Require status checks: `test`, `lint`, `build` must pass
- Require branches up to date before merge
- Require signed commits for high-security repos
- Restrict force pushes (always, no exceptions on main)

## GitLab CI Basics

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

variables:
  PIP_CACHE_DIR: "$CI_PROJECT_DIR/.cache/pip"

cache:
  key: "$CI_COMMIT_REF_SLUG"
  paths:
    - .cache/pip
    - node_modules/

test:
  stage: test
  image: python:3.12
  script:
    - pip install -r requirements.txt
    - pytest --cov=src --junitxml=report.xml
  artifacts:
    reports:
      junit: report.xml

build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  only:
    - main
```

Key GitLab differences from GitHub Actions:
- `stages` define order; jobs in same stage run in parallel.
- `cache` is per-runner, not per-repo. Use `key` carefully.
- `artifacts` pass files between stages (GitHub uses `actions/upload-artifact`).
- `services` for Docker-in-Docker (GitHub uses `docker/setup-buildx-action`).

## Artifact Caching Gotchas

GitHub Actions cache has a 10GB limit per repo. When the cache fills up, older entries are evicted. Common issues:

- **Cache thrashing**: Too many unique cache keys (e.g., using `${{ github.sha }}` as key). Use stable keys like `${{ hashFiles('**/package-lock.json') }}`.
- **Never-hit cache**: Key changes on every run. Use `restore-keys` for fallback.
- **Stale dependencies**: Cache never invalidates. Include dependency file hash in the key.

```yaml
# BAD: Cache key changes on every commit (never hits)
- uses: actions/cache@v4
  with:
    key: deps-${{ github.sha }}

# GOOD: Stable key based on lockfile, with fallback
- uses: actions/cache@v4
  with:
    key: deps-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: deps-${{ runner.os }}-
```

## Job Matrix Strategy Example

```yaml
jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [18, 20, 22]
        include:
          # Add extra config for specific combinations
          - os: ubuntu-latest
            node: 22
            coverage: true
        exclude:
          # Skip expensive combinations
          - os: macos-latest
            node: 18
          - os: windows-latest
            node: 18
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: pnpm test
      - if: matrix.coverage
        run: pnpm test --coverage
        # Upload coverage only for one matrix combination
```

## CI Performance Rules

1. **Parallelize everything**: lint, test, typecheck, build as separate jobs. They don't depend on each other.
2. **Cache aggressively**: dependency installs are the #1 time sink. Cache both store and node_modules.
3. **Fail fast**: put lint and typecheck before tests. They're 10x faster and catch 50% of issues.
4. **Skip unnecessary work**: use path filters to skip CI for docs-only changes.
5. **Use `ubuntu-latest`**: it's 2-3x faster than `macos-latest` and 5-10x faster than `windows-latest`.

```yaml
on:
  push:
    paths-ignore:
      - "docs/**"
      - "*.md"
      - ".gitignore"
```
