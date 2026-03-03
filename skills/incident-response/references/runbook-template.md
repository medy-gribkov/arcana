# Incident Runbook Template and Severity Definitions

## Severity Definitions

| Severity | Impact | Response Time | Resolution Target | Who Responds |
|----------|--------|---------------|-------------------|--------------|
| SEV-1 | Complete outage or data loss | Immediate | Minutes | All hands, IC assigned |
| SEV-2 | Major degradation, most users affected | < 15 min | < 1 hour | Dedicated IC + team |
| SEV-3 | Partial degradation, workaround exists | < 1 hour | < 4 hours | On-call engineer |
| SEV-4 | Minor, non-user-facing | Business hours | < 1 week | Team backlog |

Classify based on user impact, not technical complexity.

## Runbook Template

Copy this template for every known failure mode.

```markdown
## Alert: [Alert Name]

**Severity:** [SEV-1/2/3/4]
**Escalation:** [Page on-call / Notify team / Add to backlog]
**Last reviewed:** [Date]
**Owner:** [Team name]

### Symptoms
- [What the alert fires on, e.g., "Error rate > 1.4% for 5 minutes"]
- [What users see, e.g., "HTTP 500 on checkout page"]
- Dashboard: [Grafana link]
- Logs: [Kibana/Loki query link]

### Diagnostic Steps
1. Check recent deployments:
   ```bash
   kubectl rollout history deployment/myapp -n production
   ```
2. Check pod status:
   ```bash
   kubectl get pods -l app=myapp -n production
   kubectl describe pod <failing-pod> -n production
   ```
3. Tail error logs:
   ```bash
   kubectl logs -l app=myapp -n production --since=15m | jq 'select(.level=="error")'
   ```
4. Check downstream dependencies:
   ```bash
   curl -s http://dependency-svc:8080/health/ready
   ```
5. Check resource usage:
   ```bash
   kubectl top pods -l app=myapp -n production
   ```

### Mitigation (fastest fix first)
1. **If recent deploy caused it:** Roll back immediately.
   ```bash
   kubectl rollout undo deployment/myapp -n production
   ```
2. **If feature flag related:** Disable the flag in [config system].
3. **If downstream failure:** Enable circuit breaker or fallback.
4. **If resource exhaustion:** Scale up.
   ```bash
   kubectl scale deployment/myapp --replicas=10 -n production
   ```

### What NOT to Do
- Do not restart all pods at once (causes total outage during restart).
- Do not apply untested fixes to production without rollback plan.

### Resolution
- Document root cause in incident channel.
- Link to post-mortem within 48 hours.
```

## Post-Mortem Template

```markdown
# Post-Mortem: [Incident Title]

**Date:** [YYYY-MM-DD]
**Duration:** [Start time - End time, total minutes]
**Severity:** [SEV-1/2/3]
**Incident Commander:** [Name]
**Author:** [Name]

## Summary
[1-2 sentences: what happened and what was the user impact]

## Timeline (all times UTC)
| Time | Event |
|------|-------|
| HH:MM | Alert fired: [alert name] |
| HH:MM | IC assigned: [name] |
| HH:MM | Root cause identified: [brief] |
| HH:MM | Mitigation applied: [what was done] |
| HH:MM | Monitoring confirmed recovery |
| HH:MM | All-clear declared |

## Root Cause
[Detailed technical explanation. What failed and why.]

## Contributing Factors
- [Factor 1: e.g., missing monitoring on X]
- [Factor 2: e.g., deployment lacked canary phase]
- [Factor 3: e.g., runbook was outdated]

## Impact
- **Users affected:** [number or percentage]
- **Duration of impact:** [minutes]
- **Data loss:** [yes/no, details]
- **Revenue impact:** [if applicable]

## Action Items
| Action | Owner | Priority | Due Date | Status |
|--------|-------|----------|----------|--------|
| Add monitoring for [X] | @name | P1 | YYYY-MM-DD | Open |
| Update runbook for [Y] | @name | P2 | YYYY-MM-DD | Open |
| Add canary deploy step | @name | P2 | YYYY-MM-DD | Open |

## Lessons Learned
- [What went well]
- [What could be improved]
- [What was lucky]
```

## Incident Communication Template

```
**Status Update - [Incident Title]**
**Time:** [HH:MM UTC]
**Status:** [Investigating / Identified / Monitoring / Resolved]

**Current situation:** [1 sentence]
**What we know:** [1-2 sentences]
**What we're doing:** [1-2 sentences]
**Next update:** [Time or "in 30 minutes"]
```
