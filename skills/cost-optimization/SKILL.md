---
name: cost-optimization
description: Cloud cost optimization with concrete examples for right-sizing containers, CDN caching, database query costs, serverless tuning, spot instances, reserved capacity, and build time reduction.
---

## Container Right-Sizing

Monitor CPU and memory for 7 days before setting limits. Set requests to P50, limits to P99.

**BAD:** Guessing resource limits. Over-provisioned containers waste money.

```yaml
resources:
  requests:
    memory: "1Gi"
    cpu: "1000m"
  limits:
    memory: "2Gi"
    cpu: "2000m"
```

**GOOD:** Use actual usage data from monitoring.

```bash
kubectl top pod myapp-12345 --containers
```

If P50 is 200Mi/100m and P99 is 400Mi/300m:

```yaml
resources:
  requests:
    memory: "200Mi"
    cpu: "100m"
  limits:
    memory: "400Mi"
    cpu: "300m"
```

### Vertical Pod Autoscaler

Get sizing recommendations from real workload data.

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: myapp-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  updateMode: "Off"  # Recommendation mode only
```

Check recommendations:

```bash
kubectl describe vpa myapp-vpa
```

### Cost Calculation

**Example:** 10 pods running 24/7 with 1Gi memory, 1 CPU.

- Memory: 10 pods x 1 GiB x $0.0004/hr = $29/month
- CPU: 10 pods x 1 core x $0.04/hr = $292/month
- Total: $321/month

Right-size to 200Mi memory, 100m CPU:

- Memory: 10 pods x 0.2 GiB x $0.0004/hr = $5.80/month
- CPU: 10 pods x 0.1 core x $0.04/hr = $29.20/month
- Total: $35/month

**Savings: 89% ($286/month)**

## Horizontal Pod Autoscaler

Scale replicas based on actual load. Do not run excess capacity during low traffic.

**BAD:** Fixed replica count. Wastes money overnight and weekends.

```yaml
spec:
  replicas: 10
```

**GOOD:** HPA scales from 2 to 10 based on CPU usage.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### Cost Impact

If baseline traffic needs 2 pods and peak traffic needs 10 pods for 2 hours/day:

- Fixed 10 replicas: 10 x 24hr = 240 pod-hours/day
- HPA (2 baseline + 8 peak for 2hr): 2 x 24 + 8 x 2 = 64 pod-hours/day

**Savings: 73% (176 pod-hours/day)**

## CDN Caching

Cache static assets with long TTLs. Use content hashes for cache busting.

**BAD:** No cache headers. Every request hits the origin.

```http
GET /app.js
Cache-Control: no-cache
```

**GOOD:** 1-year cache with content hash in filename.

```http
GET /app.abc123.js
Cache-Control: public, max-age=31536000, immutable
```

### API Response Caching

Even 60 seconds of caching eliminates burst traffic.

```http
GET /api/categories
Cache-Control: public, max-age=60, s-maxage=60
```

### Stale-While-Revalidate

Serve cached content while fetching fresh data in the background.

```http
Cache-Control: max-age=60, stale-while-revalidate=300
```

### Cost Impact

**Example:** 1M requests/month to origin at $0.01/10k requests = $100/month. With 90% cache hit rate: origin requests drop to 100k ($1/month). **Savings: 99%.**

## Database Query Cost

Monitor query frequency x duration. A 10ms query running 10,000/min costs more than a 1s query running once.

**BAD:** N+1 query in a loop.

```typescript
const orders = await db.orders.findMany();
for (const order of orders) {
  order.user = await db.users.findUnique({ where: { id: order.userId } });
}
```

**GOOD:** Single query with join.

```typescript
const orders = await db.orders.findMany({ include: { user: true } });
```

### Slow Query Logging

Enable slow query log. Investigate queries over 100ms.

```sql
-- PostgreSQL
SET log_min_duration_statement = 100;

-- MySQL
SET long_query_time = 0.1;
```

Use `EXPLAIN ANALYZE` to find missing indexes.

```sql
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;
```

## Serverless Cold Starts

**BAD:** Java Lambda with 1GB memory, VPC attached. Cold start: 5 seconds.

**GOOD:** Node.js Lambda with 512MB memory, no VPC. Cold start: 200ms.

Lambda allocates CPU proportional to memory. Under-provisioned memory = slower execution = higher duration costs.

### Provisioned Concurrency

Eliminate cold starts for latency-sensitive functions. Cost: ~$26/month for 5 concurrent x 512MB. Use only for critical functions.

## Build Time Optimization

Cache dependencies. Download once, reuse until lockfile changes.

**BAD:** Installing dependencies on every build.

```dockerfile
COPY . .
RUN npm install
```

**GOOD:** Cache dependencies in a separate layer.

```dockerfile
COPY package*.json ./
RUN npm ci
COPY . .
```

### Parallel Build Steps

Run linting, type checking, and tests concurrently in CI. Total time = max(build, lint, test), not sum.

### Turborepo Remote Cache

Share build artifacts across CI machines. First build uploads cache, subsequent builds skip rebuilding. **Savings: ~70% on CI costs.**

## Spot Instances, Reserved Capacity, and Cost Monitoring

AWS spot instances (70-90% savings), reserved instances (40% savings), budget alerts, resource tagging, and non-production shutdown automation. See references/cloud-examples.md for detailed configs and scripts.
