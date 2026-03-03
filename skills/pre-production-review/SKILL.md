---
name: pre-production-review
description: >
  Systematic pre-production codebase review across 8 domains: security, data layer,
  backend/API, external services, frontend, infrastructure, performance, and code quality.
  Dispatches parallel sub-agents for deep analysis, synthesizes findings into a scored
  health report with phased remediation plan.
---

## Overview

Run this skill before deploying to production. It executes a 4-phase review:

1. **Discovery**: Map tech stack, critical files, frameworks
2. **Domain Analysis**: 8 parallel deep-dives
3. **Synthesis**: Cross-domain pattern detection
4. **Report**: Health score + phased remediation plan

## Phase 1: Discovery

Run `scripts/discover.sh` in the project root to auto-detect the stack. Then manually verify:

```bash
# Auto-detect
bash "${SKILL_DIR}/scripts/discover.sh" .

# Output example
{
  "stack": ["typescript", "react", "next", "prisma", "postgresql"],
  "entrypoints": ["src/app/layout.tsx", "src/server/api/root.ts"],
  "hasTests": true,
  "hasCi": true,
  "hasDocker": false
}
```

## Phase 2: Domain Analysis

Launch parallel sub-agents for each domain. Each agent gets the discovery JSON + domain checklist from `references/domain-checklists.md`.

### Security
- Auth bypass: routes without middleware, missing RBAC checks
- IDOR: direct object references without ownership validation
- Secrets: hardcoded API keys, tokens, passwords in source
- Injection: SQL concatenation, unsanitized HTML, eval()
- CORS: wildcard origins, missing preflight handling
- Rate limiting: unprotected auth endpoints

```typescript
// BAD: Direct object access without ownership check
app.get("/api/orders/:id", async (req, res) => {
  const order = await db.order.findUnique({ where: { id: req.params.id } });
  res.json(order);
});

// GOOD: Verify ownership before returning data
app.get("/api/orders/:id", authMiddleware, async (req, res) => {
  const order = await db.order.findUnique({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!order) return res.status(404).json({ error: "Not found" });
  res.json(order);
});
```

### Data Layer
- N+1 queries: loops issuing individual SELECT per item
- Unbounded queries: SELECT without LIMIT on user-facing endpoints
- Missing indexes: columns used in WHERE/ORDER BY without index
- Schema gaps: nullable columns that should have defaults, missing cascades

```sql
-- BAD: No index on frequently filtered column
SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at;

-- GOOD: Composite index covers both filter and sort
CREATE INDEX idx_orders_status_created ON orders (status, created_at DESC);
```

### Backend/API
- Input validation: endpoints accepting unvalidated payloads
- Error leaks: stack traces in production error responses
- Timeouts: long-running operations without deadline
- Payload limits: missing max body size on file uploads

```typescript
// BAD: No validation, no timeout, leaks errors
app.post("/api/process", async (req, res) => {
  try {
    const result = await heavyComputation(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// GOOD: Validate input, set timeout, sanitize errors
app.post("/api/process", validate(processSchema), async (req, res) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const result = await heavyComputation(req.body, controller.signal);
    res.json(result);
  } catch (err) {
    if (err.name === "AbortError") return res.status(408).json({ error: "Timeout" });
    res.status(500).json({ error: "Internal error" });
  } finally {
    clearTimeout(timeout);
  }
});
```

### External Services
- Retry logic: API calls without exponential backoff
- Timeouts: fetch/axios calls without timeout config
- Dead letters: failed async jobs with no retry queue
- Webhook verification: accepting webhooks without signature validation

```typescript
// BAD: No retry, no timeout
const data = await fetch(externalApi).then(r => r.json());

// GOOD: Timeout + exponential backoff
const fetchWithRetry = async (url: string, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 2 ** i * 1000));
    }
  }
};
```

### Frontend
- Component boundaries: client components wrapping server data
- Bundle size: barrel imports pulling entire libraries
- Loading states: missing Suspense boundaries, no skeleton UI
- Accessibility: missing alt text, no keyboard navigation, low contrast

```tsx
// BAD: Barrel import pulls entire library
import { Button, Card, Modal, Tooltip } from 'ui-library';

// GOOD: Direct imports reduce bundle size
import { Button } from 'ui-library/button';
import { Card } from 'ui-library/card';
```

### Infrastructure
- CI/CD: missing automated tests in pipeline
- Monitoring: no error tracking (Sentry/Datadog)
- Health checks: no /health endpoint for load balancer
- Secrets: env vars hardcoded in docker-compose or committed .env

