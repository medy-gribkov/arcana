# API Testing Patterns

## Contract Testing

Contract testing ensures consumer and provider agree on the API shape. Changes that break the contract fail the build before deployment.

### Consumer-Driven Contract Flow

1. **Consumer** writes a test defining expected request/response pairs.
2. Consumer publishes the contract (pact file) to a broker.
3. **Provider** CI pulls the contract and verifies its API satisfies it.
4. If verification fails, the provider cannot deploy.

### Pact Example

```typescript
// Consumer side
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
```

### Breaking Change Detection with oasdiff

```bash
oasdiff changelog openapi-v1.yaml openapi-v2.yaml
# Shows: removed endpoints, changed types, added required fields
```

Run in CI on spec changes. Flag breaking changes for review.

## Smoke Tests

Minimal tests that verify an API is alive and responding. Run on every deployment.

```javascript
// k6 smoke test
import http from 'k6/http';
import { check } from 'k6';

export const options = { vus: 1, duration: '10s' };

export default function () {
  const health = http.get('http://localhost:3000/api/health');
  check(health, { 'health 200': (r) => r.status === 200 });

  const users = http.get('http://localhost:3000/api/users?limit=1');
  check(users, {
    'users 200': (r) => r.status === 200,
    'users has data': (r) => JSON.parse(r.body).length > 0,
  });
}
```

### Smoke Test Checklist

- [ ] Health endpoint returns 200
- [ ] Auth endpoint accepts valid credentials
- [ ] Primary read endpoint returns data
- [ ] Primary write endpoint accepts valid input
- [ ] Error responses have correct format (status code, error body)

## Load Testing Configurations

### k6: Baseline Performance

```javascript
export const options = {
  vus: 50,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95th percentile under 500ms
    http_req_failed: ['rate<0.01'],    // Error rate under 1%
  },
};
```

### k6: Stress Test (Find Breaking Point)

```javascript
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp to 100 VUs
    { duration: '5m', target: 200 },   // Ramp to 200 VUs
    { duration: '2m', target: 300 },   // Ramp to 300 VUs
    { duration: '5m', target: 0 },     // Cool down
  ],
};
```

### k6: Soak Test (Memory Leaks)

```javascript
export const options = {
  vus: 50,
  duration: '30m',
  thresholds: {
    http_req_duration: ['p(99)<1000'],
  },
};
```

### Locust: Complex User Behavior

```python
from locust import HttpUser, task, between

class ApiUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def browse_products(self):
        self.client.get("/api/products")

    @task(1)
    def place_order(self):
        self.client.post("/api/orders", json={
            "items": [{"id": 1, "quantity": 2}]
        })
```

## Integration Test Patterns

### Schema Validation on Every Response

```typescript
import Ajv from 'ajv';
import schema from './openapi.json';

const ajv = new Ajv();

it('GET /users/:id matches OpenAPI schema', async () => {
  const res = await request.get('/api/users/1');
  const validate = ajv.compile(
    schema.paths['/users/{id}'].get.responses['200'].content['application/json'].schema
  );
  expect(validate(res.body)).toBe(true);
});
```

### Test Organization

```
tests/
  contract/       # Run on every commit
  integration/    # Run on merge to main
  load/           # Run nightly
  smoke/          # Run on every deployment
```

### Authentication Test Patterns

```typescript
describe('Protected endpoints', () => {
  it('returns 401 without auth header', async () => {
    const res = await request.get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with expired token', async () => {
    const res = await request
      .get('/api/users/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });

  it('returns 403 for unauthorized resource', async () => {
    const res = await request
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${regularUserToken}`);
    expect(res.status).toBe(403);
  });
});
```

## Troubleshooting

- **Flaky tests:** Add retry for network errors only, not assertion failures. Use exponential backoff.
- **Contract verification failing:** Check provider state setup. Missing `stateHandlers` is the most common cause.
- **k6 results inconsistent:** Use dedicated test instances, not shared staging.
- **Mock not intercepting:** Check URL patterns. MSW matches exact paths. Trailing slashes matter.
