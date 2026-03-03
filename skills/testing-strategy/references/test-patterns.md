# Test Pattern Examples

## Arrange-Act-Assert (AAA)

Every test follows this structure. No exceptions.

```typescript
describe('calculateDiscount', () => {
  it('applies percentage discount to order total', () => {
    // Arrange
    const order = createOrder({ total: 200 });
    const discount = { type: 'percentage', value: 10 };

    // Act
    const result = applyDiscount(order, discount);

    // Assert
    expect(result.total).toBe(180);
    expect(result.discountApplied).toBe(20);
  });
});
```

## Fixture Patterns

### Factory Functions (Preferred)

```typescript
function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'member',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

// Usage
const admin = createUser({ role: 'admin' });
const newUser = createUser({ id: 'user-2', name: 'Alice' });
```

### Pytest Fixtures with Cleanup

```python
import pytest

@pytest.fixture
def db_session():
    session = create_test_session()
    yield session
    session.rollback()
    session.close()

@pytest.fixture
def sample_user(db_session):
    user = User(name="Test", email="test@example.com")
    db_session.add(user)
    db_session.flush()
    return user
```

### Go Table-Driven Tests

```go
func TestValidateEmail(t *testing.T) {
    tests := []struct {
        name  string
        input string
        valid bool
    }{
        {"valid email", "user@example.com", true},
        {"missing @", "userexample.com", false},
        {"empty string", "", false},
        {"spaces", "user @example.com", false},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := ValidateEmail(tt.input)
            if got != tt.valid {
                t.Errorf("ValidateEmail(%q) = %v, want %v", tt.input, got, tt.valid)
            }
        })
    }
}
```

## Mocking Patterns

### Dependency Injection Mock

```typescript
interface EmailService {
  send(to: string, subject: string, body: string): Promise<void>;
}

// Production
class SmtpEmailService implements EmailService { /* ... */ }

// Test
class MockEmailService implements EmailService {
  sentEmails: Array<{ to: string; subject: string; body: string }> = [];

  async send(to: string, subject: string, body: string) {
    this.sentEmails.push({ to, subject, body });
  }
}

// In test
const emailService = new MockEmailService();
const userService = new UserService(emailService);
await userService.registerUser({ email: 'new@example.com' });
expect(emailService.sentEmails).toHaveLength(1);
expect(emailService.sentEmails[0].to).toBe('new@example.com');
```

### Spy Pattern (Vitest/Jest)

```typescript
const notifier = { notify: vi.fn().mockResolvedValue(undefined) };
const service = createOrderService({ notifier });

await service.placeOrder(order);

expect(notifier.notify).toHaveBeenCalledWith('order-placed', { orderId: order.id });
expect(notifier.notify).toHaveBeenCalledTimes(1);
```

## Snapshot Testing

Best for: serialized output, CLI formatting, error messages.
Bad for: UI components (too brittle).

```typescript
it('formats error response correctly', () => {
  const result = formatError(new ValidationError('bad input', ['field1', 'field2']));
  expect(result).toMatchInlineSnapshot(`
    {
      "error": "bad input",
      "fields": ["field1", "field2"],
      "status": 422
    }
  `);
});
```

## Parameterized Tests

```typescript
it.each([
  ['valid@email.com', true],
  ['no-at-sign', false],
  ['@missing-local', false],
  ['two@@ats.com', false],
])('validates email "%s" as %s', (email, expected) => {
  expect(isValidEmail(email)).toBe(expected);
});
```

```python
@pytest.mark.parametrize("input_val,expected", [
    ("valid@email.com", True),
    ("no-at-sign", False),
    ("@missing-local", False),
])
def test_validate_email(input_val, expected):
    assert validate_email(input_val) == expected
```

## Isolation: Fake Timers

```typescript
// BAD: Real timers, flaky
test('debounce', async () => {
  debounce(fn, 100);
  await new Promise((r) => setTimeout(r, 150));
  expect(fn).toHaveBeenCalled();
});

// GOOD: Fake timers, deterministic
test('debounce', () => {
  vi.useFakeTimers();
  debounce(fn, 100);
  vi.advanceTimersByTime(150);
  expect(fn).toHaveBeenCalled();
  vi.useRealTimers();
});
```
