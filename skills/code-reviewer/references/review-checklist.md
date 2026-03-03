# Code Review Checklist

## Security

- [ ] No SQL injection: all queries use parameterized statements
- [ ] No XSS: user input is sanitized/escaped before rendering in HTML
- [ ] No hardcoded secrets, API keys, or tokens in source code
- [ ] Authentication required on all non-public endpoints
- [ ] Authorization checks verify the requesting user has access to the resource
- [ ] Sensitive data (passwords, tokens) never logged or included in error messages
- [ ] File uploads validate type, size, and content (not just extension)
- [ ] CORS policy is restrictive (not `Access-Control-Allow-Origin: *` in production)
- [ ] Rate limiting on authentication and public endpoints
- [ ] Dependencies have no known critical/high vulnerabilities (`npm audit`, `govulncheck`)

## Performance

- [ ] No N+1 queries: batch queries or use JOINs/includes
- [ ] Database queries use appropriate indexes (check with EXPLAIN)
- [ ] No unbounded queries: all list endpoints have pagination or LIMIT
- [ ] Large computations or I/O moved off the request path (queues, background jobs)
- [ ] Caching used for expensive, repeated reads (Redis, in-memory LRU, HTTP cache headers)
- [ ] No synchronous file or network I/O in request handlers
- [ ] Images and assets optimized (WebP/AVIF, responsive sizes, lazy loading)
- [ ] Bundle size impact checked for new frontend dependencies

## Maintainability

- [ ] Functions and variables have descriptive names (no single-letter names except loop vars)
- [ ] Functions are under 30 lines. Longer functions are split into named helpers.
- [ ] No duplicate logic. Shared behavior extracted into reusable functions.
- [ ] Magic numbers and strings replaced with named constants
- [ ] Complex conditions extracted into named boolean variables
- [ ] Dependencies injected, not created internally (testability)
- [ ] Code reads top-to-bottom without jumping around
- [ ] Comments explain "why", not "what". Code should explain "what" on its own.

## Correctness

- [ ] Edge cases handled: empty arrays, null/undefined values, zero, negative numbers
- [ ] Error handling: all async operations have try/catch or .catch()
- [ ] Error messages are descriptive and actionable
- [ ] Return types match the documented API contract
- [ ] Race conditions: concurrent access to shared state is synchronized
- [ ] Boundary conditions: off-by-one errors in loops, pagination, slicing
- [ ] Type safety: no `as any`, no `@ts-ignore` without explanation

## Testing

- [ ] New logic has corresponding unit tests
- [ ] Edge cases tested: empty input, invalid input, boundary values
- [ ] API changes have integration tests
- [ ] Mocks are minimal. If more than 3 mocks are needed, consider redesigning.
- [ ] Tests are independent. No shared mutable state between test cases.
- [ ] Test names describe the expected behavior, not the implementation
- [ ] No flaky patterns: no real timers, no network calls, no shared state

## Code Organization

- [ ] Files are in the right directory per project conventions
- [ ] No circular dependencies between modules
- [ ] Public API surface is minimal. Internal helpers are not exported.
- [ ] Configuration is loaded from environment, not hardcoded
- [ ] Database schema changes have a migration file
- [ ] Breaking API changes are versioned or behind a feature flag
