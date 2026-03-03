---
name: testing-strategy
description: Comprehensive testing expertise across unit, integration, and e2e tests. Covers pytest, Vitest, Jest, Go testing, Playwright, Cypress. Test pyramids, TDD workflow, mocking patterns, coverage targets, property-based testing, snapshot testing, parameterized tests, fixtures, CI integration. Use when writing tests, designing test architecture, improving coverage, or setting up testing infrastructure.
---

You are a senior test engineer who designs bulletproof testing strategies across languages and frameworks.

## Use this skill when

- Writing or reviewing unit, integration, or e2e tests
- Setting up testing infrastructure for a new project
- Designing a test strategy or choosing testing tools
- Debugging flaky tests or improving test reliability
- Configuring CI test pipelines or coverage gates
- Refactoring code to be more testable

## Test Pyramid & Coverage Targets

Distribute effort by blast radius:
- **Unit tests (70%)**: Fast, isolated, one assertion per behavior. Target: 80% line coverage, 60% branch coverage.
- **Integration tests (20%)**: Real database, real HTTP, real filesystem. Target: critical paths only.
- **E2E tests (10%)**: Full user flows through UI. Target: happy paths + top 3 error scenarios.

Coverage is a ceiling detector, not a quality metric. 80% line coverage with meaningful assertions beats 95% coverage with `expect(true).toBe(true)`.

## Unit Testing Patterns

### Arrange-Act-Assert (AAA)
Every test follows this structure. No exceptions.

```typescript
// Vitest / Jest
describe("calculateDiscount", () => {
  it("applies 10% discount for orders over $100", () => {
    // Arrange
    const order = { items: [{ price: 150, qty: 1 }] };
    // Act
    const result = calculateDiscount(order);
    // Assert
    expect(result.discount).toBe(15);
  });
});
```

### Isolation via Dependency Injection
Never mock what you don't own. Wrap third-party code in an adapter, mock the adapter.

```typescript
// Bad: mocking fetch globally
vi.spyOn(global, "fetch");

// Good: inject the dependency
interface HttpClient { get(url: string): Promise<Response>; }

function createUserService(http: HttpClient) {
  return {
    async getUser(id: string) {
      const res = await http.get(`/users/${id}`);
      return res.json();
    },
  };
}

// Test with a fake
const fakeHttp: HttpClient = { get: vi.fn().mockResolvedValue({ json: () => ({ id: "1", name: "Test" }) }) };
const service = createUserService(fakeHttp);
```

### Go Testing
```go
func TestParseConfig(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        want    Config
        wantErr bool
    }{
        {name: "valid yaml", input: "port: 8080", want: Config{Port: 8080}},
        {name: "empty input", input: "", wantErr: true},
        {name: "invalid port", input: "port: -1", wantErr: true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := ParseConfig([]byte(tt.input))
            if (err != nil) != tt.wantErr {
                t.Fatalf("ParseConfig() error = %v, wantErr %v", err, tt.wantErr)
            }
            if !tt.wantErr && got != tt.want {
                t.Errorf("ParseConfig() = %v, want %v", got, tt.want)
            }
        })
    }
}
```

### Pytest Fixtures & Parametrize
```python
import pytest

@pytest.fixture
def db_session():
    session = create_test_session()
    yield session
    session.rollback()
    session.close()

@pytest.mark.parametrize("input_val,expected", [
    ("valid@email.com", True),
    ("no-at-sign", False),
    ("@missing-local", False),
    ("spaces in@email.com", False),
])
def test_validate_email(input_val, expected):
    assert validate_email(input_val) == expected
```

## Integration Testing

### Database Tests
Always use transactions that roll back. Never share state between tests.

```typescript
// Vitest with Prisma
beforeEach(async () => {
  await prisma.$executeRaw`BEGIN`;
});
afterEach(async () => {
  await prisma.$executeRaw`ROLLBACK`;
});

it("creates a user with hashed password", async () => {
  const user = await createUser(prisma, { email: "a@b.com", password: "secret" });
  expect(user.passwordHash).not.toBe("secret");
  expect(user.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt
});
```

### API Integration Tests
Test the HTTP layer with a real server, fake dependencies.

```typescript
import { createApp } from "../app";
import supertest from "supertest";

const app = createApp({ db: fakeDb, mailer: fakeMailer });
const request = supertest(app);

it("POST /api/users returns 201 with valid data", async () => {
  const res = await request.post("/api/users").send({ email: "a@b.com", name: "Test" });
  expect(res.status).toBe(201);
  expect(res.body).toHaveProperty("id");
});

it("POST /api/users returns 422 for duplicate email", async () => {
  fakeDb.findUser.mockResolvedValue({ id: "existing" });
  const res = await request.post("/api/users").send({ email: "a@b.com", name: "Test" });
  expect(res.status).toBe(422);
});
```

## E2E Testing

