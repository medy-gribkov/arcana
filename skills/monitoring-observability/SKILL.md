---
name: monitoring-observability
description: Production observability and monitoring expertise including structured logging with JSON and correlation IDs, Prometheus metrics (counters, histograms, gauges), distributed tracing with OpenTelemetry and Jaeger, Grafana dashboard design, SLO/SLI-based alerting rules, Sentry error tracking, health check endpoints, readiness vs liveness probes, and on-call runbook patterns. Use when setting up monitoring, debugging production issues, designing dashboards, or implementing observability in Go, Node.js, or Python services.
---

You are a senior SRE/platform engineer who designs observability systems that make production incidents diagnosable in minutes, not hours.

## Use this skill when

- Setting up structured logging, metrics, or tracing in a service
- Designing Grafana dashboards or Prometheus alerting rules
- Implementing health check, readiness, or liveness endpoints
- Debugging production issues with distributed tracing
- Defining SLOs/SLIs or writing on-call runbooks
- Integrating Sentry, OpenTelemetry, or Prometheus client libraries

## Structured Logging

Emit JSON logs with consistent fields. Never use `fmt.Println` or `console.log` in production.

Required fields on every log line: `timestamp`, `level`, `message`, `service`, `correlation_id`.

### Go (zerolog)

```go
import (
    "github.com/rs/zerolog"
    "github.com/rs/zerolog/log"
    "os"
)

func initLogger(service string) zerolog.Logger {
    return zerolog.New(os.Stdout).With().
        Timestamp().
        Str("service", service).
        Caller().
        Logger()
}

// Per-request: inject correlation ID from middleware
func handler(w http.ResponseWriter, r *http.Request) {
    corrID := r.Header.Get("X-Correlation-ID")
    if corrID == "" {
        corrID = uuid.NewString()
    }
    logger := log.With().Str("correlation_id", corrID).Logger()
    logger.Info().Str("path", r.URL.Path).Msg("request received")
}
```

### Node.js (pino)

```typescript
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: { service: "order-api" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Per-request child logger with correlation ID
function createRequestLogger(correlationId: string) {
  return logger.child({ correlationId });
}
```

### Log Level Discipline

| Level | Use for | Example |
|-------|---------|---------|
| `error` | Broken contract, needs human action | DB connection lost, payment failed |
| `warn` | Degraded but self-healing | Retry succeeded, cache miss fallback |
| `info` | Business events, request lifecycle | Order placed, user login, deploy started |
| `debug` | Internal state for troubleshooting | Query params, cache hit ratio, parsed payload |

Never log PII (emails, tokens, passwords). Redact with `[REDACTED]` or hash.

## Prometheus Metrics

### Metric Types and When to Use Them

- **Counter**: monotonically increasing. Use for: requests total, errors total, bytes sent.
- **Histogram**: observations bucketed by value. Use for: request duration, payload size.
- **Gauge**: arbitrary up/down value. Use for: active connections, queue depth, temperature.

### Go (prometheus/client_golang)

```go
import "github.com/prometheus/client_golang/prometheus"

var (
    httpRequestsTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total HTTP requests by method, path, and status.",
        },
        []string{"method", "path", "status"},
    )
    httpRequestDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "http_request_duration_seconds",
            Help:    "HTTP request latency in seconds.",
            Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5},
        },
        []string{"method", "path"},
    )
)

func init() {
    prometheus.MustRegister(httpRequestsTotal, httpRequestDuration)
}
```

### Naming Conventions

- `<namespace>_<name>_<unit>` — e.g., `myapp_http_request_duration_seconds`
- Counters end with `_total`: `myapp_requests_total`
- Use base units: seconds (not ms), bytes (not KB)
- Keep label cardinality low. Never use user IDs, request IDs, or URLs as label values.

## Distributed Tracing with OpenTelemetry

### Concepts

- **Trace**: full journey of a request across services. Identified by a `trace_id`.
- **Span**: a single operation within a trace. Has `span_id`, `parent_span_id`, start/end time.
- **Context propagation**: pass trace context via HTTP headers (`traceparent`) or gRPC metadata.

### Node.js Setup

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318/v1/traces",
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  serviceName: "order-api",
});

sdk.start();
```

### Go Setup

```go
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

func initTracer(ctx context.Context) (*sdktrace.TracerProvider, error) {
    exporter, err := otlptracehttp.New(ctx)
    if err != nil {
        return nil, err
    }
    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exporter),
        sdktrace.WithResource(resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceName("lead-scraper"),
        )),
    )
    otel.SetTracerProvider(tp)
    return tp, nil
}
```

### Custom Spans

```go
tracer := otel.Tracer("scraper")
ctx, span := tracer.Start(ctx, "scrape.fetchPage")
defer span.End()

span.SetAttributes(attribute.String("url", targetURL))
if err != nil {
    span.RecordError(err)
    span.SetStatus(codes.Error, err.Error())
}
```

## Grafana Dashboard Design

### Layout Principles

1. **Top row**: SLI summary panels (availability %, p99 latency, error rate). Use stat panels with thresholds.
2. **Second row**: Traffic volume (requests/sec) and error rate time series. Side by side.
3. **Third row**: Latency percentiles (p50, p90, p99) as a single time series with multiple queries.
4. **Bottom rows**: Resource metrics (CPU, memory, goroutines, connection pool).

### Essential PromQL Queries

```promql
# Request rate (per second, 5m smoothed)
rate(http_requests_total{service="order-api"}[5m])

