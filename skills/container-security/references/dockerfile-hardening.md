# Dockerfile Hardening Patterns

## Minimal Base Images

**BAD:** Using full OS images with unnecessary packages.

```dockerfile
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y curl ca-certificates
COPY app /app
CMD ["/app"]
```

**GOOD:** Use distroless for runtime. Zero shell, zero package manager.

```dockerfile
FROM golang:1.23 AS builder
WORKDIR /build
COPY . .
RUN CGO_ENABLED=0 go build -o app

FROM gcr.io/distroless/static-debian12
COPY --from=builder /build/app /app
CMD ["/app"]
```

**For Node.js apps:**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /build
COPY package*.json ./
RUN npm ci --only=production
COPY . .

FROM gcr.io/distroless/nodejs20-debian12
COPY --from=builder /build /app
WORKDIR /app
CMD ["server.js"]
```

**For statically compiled binaries (Go, Rust):**

```dockerfile
FROM golang:1.23 AS builder
WORKDIR /build
COPY . .
RUN CGO_ENABLED=0 go build -o app

FROM scratch
COPY --from=builder /build/app /app
CMD ["/app"]
```

## Rootless Containers

**BAD:** Running as root. Attackers who escape the container have root on the host.

```dockerfile
FROM node:20-alpine
COPY . /app
CMD ["node", "server.js"]
```

**GOOD:** Create a non-root user and switch to it.

```dockerfile
FROM node:20-alpine
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --chown=appuser:appgroup . .
USER appuser
CMD ["node", "server.js"]
```

For distroless images, use the built-in `nonroot` user.

```dockerfile
FROM gcr.io/distroless/static-debian12:nonroot
COPY --chown=65532:65532 app /app
USER 65532
CMD ["/app"]
```

## Complete Dockerfile: BAD vs GOOD

**BAD:** Multiple issues in one Dockerfile.

```dockerfile
FROM ubuntu:latest
RUN apt-get update
RUN apt-get install -y curl wget
ADD https://example.com/app.tar.gz /app.tar.gz
RUN tar -xzf /app.tar.gz
ENV SECRET_KEY=abc123
COPY . .
CMD bash start.sh
```

**GOOD:** Minimal, secure, efficient.

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine@sha256:abc123... AS builder
WORKDIR /build
COPY package*.json ./
RUN npm ci --only=production
COPY . .

FROM gcr.io/distroless/nodejs20-debian12:nonroot
WORKDIR /app
COPY --from=builder /build /app
USER 65532
CMD ["server.js"]
```

**Fixes applied:**

1. Pin base image by digest.
2. Use multi-stage build to separate build and runtime.
3. Use distroless runtime image.
4. Run as non-root user.
5. No secrets in environment variables.
6. Use `COPY` instead of `ADD` (no auto-extraction or URL fetching).
7. Combine `apt-get update` and `install` in one layer to avoid cache staleness.

## Common Mistakes

**Using `latest` tag.** Tags are mutable. Pin versions or digests.

**Using `ADD` instead of `COPY`.** `ADD` auto-extracts archives and fetches URLs, expanding attack surface.

**Separate `apt-get update` and `install` layers.** The update layer gets cached and becomes stale.

**BAD:**

```dockerfile
RUN apt-get update
RUN apt-get install -y curl
```

**GOOD:**

```dockerfile
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
```

**Mounting Docker socket.** Grants full host access. Never do this in production.

```bash
# BAD
docker run -v /var/run/docker.sock:/var/run/docker.sock myapp
```
