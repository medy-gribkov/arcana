---
name: incident-response
description: Engineering incident response covering on-call runbooks, blameless postmortems, status pages, rollback procedures, communication protocols, severity levels, and SLO breach handling.
---

## Purpose

Handle production incidents with speed, clarity, and accountability. This skill provides frameworks for on-call response, structured communication, rollback execution, and learning from failures.

## Severity Classification

- **SEV-1 (Critical):** Complete service outage, data loss, or security breach. All hands on deck. Resolve in minutes.
- **SEV-2 (Major):** Significant degradation affecting most users. Dedicated incident commander. Target resolution under 1 hour.
- **SEV-3 (Minor):** Partial degradation, workaround available. On-call engineer handles. Target resolution under 4 hours.
- **SEV-4 (Low):** Cosmetic issues, minor bugs, non-user-facing failures. Handle during business hours.
- Classify based on user impact, not technical complexity. A simple bug affecting all users is higher severity than a complex bug affecting one.
- Escalate severity upward when impact grows. Never downgrade severity during an active incident.

## On-Call Runbooks

**BAD** - Vague runbook:
```markdown
## Database Issues
If the database is slow, check the connections and maybe restart it.
Contact the DBA if it doesn't work.
```

**GOOD** - Actionable runbook with copy-paste commands:
```markdown
## Runbook: Database Connection Pool Exhausted

### Symptoms
- API returns 503 errors
- Grafana alert: `db_active_connections > 95% of pool_size`
- Logs: "connection pool exhausted, 0 idle connections"

### Diagnose (< 1 minute)
    kubectl exec -it deploy/api -- curl localhost:8080/debug/db
    # Shows: active=100, idle=0, max=100, waiting=47

    psql -h $DB_HOST -c "SELECT count(*) FROM pg_stat_activity WHERE state='active';"

### Fix (choose one)
1. **Kill idle transactions** (safest):
       psql -h $DB_HOST -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state='idle in transaction' AND query_start < now() - interval '5 min';"

2. **Increase pool size** (temporary):
       kubectl set env deploy/api DB_POOL_SIZE=200
       kubectl rollout restart deploy/api

3. **Rollback last deploy** (if caused by new code):
       kubectl rollout undo deploy/api

### Do NOT
- Do NOT restart the database. Active transactions will be lost.
- Do NOT increase pool size above 200 without DBA approval.

### Escalation
- Slack: #team-platform | PagerDuty: Platform On-Call
```

Write runbooks for every known failure mode. Structure: symptom, diagnostic commands, fix steps, escalation contacts. Store where on-call engineers find them in 30 seconds. Link directly from monitoring alerts. Review quarterly.

## Incident Command Structure

- Assign an Incident Commander (IC) immediately. The IC coordinates, does not debug.
- The IC's responsibilities: delegate tasks, track progress, communicate externally, decide on escalation.
- Assign a Communications Lead for SEV-1 and SEV-2 incidents. They update the status page and notify stakeholders.
- Engineers working the incident report findings to the IC, not to each other. Single channel of communication.
- Use a dedicated incident channel (Slack, Teams). Name it `#inc-YYYY-MM-DD-description`.
- The IC calls the all-clear. No one else declares the incident resolved.

## Communication Protocols

- First update within 5 minutes of detection for SEV-1, 15 minutes for SEV-2.
- Update every 30 minutes during an active incident, even if there is no progress. Silence causes panic.
- Use structured updates: current status, what we know, what we are doing, next update time.
- Internal updates go to the engineering team and leadership. External updates go to the status page.
- Avoid blame language during the incident. Focus on symptoms and actions.
- After resolution, send a final summary: root cause, fix applied, user impact duration, follow-up actions.

## Status Page Management

- Maintain a public status page for external services. Update it before customers ask.
- Use clear, non-technical language: "Some users may experience slow page loads" over "Database replica lag exceeding threshold."
- Define status levels: Operational, Degraded Performance, Partial Outage, Major Outage.
- Pre-write templates for common scenarios. Fill in specifics during the incident.
- Include estimated resolution time when possible. Update it as the estimate changes.
- Post a follow-up after resolution confirming the issue is fully resolved.

## Rollback Procedures

- Every deployment must have a documented rollback path before it ships.
- For application deployments: revert to the previous container image or artifact version.
- For database migrations: write and test the down migration before applying the up migration.
- For feature flags: disable the flag. This is the fastest rollback available.
- For infrastructure changes: use version-controlled IaC. Revert the commit and apply.
- Practice rollbacks in staging. A rollback you have never tested is a guess, not a plan.
- Set a time limit for debugging before rolling back. For SEV-1, roll back first, debug later.
- Preserve logs, metrics, and state before rolling back. You need evidence for the postmortem.

## Blameless Postmortems

**BAD** - Blame-focused postmortem:
```markdown
Root Cause: John deployed broken code on Friday at 5pm without testing.
Action Items: John needs to be more careful.
```

