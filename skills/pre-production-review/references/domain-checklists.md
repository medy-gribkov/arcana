# Pre-Production Review Domain Checklists

Comprehensive verification items for each of the 8 review domains.

## Security

- [ ] Authentication middleware enforced on all protected routes
- [ ] Role-Based Access Control (RBAC) implemented and enforced
- [ ] No hardcoded secrets, API keys, or credentials in source code
- [ ] Input sanitization applied to all user-supplied data
- [ ] SQL queries use parameterization (no string concatenation)
- [ ] XSS prevention via HTML escaping and Content Security Policy
- [ ] CORS whitelist configured (no wildcard * in production)
- [ ] Rate limiting implemented on authentication endpoints
- [ ] CSRF protection enabled for state-changing operations
- [ ] Secure session configuration (httpOnly, secure, sameSite cookies)
- [ ] Password hashing uses bcrypt, argon2, or scrypt (not MD5/SHA1)
- [ ] JWT tokens include expiry and are validated on every request
- [ ] File upload validation (type, size, content inspection)
- [ ] Path traversal prevention (no user input in file paths)
- [ ] Dependency vulnerability scanning enabled and passing

## Data Layer

- [ ] N+1 query detection via logging or query analysis
- [ ] All queries are bounded with LIMIT clauses
- [ ] Database indexes cover frequently queried columns
- [ ] Foreign key constraints defined between related tables
- [ ] Cascade rules (ON DELETE, ON UPDATE) explicitly configured
- [ ] Migrations include both up and down operations
- [ ] Connection pooling configured with appropriate limits
- [ ] Query timeouts set to prevent long-running queries
- [ ] No raw SQL string concatenation (use query builders or ORMs)
- [ ] Schema validation matches application models

## Backend/API

- [ ] Input validation using schema libraries (zod, joi, yup)
- [ ] Error responses sanitized (no stack traces or internal details)
- [ ] Request timeouts configured on all endpoints
- [ ] Payload size limits enforced to prevent DoS
- [ ] Idempotency keys supported for critical mutations
- [ ] API endpoints versioned (v1, v2) for backward compatibility
- [ ] Health check endpoint available for monitoring
- [ ] Graceful shutdown handling (drain connections, finish requests)
- [ ] Structured logging with correlation IDs
- [ ] Request ID propagation through the call stack
- [ ] Authentication required on all mutation routes
- [ ] File upload size limits enforced at application level

## External Services

- [ ] Exponential backoff implemented for retries
- [ ] Timeout configured on all external HTTP calls
- [ ] Circuit breaker pattern for unstable dependencies
- [ ] Dead letter queue for failed async operations
- [ ] Webhook signature verification for incoming webhooks
- [ ] API key rotation plan documented and tested
- [ ] Fallback behavior defined for degraded service states
- [ ] LLM output validation and sanitization before use

## Frontend

- [ ] Server vs client component separation clearly defined
- [ ] Bundle size under budget (check with bundle analyzer)
- [ ] Suspense boundaries placed around async components
- [ ] Error boundaries catch and handle runtime errors
- [ ] Loading skeletons displayed during data fetching
- [ ] Image optimization (WebP, AVIF, responsive sizes)
- [ ] Lazy loading for below-the-fold content
- [ ] Keyboard navigation fully functional
- [ ] ARIA labels present on interactive elements
- [ ] Color contrast ratio meets WCAG AA standards (4.5:1)

## Infrastructure

- [ ] CI pipeline runs tests on every commit
- [ ] Staging environment mirrors production configuration
- [ ] Health check endpoint monitored by orchestrator
- [ ] Secrets stored in vault (not .env files in repos)
- [ ] Log aggregation configured (CloudWatch, Datadog, etc.)
- [ ] Error tracking integrated (Sentry, Rollbar, etc.)
- [ ] Automated database backups with tested restore process
- [ ] SSL/TLS enforced on all endpoints (no HTTP)
- [ ] Container image scanning for vulnerabilities
- [ ] Deployment rollback plan documented and tested

## Performance

- [ ] No polling intervals shorter than 3 seconds
- [ ] Caching strategy implemented (SWR, React Query, Redis)
- [ ] No blocking operations on main thread (use workers)
- [ ] Database connection pooling configured
- [ ] CDN configured for static assets
- [ ] Response compression enabled (gzip or brotli)
- [ ] Database queries complete under 100ms at p99
- [ ] No N+1 queries in hot paths (user-facing flows)
- [ ] Images use srcset and sizes for responsive loading
- [ ] Code splitting implemented by route or feature

## Quality

- [ ] Unit test coverage for business logic functions
- [ ] Integration tests for API routes and database interactions
- [ ] End-to-end tests for critical user flows
- [ ] TypeScript strict mode enabled in tsconfig.json
- [ ] No `any` types in production code (use unknown or proper types)
- [ ] Linting enforced in CI pipeline (build fails on errors)
- [ ] No disabled eslint rules in production code
- [ ] Architecture decision records (ADRs) document key choices
