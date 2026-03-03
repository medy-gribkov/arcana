---
name: ci-cd-automation
description: Build CI/CD pipelines for multi-language projects (Go, Node, Python, Unity, Unreal). Covers automated testing, Docker caching, platform builds, and deployment strategies.
---

# CI/CD Automation

## Multi-Language Pipeline Strategy

Modern projects often mix languages. Structure CI to validate, test, and build each ecosystem independently while sharing cache infrastructure.

**Typical pipeline stages:**
1. **Validate** (< 5 min) - Lint, type check, fast static analysis
2. **Test** (10-30 min) - Unit, integration, PlayMode tests
3. **Build** (parallel) - Generate platform-specific artifacts
4. **Deploy** - Dev auto, staging gated, prod manual

## Node.js CI Pipeline

### Step 1: Basic Workflow

```yaml
# .github/workflows/node-ci.yml
name: Node.js CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  test:
    runs-on: ubuntu-latest
    needs: validate
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm test -- --coverage

      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm run build

      - uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/
          retention-days: 7
```

### Step 2: Add Docker Build with Caching

```yaml
# .github/workflows/docker.yml
name: Docker Build

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**BAD - No layer caching:**
```dockerfile
FROM node:20
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
# Every file change invalidates cache
```

**GOOD - Optimized layer caching:**
```dockerfile
FROM node:20 AS builder
WORKDIR /app

# Cache dependencies separately
COPY package*.json ./
RUN npm ci --only=production

# Then copy source
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

## Go CI Pipeline

### Step 1: Lint, Test, Build

```yaml
# .github/workflows/go.yml
name: Go CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.23'
          cache: true

      - name: golangci-lint
        uses: golangci/golangci-lint-action@v4
        with:
          version: latest
          args: --timeout=5m

  test:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.23'
          cache: true

      - run: go test -v -race -coverprofile=coverage.out ./...
      - run: go tool cover -html=coverage.out -o coverage.html

      - uses: actions/upload-artifact@v3
        with:
          name: coverage
          path: coverage.html

  build:
    runs-on: ubuntu-latest
    needs: test
    strategy:
      matrix:
        goos: [linux, windows, darwin]
        goarch: [amd64, arm64]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.23'
          cache: true

      - name: Build
        env:
          GOOS: ${{ matrix.goos }}
          GOARCH: ${{ matrix.goarch }}
        run: |
          go build -v -o bin/app-${{ matrix.goos }}-${{ matrix.goarch }} ./cmd/app

      - uses: actions/upload-artifact@v3
        with:
          name: binaries
          path: bin/
```

### Step 2: Vulnerability Scanning

```yaml
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.23'

      - name: Run govulncheck
        run: |
          go install golang.org/x/vuln/cmd/govulncheck@latest
          govulncheck ./...
```

## Python CI Pipeline

```yaml
# .github/workflows/python.yml
name: Python CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.10', '3.11', '3.12']

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
          cache: 'pip'

      - run: pip install -r requirements.txt
      - run: pip install pytest pytest-cov

      - run: pytest --cov=src --cov-report=xml

      - uses: codecov/codecov-action@v3
        if: matrix.python-version == '3.12'
        with:
          files: ./coverage.xml

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: 'pip'

      - run: pip install ruff mypy
      - run: ruff check .
      - run: mypy src/
```

## Unity CI Pipeline

```yaml
# .github/workflows/unity.yml
name: Unity Build

on:
  push:
    branches: [main, develop]

env:
  UNITY_LICENSE: ${{ secrets.UNITY_LICENSE }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          lfs: true

      - uses: actions/cache@v3
        with:
          path: Library
          key: Library-${{ hashFiles('Assets/**', 'Packages/**', 'ProjectSettings/**') }}
          restore-keys: Library-

      - uses: game-ci/unity-test-runner@v4
        with:
          testMode: all
          artifactsPath: test-results

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: test-results

  build:
    needs: test
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        targetPlatform:
          - StandaloneWindows64
          - StandaloneLinux64
          - WebGL
          - Android

    steps:
      - uses: actions/checkout@v4
        with:
          lfs: true

      - uses: actions/cache@v3
        with:
          path: Library
          key: Library-${{ matrix.targetPlatform }}-${{ hashFiles('Assets/**') }}
          restore-keys: Library-${{ matrix.targetPlatform }}-

      - uses: game-ci/unity-builder@v4
        with:
          targetPlatform: ${{ matrix.targetPlatform }}
          versioning: Semantic
          buildMethod: BuildScript.PerformBuild

      - uses: actions/upload-artifact@v3
        with:
          name: Build-${{ matrix.targetPlatform }}
          path: build/${{ matrix.targetPlatform }}
          retention-days: 14
```

