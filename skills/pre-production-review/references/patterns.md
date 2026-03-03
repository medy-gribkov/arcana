# Systemic Patterns in Pre-Production Review

Critical patterns that emerge when multiple findings combine to create systemic risks.

## Pattern 1: No Safety Net

### Description
Application has zero observability into production behavior. When things go wrong, team is blind.

### Signals
Combines findings from:
- **Quality**: No unit tests, no integration tests, no e2e tests
- **Infrastructure**: No CI pipeline, no error tracking, no log aggregation
- **Backend**: No structured logging, no request ID propagation
- **Infrastructure**: No health check endpoint, no monitoring

### Severity
**Critical** - Guaranteed production incidents with no debugging capability.

### Root Cause
Development prioritized shipping features over operational maturity. No investment in testing or observability infrastructure.

### Impact
- Mean time to resolution (MTTR) measured in hours/days instead of minutes
- Bugs discovered by users instead of tests
- No way to reproduce production issues locally
- Hotfixes deployed blindly, creating cascading failures
- Team burns out on firefighting

### Remediation Priority & Effort
**Priority**: Must fix before production launch.

**Effort**: High (2-5 days)
1. Add health check endpoint (2 hours)
2. Integrate error tracking service like Sentry (4 hours)
3. Set up basic CI with existing test framework (1 day)
4. Write smoke tests for critical flows (2 days)
5. Add structured logging with correlation IDs (1 day)

### Example Scenario
E-commerce checkout breaks on Friday evening. No error tracking means team doesn't know until users complain on social media. No logs mean engineers can't reproduce the issue. No tests mean every attempted fix risks making it worse. Revenue loss continues through the weekend while team manually tests theories in production.

---

## Pattern 2: Happy Path Only

### Description
Code assumes all external operations succeed. No resilience to transient failures.

### Signals
Combines findings from:
- **External**: No retry logic, no circuit breaker, no timeout on API calls
- **Backend**: No error handling in async operations, uncaught promise rejections
- **External**: No fallback for degraded service states
- **Backend**: No graceful shutdown handling

### Severity
**Critical** - Fragile system that fails catastrophically under real-world conditions.

### Root Cause
Testing only covers success scenarios. External dependencies mocked as always available.

### Impact
- Payment processing failures leave orders in inconsistent state
- Email service outage prevents all user signups
- Third-party API slowness causes cascade timeouts
- Service crashes on uncaught exceptions
- No way to deploy updates without downtime

### Remediation Priority & Effort
**Priority**: Must fix before production launch.

**Effort**: Medium (1-3 days)
1. Add timeouts to all external HTTP calls (4 hours)
2. Implement exponential backoff retry logic (1 day)
3. Add circuit breaker for unstable dependencies (1 day)
4. Wrap async operations in try-catch with error logging (4 hours)
5. Implement graceful shutdown (4 hours)

### Example Scenario
Payment provider API starts responding in 8 seconds instead of 200ms. Application has no timeout, so checkout requests hang. Server runs out of connections. All users see 503 errors. Team restarts server, but issue recurs immediately. Forced to disable checkout entirely while payment provider fixes their issue.

---

## Pattern 3: Scale Cliff

### Description
Application performs acceptably at current load but will collapse at 10x traffic.

### Signals
Combines findings from:
- **Performance**: N+1 queries in hot paths, no caching strategy
- **DataLayer**: No query pagination, unbounded result sets
- **Performance**: No connection pooling, blocking operations on main thread
- **Frontend**: No code splitting, excessive bundle size
- **Performance**: No CDN for static assets

### Severity
**High** - Success becomes failure. Viral moment becomes outage.

### Root Cause
Performance testing done with toy datasets. No load testing with realistic traffic.

### Impact
- Successful marketing campaign brings down the site
- Database connection pool exhausted at 100 concurrent users
- Homepage takes 30 seconds to load on 3G
- Single slow user blocks all other requests
- Can't scale horizontally due to architectural bottlenecks

### Remediation Priority & Effort
**Priority**: Fix before marketing push or public launch.

**Effort**: High (3-7 days)
1. Add pagination to all list endpoints (1 day)
2. Implement Redis caching for expensive queries (2 days)
3. Fix N+1 queries with eager loading (1 day)
4. Configure database connection pooling (4 hours)
5. Set up CDN for static assets (4 hours)
6. Implement code splitting by route (1 day)
7. Run load test to validate fixes (1 day)

### Example Scenario
Product Hunt launch drives 10,000 visitors in first hour. Homepage loads user's activity feed with N+1 query, generating 50 database queries per user. Database maxes out at 100 connections. Site becomes unresponsive. Team scrambles to add caching, but deploy process takes 30 minutes. By the time site is stable, front page traffic has moved on.

---

## Pattern 4: Security Swiss Cheese

### Description
Multiple security layers missing, creating trivially exploitable attack surface.

### Signals
Combines findings from:
- **Security**: No authentication middleware, no RBAC enforcement
- **Backend**: No input validation, SQL injection vulnerable
- **Security**: Hardcoded secrets in source code
- **Security**: No rate limiting, CORS wildcard in production
- **Backend**: Stack traces in error responses

### Severity
**Critical** - Exploitable by script kiddies. Data breach inevitable.

### Root Cause
Security treated as afterthought. No security review or threat modeling.

### Impact
- Unauthenticated users access admin endpoints
- Attackers extract database via SQL injection
- Leaked secrets enable lateral movement
- Credential stuffing succeeds due to no rate limiting
- Error messages guide attackers to vulnerabilities