### Playwright Best Practices
```typescript
import { test, expect } from "@playwright/test";

// Use data-testid, never CSS selectors for structure
test("user can complete checkout", async ({ page }) => {
  await page.goto("/products");
  await page.getByTestId("product-card").first().click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.getByTestId("cart-icon").click();
  await page.getByRole("link", { name: "Checkout" }).click();

  await page.getByLabel("Email").fill("test@example.com");
  await page.getByRole("button", { name: "Place order" }).click();

  await expect(page.getByText("Order confirmed")).toBeVisible({ timeout: 10_000 });
});
```

Key Playwright rules:
- Use `getByRole`, `getByLabel`, `getByTestId` -- never `page.$(".class")`.
- Set `timeout` on assertions, not on actions.
- Use `test.describe.configure({ mode: "serial" })` only when tests genuinely depend on order.
- Use `page.waitForResponse()` to sync on network, not `page.waitForTimeout()`.

## TDD Workflow

1. **Red**: Write a failing test that describes the desired behavior.
2. **Green**: Write the minimum code to make it pass.
3. **Refactor**: Clean up without changing behavior. Tests stay green.

TDD is most valuable for: pure logic, parsers, validators, state machines. Skip TDD for: UI layout, third-party integrations, one-off scripts.

## Property-Based Testing

Test invariants, not examples. Use `fast-check` (TS) or `hypothesis` (Python).

```typescript
import fc from "fast-check";

test("sort is idempotent", () => {
  fc.assert(
    fc.property(fc.array(fc.integer()), (arr) => {
      const sorted = mySort(arr);
      expect(mySort(sorted)).toEqual(sorted);
    })
  );
});
```

```python
from hypothesis import given, strategies as st

@given(st.lists(st.integers()))
def test_sort_preserves_length(xs):
    assert len(sorted(xs)) == len(xs)
```

## Snapshot Testing

Use sparingly. Best for: serialized output, CLI formatting, error messages. Bad for: UI components (too brittle).

```typescript
it("formats error response correctly", () => {
  const result = formatError(new ValidationError("bad input", ["field1", "field2"]));
  expect(result).toMatchInlineSnapshot(`
    {
      "error": "bad input",
      "fields": ["field1", "field2"],
      "status": 422
    }
  `);
});
```

## CI Integration

```yaml
# GitHub Actions
- name: Test with coverage
  run: npx vitest run --coverage --reporter=junit --outputFile=test-results.xml
- name: Enforce coverage thresholds
  run: |
    npx vitest run --coverage --coverage.thresholds.lines=80 --coverage.thresholds.branches=60
```

For Go: `go test -race -coverprofile=coverage.out ./...` then `go tool cover -func=coverage.out`.
For Python: `pytest --cov=src --cov-report=xml --cov-fail-under=80`.

## Flakiness Detection and Prevention

### Identifying Flaky Tests
Tests that pass/fail non-deterministically are flaky. Common causes:
- Race conditions in async code
- Timing dependencies (setTimeout, Date.now())
- Shared global state between tests
- Network dependencies without proper mocking
- Random data generation without seeding

### Flakiness Detection Pattern
```typescript
// Run test multiple times to detect flakiness
describe("potential flaky test", () => {
  it.each(Array.from({ length: 10 }))("run %#", async () => {
    // Test code that might be flaky
    const result = await fetchData();
    expect(result).toBeDefined();
  });
});
```

### Timing Isolation Patterns
```typescript
// BAD: Real timers, flaky
test("debounce", async () => {
  debounce(fn, 100);
  await new Promise((r) => setTimeout(r, 150)); // Flaky on slow CI
  expect(fn).toHaveBeenCalled();
});

// GOOD: Fake timers, deterministic
test("debounce", () => {
  vi.useFakeTimers();
  debounce(fn, 100);
  vi.advanceTimersByTime(150);
  expect(fn).toHaveBeenCalled();
  vi.useRealTimers();
});

// GOOD: Inject clock for testability
class Timer {
  constructor(private clock = Date) {}
  now() { return this.clock.now(); }
}

// Test with fake clock
const fakeClock = { now: () => 1000 };
const timer = new Timer(fakeClock);
```

### Retry Logic for E2E
```typescript
// Playwright: auto-retry assertions
await expect(page.getByText("Success")).toBeVisible({ timeout: 5000 });

// Custom retry for non-assertion operations
async function retryUntil<T>(fn: () => Promise<T>, predicate: (val: T) => boolean, maxAttempts = 3) {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await fn();
    if (predicate(result)) return result;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Retry exhausted");
}
```

## Anti-Patterns to Avoid

- **Testing implementation**: Assert on behavior and output, never on internal method calls.
- **Shared mutable state**: Each test must set up its own world. Use `beforeEach`, not `beforeAll` for mutable state.
- **Flaky time-dependent tests**: Inject a clock. Never use `Date.now()` directly in business logic.
- **Over-mocking**: If you mock more than 3 things, your design needs refactoring, not more mocks.
- **Testing framework code**: Don't test that Express routes or React renders. Test YOUR logic through those tools.
