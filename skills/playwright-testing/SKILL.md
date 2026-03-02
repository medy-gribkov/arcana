---
name: playwright-testing
description: End-to-end testing with Playwright using role-based locators, auto-waiting, network mocking, visual regression, fixtures for test isolation, parallel execution, CI integration, authentication state reuse, and trace viewer debugging. Use when building reliable browser automation tests that catch regressions before production.
user-invokable: true
---

## Locator Strategies

**BAD:** CSS selectors couple tests to implementation. Breaks on refactors.

```typescript
await page.locator('.btn-primary.submit-form').click();
await page.locator('#username-input').fill('alice');
```

**GOOD:** Semantic locators match user perception. Resilient to markup changes.

```typescript
await page.getByRole('button', { name: 'Submit' }).click();
await page.getByLabel('Username').fill('alice');
await page.getByText('Welcome back').waitFor();
await page.getByPlaceholder('Search...').fill('query');
await page.getByTestId('checkout-total').textContent(); // Only when no semantic option
```

**BAD:** Fragile global selectors. Breaks with duplicate elements.

```typescript
await page.getByRole('button', { name: 'Delete' }).click(); // Which delete button?
```

**GOOD:** Chain locators to scope within a parent container.

```typescript
const row = page.getByRole('row', { name: 'Alice' });
await row.getByRole('button', { name: 'Delete' }).click();
await page.getByRole('listitem').filter({ hasText: 'Active' }).first().click();
```

## Auto-Waiting and Assertions

**BAD:** Hardcoded delays cause flakiness and slow tests.

```typescript
await page.waitForTimeout(2000);
await page.locator('.spinner').waitFor({ state: 'hidden' });
await page.locator('button').click();
```

**GOOD:** Use auto-waiting assertions. Retry until condition is met.

```typescript
await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();
await expect(page.getByText('Loading...')).not.toBeVisible();
await expect(page.getByLabel('Email')).toHaveValue('alice@example.com');
await expect(page.getByRole('checkbox', { name: 'Terms' })).toBeChecked();
await expect(page.getByText('Report')).toBeVisible({ timeout: 30000 }); // Custom timeout
```

## Network Mocking

**BAD:** Hitting real APIs in tests. Flaky, slow, pollutes production data.

```typescript
await page.goto('/users');
```

**GOOD:** Mock API responses with `route.fulfill()`. Fast, deterministic.

```typescript
await page.route('**/api/users', async (route) => {
  await route.fulfill({
    status: 200,
    body: JSON.stringify([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]),
  });
});
await page.goto('/users');
await expect(page.getByText('Alice')).toBeVisible();

// Conditional mocking
await page.route('**/api/**', async (route) => {
  route.request().url().includes('/logout') ? route.fulfill({ status: 200 }) : route.continue();
});

// Speed up tests by blocking resources
await page.route('**/*.{png,jpg,jpeg,webp}', (route) => route.abort());
```

## Visual Regression Testing

```typescript
await expect(page).toHaveScreenshot('homepage.png');
await expect(page.getByRole('banner')).toHaveScreenshot('header.png'); // Component-level
await expect(page).toHaveScreenshot({ mask: [page.getByText(/Last updated:.*/)] }); // Mask dynamic
```

Update baselines: `npx playwright test --update-snapshots`

## Fixtures and Test Isolation

**BAD:** Shared state leaks between tests. Failure in test 1 breaks test 2.

```typescript
let page;
test.beforeAll(async ({ browser }) => { page = await browser.newPage(); });
test('test 1', async () => { await page.fill('input', 'admin'); });
test('test 2', async () => { /* Still has 'admin' from test 1 */ });
```

**GOOD:** Isolated context per test. No side effects.

```typescript
test('login as admin', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText('Welcome, admin')).toBeVisible();
});
```

**GOOD:** Custom fixtures for reusable setup.

```typescript
import { test as base } from '@playwright/test';

type Fixtures = { authenticatedPage: Page };

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@example.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText('Dashboard')).toBeVisible();
    await use(page);
  },
});

test('view admin dashboard', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/admin');
  await expect(authenticatedPage.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();
});
```

## Authentication State Reuse

Avoid logging in for every test. Save auth state once, reuse across tests.

```typescript
// auth.setup.ts
import { test as setup } from '@playwright/test';
setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByLabel('Password').fill('admin123');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('/dashboard');
  await page.context().storageState({ path: 'auth.json' });
});

// test.spec.ts
test.use({ storageState: 'auth.json' });
test('access protected page', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();
});
```

Configure in `playwright.config.ts`:

```typescript
export default defineConfig({
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    { name: 'chromium', use: { storageState: 'auth.json' }, dependencies: ['setup'] },
  ],
});
```

## Parallel Execution

```typescript
export default defineConfig({
  workers: process.env.CI ? 2 : 4,
  fullyParallel: true,
});

// Disable for tests that share global state
test.describe.serial('checkout flow', () => {
  test('add item to cart', async ({ page }) => { /* ... */ });
  test('proceed to checkout', async ({ page }) => { /* ... */ });
});

// Use unique data per worker to avoid collisions
test('create user', async ({ page }) => {
  const workerId = test.info().parallelIndex;
  const email = `user${workerId}@example.com`;
  await page.getByLabel('Email').fill(email);
});
```

## CI Integration

```yaml
name: Playwright Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

# Shard tests for faster CI
strategy:
  matrix:
    shardIndex: [1, 2, 3, 4]
    shardTotal: [4]
steps:
  - run: npx playwright test --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
```

## Debugging

```bash
npx playwright test --trace on           # Record trace, view with show-report
npx playwright test --headed --slowmo=1000  # Watch tests in real-time
npx playwright test --debug              # Step through with inspector
npx playwright codegen http://localhost:3000  # Generate selectors
```

Capture traces on failure:

```typescript
export default defineConfig({
  use: { trace: 'on-first-retry' },
  retries: process.env.CI ? 2 : 0,
});
```

Set breakpoints with `page.pause()`:

```typescript
test('debug login', async ({ page }) => {
  await page.goto('/login');
  await page.pause(); // Playwright Inspector opens
  await page.getByLabel('Email').fill('admin@example.com');
});
```

Capture console and network logs:

```typescript
page.on('console', (msg) => msg.type() === 'error' && console.log('Error:', msg.text()));
page.on('request', (req) => console.log('Request:', req.url()));
```

## Page Object Model

**BAD:** Duplicating selectors and workflows across tests.

```typescript
test('user can login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByRole('button', { name: 'Login' }).click();
});
```

**GOOD:** Centralize page logic. Tests express intent, not mechanics.

```typescript
class LoginPage {
  constructor(private page: Page) {}
  async goto() { await this.page.goto('/login'); }
  async login(email: string, password: string) {
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Login' }).click();
  }
  async expectWelcome() {
    await expect(this.page.getByText('Welcome')).toBeVisible();
  }
}

test('user can login', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('user@example.com', 'pass123');
  await loginPage.expectWelcome();
});
```

## Troubleshooting

**Flaky tests:** Enable retries and traces. Use auto-waiting assertions instead of hardcoded delays.

**Selector not found:** Use `npx playwright codegen` to validate locators. Prefer semantic locators over CSS.

**Timeouts:** Increase timeout for slow operations: `await expect(page.getByText('Data')).toBeVisible({ timeout: 30000 });`

**Network mocking not working:** Ensure `page.route()` is called before navigation. Routes apply to requests made after registration.

**Parallel tests interfering:** Use `test.describe.serial()` or unique test data per worker.