**GOOD** - Systems-focused postmortem:
```markdown
## Postmortem: API Outage 2025-03-15

### Timeline (UTC)
- 16:42 - Deploy v2.3.1 to production (automated via merge to main)
- 16:44 - Error rate spikes from 0.1% to 34%
- 16:47 - PagerDuty alert fires, on-call acknowledges
- 16:52 - IC declared, #inc-2025-03-15-api-errors created
- 16:58 - Root cause identified: missing DB migration
- 17:01 - Rollback initiated (kubectl rollout undo)
- 17:03 - Error rate returns to 0.1%, all-clear declared

### Impact
- Duration: 21 minutes
- Users affected: ~12,000 (API returned 500 on /orders endpoint)
- Revenue impact: ~$3,200 in failed checkouts

### Root Cause
Deploy v2.3.1 added a query on `orders.status_v2` column. The migration
to add this column was not included in the deploy pipeline.

### Contributing Factors
- CI pipeline does not run pending migrations before integration tests
- No pre-deploy check that verifies schema compatibility
- Deploy happened automatically on merge, no manual gate

### Action Items
| Action | Owner | Due |
|--------|-------|-----|
| Add migration check to CI pipeline | @platform | 2025-03-22 |
| Add schema compatibility pre-deploy hook | @platform | 2025-03-29 |
| Document migration-first deploy process | @docs | 2025-03-22 |
```

Conduct postmortems for every SEV-1 and SEV-2 within 48 hours. Focus on system failures, not human errors. Ask "why did the system allow this?" Track action item completion. Review quarterly for recurring themes.

## SLO Breach Handling

- Define SLOs (Service Level Objectives) for latency, availability, and error rate before incidents happen.
- Calculate error budgets: if SLO is 99.9% uptime, the error budget is 43.2 minutes per month.
- When the error budget is exhausted, freeze feature releases and focus on reliability work.
- Alert at 50% and 80% error budget consumption. Do not wait until the budget is gone.
- Tie SLO breaches to business impact. Leadership cares about customer trust, not percentiles.
- Review SLOs quarterly. Adjust targets based on customer expectations and operational capacity.
- Use SLO data to justify reliability investments. "We burned 90% of error budget last month" is a concrete argument.

## Post-Incident Improvement

- Convert every postmortem action item into a tracked issue with a deadline and an owner.
- Prioritize automation that prevents recurrence over documentation that describes it.
- Add monitoring for the specific failure mode that caused the incident.
- Update runbooks with lessons learned from the incident.
- Share incident learnings in team retrospectives and engineering all-hands.
- Measure MTTR (Mean Time to Resolution) and MTTD (Mean Time to Detection) over time. Both should trend downward.

## PagerDuty/OpsGenie Webhook Integration

```typescript
// ✅ Production-Ready: PagerDuty Events API v2
import axios from "axios";

interface PagerDutyEvent {
  routing_key: string;
  event_action: "trigger" | "acknowledge" | "resolve";
  dedup_key?: string;
  payload: {
    summary: string;
    severity: "critical" | "error" | "warning" | "info";
    source: string;
    timestamp?: string;
    custom_details?: Record<string, unknown>;
  };
}

async function triggerPagerDutyAlert(
  routingKey: string,
  summary: string,
  severity: "critical" | "error" | "warning" | "info",
  details?: Record<string, unknown>
) {
  const event: PagerDutyEvent = {
    routing_key: routingKey,
    event_action: "trigger",
    payload: {
      summary,
      severity,
      source: "monitoring-system",
      timestamp: new Date().toISOString(),
      custom_details: details,
    },
  };

  const response = await axios.post(
    "https://events.pagerduty.com/v2/enqueue",
    event,
    { headers: { "Content-Type": "application/json" } }
  );

  return response.data.dedup_key; // Use this to acknowledge/resolve later
}

// Usage: trigger SEV-1 alert
const dedupKey = await triggerPagerDutyAlert(
  process.env.PAGERDUTY_ROUTING_KEY!,
  "Database connection pool exhausted",
  "critical",
  { activeConnections: 100, maxConnections: 100, queuedRequests: 250 }
);
```

```python
# OpsGenie Alert API
import requests
import os

def create_opsgenie_alert(message: str, priority: str, details: dict):
    """Create OpsGenie alert via REST API."""
    url = "https://api.opsgenie.com/v2/alerts"
    headers = {
        "Authorization": f"GenieKey {os.getenv('OPSGENIE_API_KEY')}",
        "Content-Type": "application/json"
    }

    payload = {
        "message": message,
        "priority": priority,  # P1-P5
        "details": details,
        "tags": ["production", "automated"],
        "source": "monitoring"
    }

    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()
    return response.json()["requestId"]

# Usage
create_opsgenie_alert(
    message="API latency p99 > 2s for 5 minutes",
    priority="P1",
    details={"p99_latency": "2.3s", "endpoint": "/api/orders", "region": "us-east-1"}
)
```
