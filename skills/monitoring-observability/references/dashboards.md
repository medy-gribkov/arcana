# Grafana Dashboards and Prometheus Alerting Rules

## Grafana Dashboard: Service Overview

```json
{
  "dashboard": {
    "title": "Service Overview",
    "tags": ["production", "sre"],
    "timezone": "browser",
    "refresh": "30s",
    "panels": [
      {
        "id": 1,
        "title": "Availability (30m window)",
        "type": "stat",
        "targets": [
          {
            "expr": "1 - (sum(rate(http_requests_total{status=~\"5..\"}[30m])) / sum(rate(http_requests_total[30m])))",
            "legendFormat": "availability"
          }
        ],
        "gridPos": { "x": 0, "y": 0, "w": 6, "h": 4 },
        "fieldConfig": {
          "defaults": {
            "unit": "percentunit",
            "thresholds": {
              "steps": [
                { "value": 0, "color": "red" },
                { "value": 0.99, "color": "yellow" },
                { "value": 0.999, "color": "green" }
              ]
            }
          }
        }
      },
      {
        "id": 2,
        "title": "Request Rate (req/s)",
        "type": "timeseries",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (method)",
            "legendFormat": "{{method}}"
          }
        ],
        "gridPos": { "x": 0, "y": 4, "w": 12, "h": 8 }
      },
      {
        "id": 3,
        "title": "Error Rate %",
        "type": "timeseries",
        "targets": [
          {
            "expr": "100 * sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m]))",
            "legendFormat": "5xx error rate"
          }
        ],
        "gridPos": { "x": 12, "y": 4, "w": 12, "h": 8 }
      },
      {
        "id": 4,
        "title": "Latency Percentiles",
        "type": "timeseries",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "p50"
          },
          {
            "expr": "histogram_quantile(0.90, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "p90"
          },
          {
            "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "p99"
          }
        ],
        "gridPos": { "x": 0, "y": 12, "w": 24, "h": 8 },
        "fieldConfig": {
          "defaults": { "unit": "s" }
        }
      },
      {
        "id": 5,
        "title": "Active Connections",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(db_connections_active)",
            "legendFormat": "active"
          }
        ],
        "gridPos": { "x": 6, "y": 0, "w": 6, "h": 4 }
      }
    ]
  }
}
```

Import via: Grafana UI > Dashboards > Import > paste JSON.

## Prometheus Alerting Rules

```yaml
groups:
  - name: slo-alerts
    rules:
      # High error burn rate (14.4x = 2h to exhaust 30-day budget)
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

      # Slow burn rate (6x = 5h to exhaust budget)
      - alert: SlowErrorBurnRate
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[6h]))
            / sum(rate(http_requests_total[6h]))
          ) > 6 * 0.001
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Error budget burning 6x faster than allowed"

  - name: latency-alerts
    rules:
      - alert: HighP99Latency
        expr: |
          histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
          > 2.0
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "P99 latency exceeded 2s for 10 minutes"

  - name: resource-alerts
    rules:
      - alert: HighMemoryUsage
        expr: |
          container_memory_working_set_bytes / container_spec_memory_limit_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Container using >90% of memory limit"

      - alert: PodCrashLooping
        expr: |
          rate(kube_pod_container_status_restarts_total[15m]) > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Pod {{ $labels.pod }} is crash looping"

      - alert: DBConnectionPoolExhausted
        expr: |
          db_connections_active / db_connections_max > 0.9
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool >90% utilized"
```

## Recording Rules (Pre-computed Queries)

```yaml
groups:
  - name: slo-recording
    interval: 30s
    rules:
      - record: slo:http_availability:ratio_rate5m
        expr: |
          1 - (
            sum(rate(http_requests_total{status=~"5.."}[5m]))
            / sum(rate(http_requests_total[5m]))
          )

      - record: slo:http_latency_good:ratio_rate5m
        expr: |
          sum(rate(http_request_duration_seconds_bucket{le="0.2"}[5m]))
          / sum(rate(http_request_duration_seconds_count[5m]))
```

Use recording rules for dashboard queries to reduce Prometheus load.