```yaml
# BAD: Secrets in docker-compose.yml
environment:
  - DATABASE_URL=postgresql://user:password123@localhost/db
  - API_KEY=sk_live_abc123

# GOOD: Reference env file excluded from git
environment:
  - DATABASE_URL=${DATABASE_URL}
  - API_KEY=${API_KEY}
```

### Performance
- Polling: intervals under 3 seconds without WebSocket justification
- Caching: repeated identical API calls without SWR/React Query
- Blocking: CPU-heavy operations on main thread
- Assets: unoptimized images, no lazy loading below fold

```typescript
// BAD: Aggressive polling, no caching
useEffect(() => {
  const interval = setInterval(() => {
    fetch('/api/status').then(r => r.json()).then(setData);
  }, 1000);
  return () => clearInterval(interval);
}, []);

// GOOD: SWR with reasonable refresh interval
import useSWR from 'swr';
const { data } = useSWR('/api/status', fetcher, { refreshInterval: 5000 });
```

### Quality
- Test coverage: critical paths without any test
- TypeScript: `any` or `as any` usage count
- Linting: disabled rules, eslint-disable comments
- Tech debt: TODO, FIXME, HACK markers with no tracking

```typescript
// BAD: Type assertion bypasses safety
const user = response.data as any;

// GOOD: Validate with runtime schema
const UserSchema = z.object({ id: z.string(), email: z.string().email() });
const user = UserSchema.parse(response.data);
```

## Phase 3: Synthesis

After all domain analyses complete, look for systemic patterns:

| Pattern | Signals | Severity |
|---------|---------|----------|
| **No Safety Net** | No tests + No CI + No monitoring | Critical |
| **Happy Path Only** | No retry logic + No error boundaries + No timeouts | High |
| **Scale Cliff** | N+1 queries + No pagination + No caching | High |
| **Security Swiss Cheese** | No auth middleware + No input validation + Hardcoded secrets | Critical |
| **Deployment Roulette** | No staging env + No rollback plan + No health checks | High |

See `references/patterns.md` for full pattern definitions with remediation priorities.

## Phase 4: Report

Generate a structured report. Save to `.pre-production-review/report.md`.

### Health Score Formula

Start at 100. Deduct per finding:
- Critical: -20 points (capped at -60)
- High: -10 points (capped at -40)
- Medium: -3 points
- Low: -1 point

Minimum score: 0. Target for production: 70+.

### Finding Format

Every finding must follow this schema (see `references/finding-schema.md`):

```json
{
  "id": "SEC-001",
  "domain": "security",
  "title": "API endpoint lacks authentication",
  "severity": "critical",
  "evidence": {
    "file": "src/server/api/orders.ts",
    "lines": "12-18",
    "snippet": "app.get('/api/orders/:id', async (req, res) => {"
  },
  "impact": "Any unauthenticated user can read any order",
  "recommendation": {
    "action": "Add authMiddleware and ownership check",
    "effort": "low"
  }
}
```

### Phased Remediation

Organize fixes into phases:
- **Phase 0 (Now)**: Critical security + data issues. Block deploy until fixed.
- **Phase 1 (This sprint)**: High severity. Error handling, retry logic, input validation.
- **Phase 2 (Next sprint)**: Medium. Performance, bundle size, test coverage.
- **Phase 3 (Backlog)**: Low. Code quality, tech debt, documentation.

## Anti-patterns

```
BAD: "The codebase has some security issues that should be addressed."
GOOD: "SEC-001 [Critical]: src/server/api/orders.ts:12 - GET /api/orders/:id has no auth middleware. Any user can read any order by guessing the UUID."

BAD: Listing 50 low-severity findings with no prioritization.
GOOD: "3 Critical, 5 High findings. Fix the 3 critical issues before deploy. Health score: 42/100."

BAD: Running all 8 domains sequentially in the main context.
GOOD: Dispatch 8 parallel sub-agents, each with its own context. Collect JSON results. Synthesize once.
```

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/discover.sh` | Auto-detect tech stack | `bash scripts/discover.sh .` |
| `scripts/scan-secrets.sh` | Find hardcoded secrets | `bash scripts/scan-secrets.sh .` |
| `scripts/scan-security.sh` | Find common vulnerabilities | `bash scripts/scan-security.sh .` |
| `scripts/scan-quality.sh` | Count quality issues | `bash scripts/scan-quality.sh .` |
| `scripts/health-score.sh` | Calculate health score | `bash scripts/health-score.sh findings.json` |

## Credits

8-domain analysis methodology inspired by [UCOF](https://github.com/nativardi/ucof) by [@nativardi](https://github.com/nativardi).
