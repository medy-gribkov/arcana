---
name: api-testing
description: Contract testing with Pact, API mocking with MSW, load testing with k6/Locust, OpenAPI validation, and Postman/Insomnia automation. Code-first patterns for catching regressions before they reach production.
---

## Contract Testing with Pact

### Consumer Side: Define the Contract

```typescript
import { PactV3 } from '@pact-foundation/pact';

const provider = new PactV3({
  consumer: 'frontend',
  provider: 'user-api',
});

describe('User API', () => {
  it('returns user by id', async () => {
    await provider
      .given('user 1 exists')
      .uponReceiving('a request for user 1')
      .withRequest({ method: 'GET', path: '/users/1' })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { id: 1, name: 'Alice', email: 'alice@example.com' },
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/users/1`);
        const data = await res.json();
        expect(data.name).toBe('Alice');
      });
  });
});
```

### Provider Side: Verify Against Published Pacts

```typescript
import { Verifier } from '@pact-foundation/pact';

new Verifier({
  providerBaseUrl: 'http://localhost:3000',
  pactBrokerUrl: 'https://pact-broker.company.com',
  provider: 'user-api',
  providerVersion: process.env.GIT_SHA,
  stateHandlers: {
    'user 1 exists': async () => {
      await db.users.create({ id: 1, name: 'Alice' });
    },
  },
}).verifyProvider();
```

**BAD:** Testing the provider implementation in isolation without consumer contracts. Changes break consumers silently.

**GOOD:** Consumers define expected request/response pairs. Provider CI verifies against all published pacts. Breaking changes fail the build.

### Pact Broker Workflow

1. Consumer runs tests, publishes pact to broker with `pact-broker publish`.
2. Provider CI pulls latest pacts with `pact-broker can-i-deploy --to=production`.
3. If verification passes, deploy. If it fails, coordinate with consumer team before fixing.

## API Mocking Strategies

### MSW for Network-Level Mocking

**BAD:** Mocking fetch at the module level. Tests diverge from production behavior.

```typescript
jest.mock('node-fetch');
fetch.mockResolvedValue({ json: () => ({ id: 1 }) });
```

**GOOD:** Intercept at the network boundary with MSW. Tests hit real HTTP stack.

```typescript
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const handlers = [
  http.get('/api/users/:id', ({ params }) => {
    return HttpResponse.json({ id: params.id, name: 'Alice' });
  }),
];

const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Schema-Based Mocking with Prism

When the backend is not ready, generate a mock server from the OpenAPI spec.

```bash
prism mock openapi.yaml --port 4010
```

Frontend developers hit `http://localhost:4010` and get spec-compliant responses. Requests that violate the schema return validation errors.

### Record and Replay for Integration Tests

**BAD:** Hitting production APIs in tests. Flaky, slow, couples tests to external availability.

**GOOD:** Record real responses once, replay in tests. Refresh recordings monthly.

```typescript
import { Polly } from '@pollyjs/core';

const polly = new Polly('user-api', {
  recordIfMissing: true,
  adapters: ['fetch'],
  persister: 'fs',
});

await fetch('/api/users/1'); // First run records, subsequent runs replay
```

## Load Testing with k6

### Smoke Test: Verify Endpoint Works

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 1,
  duration: '30s',
};

export default function () {
  const res = http.get('http://localhost:3000/api/health');
  check(res, { 'status is 200': (r) => r.status === 200 });
}
```

### Load Test: Find Baseline Performance

**BAD:** Running load tests without thresholds. No automated pass/fail criteria.

```javascript
export const options = { vus: 50, duration: '2m' };
```

**GOOD:** Define SLA thresholds. Fail CI if p95 latency exceeds target.

```javascript
export const options = {
  vus: 50,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],   // Error rate under 1%
  },
};

