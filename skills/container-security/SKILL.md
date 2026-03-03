---
name: container-security
description: Container security from build to runtime. Image scanning, minimal base images, rootless execution, secrets management, supply chain verification, and runtime policies with concrete Dockerfile examples.
---

## Image Scanning

Run Trivy before every push. Fail CI on HIGH or CRITICAL vulnerabilities.

```bash
trivy image myapp:latest --severity HIGH,CRITICAL --exit-code 1
```

Use Grype as a second scanner. Different scanners catch different CVEs.

```bash
grype myapp:latest --fail-on high
```

Store scan results as build artifacts for trending.

```bash
trivy image myapp:latest --format json --output scan-results.json
```

## Minimal Base Images

Use distroless or scratch for runtime. Multi-stage builds separate build tools from runtime. See references/dockerfile-hardening.md for complete BAD/GOOD Dockerfile patterns for Go, Node.js, and static binaries.

## Rootless Containers

Always create a non-root user and switch to it. For distroless, use the built-in `nonroot` user (UID 65532). See references/dockerfile-hardening.md for rootless patterns.

## Secrets Management

**BAD:** Baking secrets into the image. They persist in layers even if deleted.

```dockerfile
FROM node:20-alpine
ENV DATABASE_PASSWORD=supersecret
COPY . /app
CMD ["node", "server.js"]
```

**GOOD:** Inject secrets at runtime via environment variables or mounted files.

```bash
docker run -e DATABASE_PASSWORD="$(cat /secure/db-password)" myapp:latest
```

For Kubernetes, use Secrets mounted as volumes or environment variables.

```yaml
env:
  - name: DATABASE_PASSWORD
    valueFrom:
      secretKeyRef:
        name: db-credentials
        key: password
```

### Build-Time Secrets

Use BuildKit secrets for credentials needed during build (e.g., private registry tokens).

**BAD:** Copying `.env` file into the image.

```dockerfile
COPY .env /build/.env
RUN npm install --registry=https://private.npm.com
```

**GOOD:** Mount secrets during build without persisting them.

```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm install --registry=https://private.npm.com
```

Build with:

```bash
docker buildx build --secret id=npmrc,src=.npmrc .
```

### Audit .dockerignore

Ensure secrets never enter the build context.

```
.env
.env.*
*.key
*.pem
secrets/
credentials.json
```

Scan committed Dockerfiles for hardcoded tokens.

```bash
gitleaks detect --source . --no-git
```

## Supply Chain Security

### Sign Images with Cosign

Sign after building. Verify before deploying.

```bash
cosign sign myregistry.com/myapp:v1.0.0
```

Verify signature before pull.

```bash
cosign verify --key cosign.pub myregistry.com/myapp:v1.0.0
```

### Generate SBOM

Create a Software Bill of Materials for every release.

```bash
syft myapp:latest -o json > sbom.json
trivy image --format cyclonedx --output sbom.json myapp:latest
```

Attach SBOM to the image as an OCI artifact.

```bash
cosign attach sbom --sbom sbom.json myregistry.com/myapp:v1.0.0
```

### Pin Dependencies by Digest

**BAD:** Using mutable tags. Tags can be overwritten.

```dockerfile
FROM node:20-alpine
```

**GOOD:** Pin by digest. Digest is immutable.

```dockerfile
FROM node:20-alpine@sha256:abc123...
```

Find digests with:

```bash
docker pull node:20-alpine
docker inspect node:20-alpine | jq -r '.[0].RepoDigests[0]'
```

## Runtime Policies

Admission control (Gatekeeper, Kyverno), seccomp profiles, and Falco runtime monitoring. See references/runtime-security.md for policy YAML examples and Falco rules.

## CI Checklist

1. Lint Dockerfile with Hadolint.

```bash
hadolint Dockerfile
```

2. Scan for secrets in build context.

```bash
gitleaks detect --source . --no-git
```

3. Build and scan image.

```bash
docker build -t myapp:latest .
trivy image myapp:latest --exit-code 1 --severity HIGH,CRITICAL
```

4. Sign image and generate SBOM.

```bash
cosign sign myregistry.com/myapp:v1.0.0
syft myapp:latest -o json > sbom.json
```

5. Push to registry with immutable tag.

```bash
docker tag myapp:latest myregistry.com/myapp:v1.0.0
docker push myregistry.com/myapp:v1.0.0
```

6. Verify signature before deploying.

```bash
cosign verify --key cosign.pub myregistry.com/myapp:v1.0.0
```

## Dockerfile Best Practices

Complete BAD/GOOD Dockerfile comparisons and common mistakes. See references/dockerfile-hardening.md for full examples.