### Remediation Priority & Effort
**Priority**: Block production launch. Fix immediately.

**Effort**: High (5-10 days)
1. Add authentication middleware to all routes (2 days)
2. Implement RBAC with role checks (2 days)
3. Parameterize all SQL queries (1 day)
4. Move secrets to environment variables (1 day)
5. Add input validation with schema library (2 days)
6. Configure CORS whitelist (2 hours)
7. Add rate limiting on auth endpoints (1 day)
8. Sanitize error responses (4 hours)
9. Run penetration test to validate (1 day)

### Example Scenario
Security researcher finds admin panel at /admin with no authentication. Discovers SQL injection in user search. Extracts entire user database including password hashes. Finds AWS credentials hardcoded in GitHub repo. Posts disclosure on Twitter. Company makes security breach headlines.

---

## Pattern 5: Deployment Roulette

### Description
Every deployment is a high-stakes gamble with no safety net or rollback plan.

### Signals
Combines findings from:
- **Infrastructure**: No staging environment, no CI pipeline
- **Infrastructure**: No deployment rollback plan, manual deploys
- **Infrastructure**: No health check monitoring
- **Quality**: No integration tests, no e2e tests
- **Backend**: No graceful shutdown

### Severity
**High** - Every deploy risks extended outage.

### Root Cause
Infrastructure automation neglected. Deployments treated as special events instead of routine.

### Impact
- Broken deploys discovered by users, not tests
- No way to quickly revert bad deploy
- Database migrations can't be rolled back
- Zero-downtime deploys impossible
- Team afraid to ship, slowing velocity

### Remediation Priority & Effort
**Priority**: Fix before frequent deploy cadence needed.

**Effort**: High (4-8 days)
1. Set up staging environment mirroring production (2 days)
2. Implement CI pipeline with tests (1 day)
3. Add health check endpoint and monitoring (1 day)
4. Document rollback procedure and test it (1 day)
5. Implement blue-green or canary deployment (2 days)
6. Add database migration rollback (1 day)
7. Practice deploy/rollback cycle (1 day)

### Example Scenario
Team deploys new feature Friday afternoon. Breaks payment processing for subset of users due to edge case not caught in manual testing. No staging environment means issue wasn't caught. No health checks mean monitoring doesn't alert. Team notices when support tickets pile up. Attempts to rollback but database migration is irreversible. Spends weekend writing data migration script to fix corrupted records.

---

## Pattern 6: Context Leak

### Description
Application reveals internal implementation details that aid attackers.

### Signals
Combines findings from:
- **Backend**: Stack traces in API error responses
- **Backend**: Verbose error messages exposing database schema
- **Infrastructure**: Debug mode enabled in production
- **Security**: No error response sanitization
- **Backend**: Database errors returned to client

### Severity
**High** - Provides reconnaissance for targeted attacks.

### Root Cause
Development configuration accidentally deployed to production. No environment-specific error handling.

### Impact
- Attackers learn technology stack from error messages
- File paths reveal directory structure
- Database errors expose table and column names
- Stack traces show business logic and validation rules
- Reduces attacker effort by 10x

### Remediation Priority & Effort
**Priority**: Fix before public launch.

**Effort**: Medium (1-2 days)
1. Implement environment-aware error handler (4 hours)
2. Sanitize all API error responses (1 day)
3. Disable debug mode in production config (1 hour)
4. Add error logging with request correlation (4 hours)
5. Review all error paths for leaks (4 hours)

### Example Scenario
User submits malformed input to API endpoint. Error response includes full Prisma stack trace revealing database schema, table names, relations, and ORM query. Attacker uses this to craft precise SQL injection payload targeting specific columns. What could have been a generic 400 error becomes a roadmap for exploitation.

---

## Pattern 7: Dependency Time Bomb

### Description
Outdated dependencies with known vulnerabilities waiting to be exploited.

### Signals
Combines findings from:
- **Security**: No dependency vulnerability scanning, outdated packages
- **Infrastructure**: No automated security updates, no Dependabot
- **Quality**: No lockfile committed, inconsistent dependency versions
- **Infrastructure**: No container image scanning
- **Security**: Using packages with known CVEs

### Severity
**High** - Exploitable vulnerabilities accumulate over time.

### Root Cause
Dependency management treated as one-time setup. No ongoing maintenance process.

### Impact
- Known CVEs exploitable via public exploits
- Breaking changes on every `npm install`
- Impossible to reproduce builds
- Can't update due to accumulated breaking changes
- Compliance failures in security audits

### Remediation Priority & Effort
**Priority**: Fix before launch, then ongoing maintenance.

**Effort**: Medium (2-4 days initial, ongoing)
1. Run npm audit or equivalent and fix high/critical (1 day)
2. Commit lockfile (package-lock.json, yarn.lock) (1 hour)
3. Enable Dependabot or Renovate for automated PRs (2 hours)
4. Add dependency scanning to CI pipeline (4 hours)
5. Document update policy (quarterly updates) (2 hours)
6. Update all dependencies to latest compatible (1-2 days)
7. Add container scanning if using Docker (4 hours)

### Example Scenario
Application uses Express 4.16.0 from 2018. Critical ReDOS vulnerability (CVE-2022-24999) published. Attackers exploit regex vulnerability to DoS the server. Team attempts to update Express but discovers 47 breaking changes across dependencies. Forced to choose between vulnerability and multi-day update project. Meanwhile, site stays down under attack.