export default function () {
  const res = http.get('http://localhost:3000/api/users');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

### Stress Test: Find Breaking Point

Ramp VUs beyond expected load to find where the system degrades.

```javascript
export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 300 },
    { duration: '5m', target: 0 },
  ],
};
```

### CI Integration

```bash
# Run smoke test on every PR
k6 run --quiet smoke.js

# Export results to Grafana Cloud
k6 run --out cloud load.js
```

Fail pipeline if thresholds are not met. Store results as build artifacts for trending.

## Load Testing with Locust

### Basic User Behavior

```python
from locust import HttpUser, task, between

class ApiUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def get_users(self):
        self.client.get("/api/users")

    @task(1)
    def get_user_by_id(self):
        self.client.get("/api/users/1")
```

Weight tasks with `@task(n)`. Higher values mean more frequent execution.

### Headless Mode for CI

```bash
locust -f locustfile.py --headless -u 100 -r 10 -t 2m --host=http://localhost:3000
```

- `-u 100`: 100 concurrent users
- `-r 10`: Spawn 10 users per second
- `-t 2m`: Run for 2 minutes

**When to use Locust vs k6:**

- k6: JavaScript ecosystem, lower resource usage, built-in thresholds
- Locust: Python ecosystem, web UI, complex user flows

## OpenAPI Schema Validation

### Runtime Validation in Express

**BAD:** Manual request validation. Diverges from spec over time.

```typescript
app.post('/users', (req, res) => {
  if (!req.body.name) return res.status(400).send('Missing name');
});
```

**GOOD:** Validate against OpenAPI spec at runtime. Spec is the source of truth.

```typescript
import { OpenApiValidator } from 'express-openapi-validator';

app.use(OpenApiValidator.middleware({
  apiSpec: './openapi.yaml',
  validateRequests: true,
  validateResponses: true,
}));
```

Requests that do not match the spec return 400. Responses that do not match log warnings (dev) or errors (production).

### Test-Time Validation

Validate every test response against the schema. Catch drift immediately.

```typescript
import Ajv from 'ajv';
import schema from './openapi.json';

const ajv = new Ajv();
const validate = ajv.compile(schema.paths['/users/{id}'].get.responses['200']);

const res = await fetch('/api/users/1');
const data = await res.json();
expect(validate(data)).toBe(true);
```

### Detect Breaking Changes with oasdiff

```bash
oasdiff changelog openapi-v1.yaml openapi-v2.yaml
```

Output shows breaking changes (removed endpoint, changed type) vs non-breaking (added optional field).

Run in CI on spec changes. Flag breaking changes for review before merge.

## Postman/Insomnia Collections

### Collection Structure

**BAD:** Organizing by HTTP method (GET folder, POST folder). Hard to find related requests.

**GOOD:** Organize by resource. CRUD operations grouped together.

```
Users/
  Create User (POST)
  Get User (GET)
  Update User (PUT)
  Delete User (DELETE)
Orders/
  Create Order (POST)
  List Orders (GET)
```

### Environment Variables

**BAD:** Hardcoding base URL and tokens in requests. Cannot switch environments.

```json
{
  "method": "GET",
  "url": "https://api.production.com/users/1",
  "headers": { "Authorization": "Bearer abc123" }
}
```

**GOOD:** Use environment variables. Switch between local, staging, production with one click.

```json
{
  "method": "GET",
  "url": "{{baseUrl}}/users/{{userId}}",
  "headers": { "Authorization": "Bearer {{authToken}}" }
}
```

### Automation with Newman

Export collections to JSON, commit to repo, run in CI.

```bash
newman run collection.json -e staging.json --reporters cli,json
```

Generate collections from OpenAPI specs to stay in sync.

```bash
openapi2postmanv2 -s openapi.yaml -o collection.json
```

## Test Organization

**BAD:** Mixing contract tests, integration tests, and load tests in one suite. Different cadences require different runs.

**GOOD:** Separate test suites by type and run on different schedules.

```
tests/
  contract/       # Run on every commit
  integration/    # Run on merge to main
  load/           # Run nightly
```

Tag tests for selective execution.

```typescript
describe('User API', () => {
  it('returns 200 @smoke', async () => { /* ... */ });
  it('handles pagination @regression', async () => { /* ... */ });
});
```

Run smoke tests on every PR, regression tests on merge.

## Troubleshooting

**Flaky API tests:** Add retry logic for network errors, not assertion failures. Use exponential backoff.

```typescript
const res = await retryOnNetworkError(() => fetch('/api/users'), { maxRetries: 3 });
```

**Contract verification failing:** Check provider state setup. Missing `stateHandlers` is the most common cause.

**k6 results inconsistent:** Ensure test target is isolated. Shared staging environments skew results. Run against dedicated test instances.

**Mock server not intercepting:** Check URL patterns. MSW matches exact paths. Trailing slashes and query params matter.

```typescript
// BAD: Does not match /api/users?page=1
http.get('/api/users', handler);

// GOOD: Matches all query params
http.get('/api/users', handler);
```
