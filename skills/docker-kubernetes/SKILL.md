---
name: docker-kubernetes
description: Production Docker and Kubernetes patterns including multi-stage builds, minimal base images, non-root users, layer caching, docker-compose for development, K8s Deployments, Services, Ingress, ConfigMaps, Secrets, health checks, resource limits, HPA autoscaling, security contexts, and Helm chart basics. Use when containerizing apps or deploying to Kubernetes.
---
You are a DevOps engineer specializing in production-grade Docker containers and Kubernetes deployments with security, performance, and reliability best practices.

## Use this skill when

- Writing or reviewing Dockerfiles
- Setting up docker-compose for local development
- Creating Kubernetes manifests (Deployments, Services, Ingress)
- Configuring health checks, resource limits, or autoscaling
- Hardening container security

## Production Dockerfile (Multi-Stage)

### Go Service
```dockerfile
# Stage 1: Build
FROM golang:1.23-alpine AS builder
RUN apk add --no-cache git ca-certificates
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app ./cmd/server

# Stage 2: Runtime (scratch = smallest possible image)
FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app /app
USER 65534:65534
EXPOSE 8080
ENTRYPOINT ["/app"]
```

### Node.js Service
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build && npm prune --production

FROM node:20-alpine
RUN addgroup -g 1001 app && adduser -u 1001 -G app -s /bin/sh -D app
WORKDIR /app
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/package.json ./
USER app
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Python Service (Multi-stage with uv)
```dockerfile
FROM python:3.12-slim AS builder
RUN pip install --no-cache-dir uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-editable
COPY src/ ./src/

FROM python:3.12-slim
RUN groupadd -r app && useradd -r -g app -s /sbin/nologin app
WORKDIR /app
COPY --from=builder /app /app
USER app
EXPOSE 8000
CMD ["/app/.venv/bin/python", "-m", "uvicorn", "myapp.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Python Service (Traditional pip)
```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.12-slim
RUN groupadd -r app && useradd -r -g app -s /sbin/nologin app
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . .
ENV PATH=/root/.local/bin:$PATH
USER app
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "myapp.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Dockerfile Best Practices

1. **Base images:** Use `alpine` or `slim` variants. Use `scratch` or `distroless` for Go/Rust. Never use `latest` tag. Current stable versions: `node:20-alpine`, `python:3.12-slim`, `golang:1.23-alpine`.
2. **Non-root user:** Always run as non-root. Create a dedicated user. `USER 65534` (nobody) for scratch images.
3. **Layer caching:** Copy dependency files first (`go.mod`, `package.json`), install deps, THEN copy source. This caches the dependency layer.
4. **No secrets in images:** Never `COPY .env` or `ARG PASSWORD`. Use runtime environment variables or mounted secrets.
5. **`.dockerignore`:** Always include one. At minimum: `.git`, `node_modules`, `__pycache__`, `.env`, `*.md`, `tests/`.
6. **Pin versions:** `FROM node:20.5-alpine` not `FROM node:alpine`. Pin in CI, allow minor updates in dev.
7. **Single process per container:** Don't run supervisor/systemd. One process, one container.
8. **Health checks in Dockerfile:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1
```

## Docker Compose for Development

```yaml
# docker-compose.yml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder           # stop at build stage for dev
    ports:
      - "8080:8080"
    volumes:
      - .:/app                  # live reload
      - /app/node_modules       # anonymous volume prevents overwrite
    environment:
      - DATABASE_URL=postgres://user:pass@db:5432/mydb
      - REDIS_URL=redis://cache:6379
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: mydb
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d mydb"]
      interval: 5s
      timeout: 3s
      retries: 5

  cache:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  labels:
    app: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0          # zero-downtime deploys
  template:
    metadata:
      labels:
        app: api
    spec:
      serviceAccountName: api-sa
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: api
          image: ghcr.io/myorg/api:v1.2.3   # always pin tag, never :latest
          ports:
            - containerPort: 8080
              protocol: TCP
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: api-secrets
                  key: database-url
            - name: LOG_LEVEL
              valueFrom:
                configMapKeyRef:
                  name: api-config
                  key: log-level
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /health/live
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 15
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /health/live
              port: 8080
            periodSeconds: 5
            failureThreshold: 30   # 150s max startup time
      terminationGracePeriodSeconds: 30
```

## Service and Ingress

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 8080
      protocol: TCP
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  ingressClassName: nginx
  tls:
    - hosts: [api.example.com]
      secretName: api-tls
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
```

## ConfigMap and Secrets

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-config
data:
  log-level: "info"
  cors-origins: "https://myapp.com,https://staging.myapp.com"
---
apiVersion: v1
kind: Secret
metadata:
  name: api-secrets
type: Opaque
stringData:                     # use stringData for plain text, data for base64
  database-url: "postgres://user:pass@db:5432/mydb"
```

**Secret management:** K8s Secrets are base64-encoded, NOT encrypted at rest by default. For production, use: Sealed Secrets, External Secrets Operator (syncs from AWS SSM/Vault), or SOPS-encrypted manifests.

## Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 2
  maxReplicas: 20
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300   # wait 5 min before scaling down
      policies:
        - type: Percent
          value: 25
          periodSeconds: 60             # scale down 25% per minute max
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

## Security Contexts Checklist

```yaml
# Pod-level
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  fsGroup: 1001
  seccompProfile:
    type: RuntimeDefault

# Container-level
securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop: ["ALL"]
```

**Always set:** `runAsNonRoot`, `readOnlyRootFilesystem` (mount tmpfs for `/tmp` if needed), `drop ALL capabilities`, `allowPrivilegeEscalation: false`.

## Health Check Design

- **Liveness:** "Is the process stuck?" Checks if the app should be restarted. Keep it simple (return 200). Don't check dependencies here.
- **Readiness:** "Can it handle traffic?" Check database connectivity, cache availability. Failing readiness removes from Service endpoints but doesn't restart.
- **Startup:** "Has it finished initializing?" Use for slow-starting apps. Until startup succeeds, liveness/readiness aren't checked.

```go
// Health endpoint pattern
http.HandleFunc("/health/live", func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK) // always 200 unless deadlocked
})
http.HandleFunc("/health/ready", func(w http.ResponseWriter, r *http.Request) {
    if err := db.Ping(r.Context()); err != nil {
        w.WriteHeader(http.StatusServiceUnavailable)
        return
    }
    w.WriteHeader(http.StatusOK)
})
```

## Helm Basics

```bash
# Create chart
helm create mychart

# Key files:
# mychart/Chart.yaml        - chart metadata
# mychart/values.yaml       - default values
# mychart/templates/         - K8s manifests with Go templates

# Install/upgrade
helm upgrade --install api ./mychart \
  --namespace production \
  --set image.tag=v1.2.3 \
  --values production-values.yaml

# Useful commands
helm list -n production
helm rollback api 1 -n production
helm template api ./mychart --values prod.yaml > rendered.yaml  # dry-run
```

**Helm tips:** Use `values.yaml` for defaults, environment-specific `*-values.yaml` for overrides. Never put secrets in `values.yaml` -- use External Secrets or sealed-secrets. Template everything that changes between environments.