**Unity Build Script Example:**
```csharp
// Assets/Editor/BuildScript.cs
using UnityEditor;
using UnityEditor.Build.Reporting;

public class BuildScript
{
    public static void PerformBuild()
    {
        BuildPlayerOptions options = new BuildPlayerOptions
        {
            scenes = new[] { "Assets/Scenes/Main.unity" },
            locationPathName = "build/Game.exe",
            target = BuildTarget.StandaloneWindows64,
            options = BuildOptions.None
        };

        BuildReport report = BuildPipeline.BuildPlayer(options);

        if (report.summary.result != BuildResult.Succeeded)
        {
            EditorApplication.Exit(1);
        }
    }
}
```

## Docker Build Optimization

**Layer caching strategy:**

```dockerfile
# Multi-stage build with optimal caching
FROM golang:1.23 AS builder

WORKDIR /app

# Cache go.mod downloads
COPY go.mod go.sum ./
RUN go mod download

# Cache build dependencies
COPY . .
RUN CGO_ENABLED=0 go build -o app ./cmd/app

# Minimal runtime image
FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/app .
CMD ["./app"]
```

**GitHub Actions cache usage:**
```yaml
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
    # mode=max exports all layers, not just final
```

## Automated Testing Examples

### PlayMode Unity Test

```csharp
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using System.Collections;

public class PlayerMovementTests
{
    private GameObject _player;
    private PlayerController _controller;

    [UnitySetUp]
    public IEnumerator SetUp()
    {
        var prefab = Resources.Load<GameObject>("Prefabs/Player");
        _player = Object.Instantiate(prefab);
        _controller = _player.GetComponent<PlayerController>();
        yield return null;
    }

    [UnityTest]
    public IEnumerator Player_MovesForward_WhenInputApplied()
    {
        Vector3 startPos = _player.transform.position;

        _controller.SetInput(Vector2.up);
        yield return new WaitForSeconds(0.5f);

        Assert.Greater(_player.transform.position.z, startPos.z);
    }

    [UnityTearDown]
    public IEnumerator TearDown()
    {
        Object.Destroy(_player);
        yield return null;
    }
}
```

### Go Integration Test

```go
// integration_test.go
//go:build integration
// +build integration

package main_test

import (
    "net/http"
    "net/http/httptest"
    "testing"
)

func TestAPIEndpoint(t *testing.T) {
    req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
    w := httptest.NewRecorder()

    handler.ServeHTTP(w, req)

    if w.Code != http.StatusOK {
        t.Errorf("expected 200, got %d", w.Code)
    }
}
```

Run in CI:
```yaml
- run: go test -tags=integration -v ./...
```

## Deployment Strategies

### Blue-Green Deployment (Web Apps)

```yaml
# .github/workflows/deploy.yml
deploy-staging:
  runs-on: ubuntu-latest
  environment: staging
  steps:
    - uses: actions/download-artifact@v3
      with:
        name: dist

    - name: Deploy to Blue Environment
      run: |
        aws s3 sync ./dist s3://app-blue/
        aws cloudfront create-invalidation --distribution-id ${{ secrets.CF_ID }}

    - name: Health Check
      run: curl -f https://blue.example.com/health

    - name: Switch Traffic
      run: |
        # Route53 weighted routing update
        aws route53 change-resource-record-sets --hosted-zone-id $ZONE_ID ...
```

### Rolling Deployment (Game Servers)

```yaml
deploy-servers:
  runs-on: ubuntu-latest
  steps:
    - name: Deploy to 25% of servers
      run: kubectl set image deployment/game-server app=myapp:${{ github.sha }} --record

    - name: Wait and monitor
      run: sleep 300

    - name: Check error rate
      run: |
        ERROR_RATE=$(curl -s https://metrics.example.com/errors)
        if [ "$ERROR_RATE" -gt 5 ]; then
          kubectl rollout undo deployment/game-server
          exit 1
        fi

    - name: Full rollout
      run: kubectl rollout status deployment/game-server
```

## Quick Reference

**Build Time Optimization:**
```
Strategy              Savings    Effort
Library caching       30-50%     Low
Parallel jobs         40-60%     Low
Self-hosted runners   20-40%     Medium
Docker layer cache    50-70%     Low
```

**Common Commands:**
```bash
# Node
npm ci              # Faster than npm install in CI
npm run build       # Production build

# Go
go test -race ./... # Race detector
go build -ldflags "-s -w" # Strip debug symbols

# Python
pip install --no-cache-dir # Don't cache in containers
pytest -n auto      # Parallel tests

# Docker
docker buildx build --cache-from=type=gha # Use GHA cache
```

**Platform Build Times:**
```
Unity WebGL:     10-20 min
Unity Windows:   5-10 min
Unity Android:   15-25 min
Go binary:       1-3 min
Node build:      2-5 min
Docker image:    3-8 min
```

---

**Use this skill**: When setting up CI/CD, optimizing build times, or automating deployments across multi-language projects.