# Error rate percentage
100 * rate(http_requests_total{status=~"5.."}[5m])
  / rate(http_requests_total[5m])

# p99 latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Availability (non-5xx / total)
1 - (
  sum(rate(http_requests_total{status=~"5.."}[30m]))
  / sum(rate(http_requests_total[30m]))
)
```

## SLO/SLI-Based Alerting

Define SLIs first, derive SLOs, then set alerts on error budget burn rate — not on raw thresholds.

| SLI | Measurement | SLO |
|-----|-------------|-----|
| Availability | `successful requests / total requests` | 99.9% over 30 days |
| Latency | `requests < 200ms / total requests` | 95% under 200ms |
| Freshness | `time since last data update` | < 5 minutes |

### Multi-Window Burn Rate Alerts

```yaml
# Prometheus alerting rule: 1h burn rate consuming 2% of monthly budget
groups:
  - name: slo-alerts
    rules:
      - alert: HighErrorBurnRate
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[1h]))
            / sum(rate(http_requests_total[1h]))
          ) > 14.4 * 0.001
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Error budget burning 14.4x faster than allowed"
          runbook: "https://wiki.internal/runbooks/high-error-rate"
```

The factor `14.4` means: at this rate, the entire 30-day error budget depletes in ~2 hours.

## Health Check Endpoints

```go
// GET /healthz — liveness: is the process alive and not deadlocked?
func livenessHandler(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(`{"status":"alive"}`))
}

// GET /readyz — readiness: can this instance serve traffic?
func readinessHandler(w http.ResponseWriter, r *http.Request) {
    if err := db.PingContext(r.Context()); err != nil {
        w.WriteHeader(http.StatusServiceUnavailable)
        json.NewEncoder(w).Encode(map[string]string{"status": "not_ready", "reason": "db_unreachable"})
        return
    }
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(`{"status":"ready"}`))
}
```

- **Liveness** fails = container gets restarted. Keep it simple (no dependency checks).
- **Readiness** fails = removed from load balancer. Check DB, cache, upstream dependencies.
- Never combine them into one endpoint. A service can be alive but not ready (warming cache, running migrations).

## Sentry Error Tracking

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions for performance
  beforeSend(event) {
    // Scrub sensitive data
    if (event.request?.headers) {
      delete event.request.headers["authorization"];
    }
    return event;
  },
});

// Attach context to errors
Sentry.setContext("order", { orderId: "abc-123", userId: "usr_456" });
```

Set `tracesSampleRate` based on traffic volume: 100% for <100 req/s, 10% for <10k req/s, 1% for >10k req/s.

## On-Call Runbook Pattern

Every alert must link to a runbook. Template:

```markdown
## Alert: HighErrorBurnRate

**Severity:** Critical | **Escalation:** Page on-call SRE

### Symptoms
- Error rate >1.4% over 1 hour
- Grafana dashboard: <link>

### Diagnostic Steps
1. Check recent deployments: `kubectl rollout history deployment/order-api`
2. Check downstream dependencies: `curl -s http://payment-svc:8080/readyz`
3. Tail logs: `kubectl logs -l app=order-api --since=15m | jq 'select(.level=="error")'`
4. Check DB connection pool: Grafana panel "Active Connections"

### Mitigation
- **If recent deploy**: rollback with `kubectl rollout undo deployment/order-api`
- **If downstream failure**: enable circuit breaker flag `ORDER_SKIP_PAYMENT=true`
- **If DB saturation**: scale read replicas, check slow query log

### Resolution
- Root cause in incident doc. Link post-mortem within 48 hours.
```

## Grafana Dashboard JSON Snippet

```json
{
  "dashboard": {
    "title": "API Service Overview",
    "panels": [
      {
        "id": 1,
        "title": "Request Rate (req/s)",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{service=\"order-api\"}[5m])",
            "legendFormat": "{{method}} {{path}}"
          }
        ],
        "gridPos": { "x": 0, "y": 0, "w": 12, "h": 8 }
      },
      {
        "id": 2,
        "title": "Error Rate %",
        "type": "graph",
        "targets": [
          {
            "expr": "100 * rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])",
            "legendFormat": "5xx errors"
          }
        ],
        "gridPos": { "x": 12, "y": 0, "w": 12, "h": 8 },
        "alert": {
          "conditions": [
            {
              "evaluator": { "params": [1], "type": "gt" },
              "query": { "params": ["A", "5m", "now"] },
              "reducer": { "type": "avg" },
              "type": "query"
            }
          ],
          "name": "High Error Rate",
          "message": "Error rate exceeded 1% for 5 minutes"
        }
      },
      {
        "id": 3,
        "title": "P99 Latency",
        "type": "stat",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ],
        "gridPos": { "x": 0, "y": 8, "w": 6, "h": 4 },
        "options": {
          "colorMode": "background",
          "graphMode": "area",
          "orientation": "auto"
        },
        "fieldConfig": {
          "defaults": {
            "unit": "s",
            "thresholds": {
              "steps": [
                { "value": 0, "color": "green" },
                { "value": 0.5, "color": "yellow" },
                { "value": 1, "color": "red" }
              ]
            }
          }
        }
      }
    ]
  }
}
```

Import via: Grafana UI > Dashboards > Import > paste JSON or use Grafana HTTP API:

```bash
curl -X POST http://localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${GRAFANA_API_KEY}" \
  -d @dashboard.json
```
