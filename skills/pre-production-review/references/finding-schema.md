# Finding Schema Definition

JSON schema and examples for pre-production review findings.

## TypeScript Interface

```typescript
interface Finding {
  id: string;              // Format: {DOMAIN_PREFIX}-{NUMBER} (e.g., SEC-001)
  domain: Domain;          // Security | DataLayer | Backend | External | Frontend | Infrastructure | Performance | Quality
  severity: Severity;      // critical | high | medium | low
  title: string;           // Brief description (60 chars max)
  description: string;     // Detailed explanation of the issue
  location: string;        // File path and line number, or component name
  impact: string;          // Business/technical impact if not fixed
  remediation: string;     // Specific steps to fix the issue
  effort: Effort;          // trivial | low | medium | high
  references?: string[];   // Links to docs, CVEs, or related issues
}

type Domain =
  | "Security"
  | "DataLayer"
  | "Backend"
  | "External"
  | "Frontend"
  | "Infrastructure"
  | "Performance"
  | "Quality";

type Severity = "critical" | "high" | "medium" | "low";
type Effort = "trivial" | "low" | "medium" | "high";
```

## Field Descriptions

### id
Format: `{PREFIX}-{NUMBER}` where prefix is:
- `SEC` - Security
- `DATA` - DataLayer
- `API` - Backend
- `EXT` - External
- `FE` - Frontend
- `INFRA` - Infrastructure
- `PERF` - Performance
- `QA` - Quality

Numbers are zero-padded to 3 digits (001, 002, etc.).

### domain
The review domain this finding belongs to. Maps directly to one of the 8 checklist categories.

### severity
Criticality level. See decision guide below.

### title
One-line summary. Keep under 60 characters. Should be scannable in a list.

### description
Full explanation of what's wrong, why it matters, and context. 2-4 sentences.

### location
Specific place in codebase. Formats:
- `src/auth/middleware.ts:42`
- `pages/api/users/[id].ts`
- `docker-compose.yml (postgres service)`
- `package.json dependencies`

### impact
What happens if this isn't fixed. Focus on user/business impact, not just technical.

### remediation
Concrete steps to fix. Include code snippets, config changes, or package names.

### effort
Time/complexity estimate:
- `trivial`: < 15 minutes, one-line change
- `low`: 15-60 minutes, simple refactor
- `medium`: 1-4 hours, requires testing
- `high`: > 4 hours, architectural change

### references
Optional links to documentation, CVEs, blog posts, or related GitHub issues.

## Severity Decision Guide

### Critical
- **Security**: Unauthenticated access to sensitive data, hardcoded production secrets, SQL injection
- **Performance**: Production outage inevitable (unbounded queries, memory leaks)
- **Data Layer**: Data loss risk (missing transactions, no backups)
- **Infrastructure**: No deployment rollback, production secrets in git

Criteria: Immediate production failure OR trivial exploit OR data loss.

### High
- **Security**: Missing rate limiting, weak password hashing, CORS misconfiguration
- **Performance**: N+1 queries in user-facing flows, no caching on expensive operations
- **External**: No retry logic, no circuit breaker, no timeout on API calls
- **Quality**: No tests for business logic, TypeScript any in critical paths

Criteria: Production failure under load OR exploitable with effort OR significant UX degradation.

### Medium
- **Frontend**: Missing loading states, poor accessibility, bundle size over budget
- **Backend**: No request validation, verbose error messages, no structured logging
- **Infrastructure**: Missing health checks, no error tracking, manual deployments

Criteria: Reduced reliability OR poor UX OR operational friction.

### Low
- **Quality**: Linting warnings, missing ADRs, no e2e tests for non-critical flows
- **Performance**: Unoptimized images, missing code splitting on secondary routes
- **Frontend**: Color contrast slightly below WCAG AA

Criteria: Best practice violation OR minor UX issue OR future tech debt.

## Example Findings

### Example 1: Critical Security Finding

```json
{
  "id": "SEC-001",
  "domain": "Security",
  "severity": "critical",
  "title": "Hardcoded database credentials in source code",
  "description": "Production database password is hardcoded in src/config/database.ts and committed to git. This credential is visible to anyone with repository access and appears in git history.",
  "location": "src/config/database.ts:12",
  "impact": "Attackers with read access to the repository can access production database directly, leading to data breach, data loss, or service disruption.",
  "remediation": "1) Revoke current database password immediately. 2) Move credentials to environment variables using process.env.DATABASE_URL. 3) Use secret manager (AWS Secrets Manager, HashiCorp Vault) for production. 4) Add .env to .gitignore. 5) Use git-filter-repo to remove password from git history.",
  "effort": "low",
  "references": [
    "https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/",
    "https://12factor.net/config"
  ]
}
```

### Example 2: High Performance Finding

```json
{
  "id": "PERF-003",
  "domain": "Performance",
  "severity": "high",
  "title": "N+1 query in user dashboard loading all posts individually",
  "description": "The /dashboard endpoint loads user's posts in a loop, executing one SQL query per post to fetch related comments. For users with 50+ posts, this generates 50+ database queries on every page load.",
  "location": "src/pages/api/dashboard.ts:34-42",
  "impact": "Dashboard takes 3-5 seconds to load for active users. Database connection pool exhaustion occurs during peak traffic, causing 503 errors for all users.",
  "remediation": "Replace the loop with a single JOIN query or use an ORM's eager loading (e.g., Prisma's include, TypeORM's relations). Example: `db.post.findMany({ where: { userId }, include: { comments: true } })`. Add query logging to detect similar patterns.",
  "effort": "low",
  "references": [
    "https://secure.phabricator.com/book/phabcontrib/article/n_plus_one/",
    "https://www.prisma.io/docs/concepts/components/prisma-client/relation-queries"
  ]
}
```

### Example 3: Medium Backend Finding

```json
{
  "id": "API-005",
  "domain": "Backend",
  "severity": "medium",
  "title": "API error responses leak internal implementation details",
  "description": "Unhandled errors in API routes return full stack traces and database error messages to clients. This exposes file paths, package names, database schema, and internal logic.",
  "location": "src/pages/api/**.ts (global error handler missing)",
  "impact": "Attackers gain reconnaissance information to craft targeted exploits. Error messages reveal technology stack, database structure, and business logic. Unprofessional UX for legitimate users.",
  "remediation": "1) Implement global error handler middleware. 2) Log full errors server-side with request ID. 3) Return sanitized messages to client: { error: 'Internal server error', requestId: 'abc-123' }. 4) Use environment check: detailed errors in dev, generic in production. Example using Next.js API routes: wrap handlers in try-catch and use custom error formatter.",
  "effort": "medium",
  "references": [
    "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/08-Testing_for_Error_Handling/01-Testing_For_Improper_Error_Handling",
    "https://nextjs.org/docs/api-routes/api-middlewares#custom-error-page-for-api-routes"
  ]
}
```
