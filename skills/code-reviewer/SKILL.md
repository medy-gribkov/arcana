---
name: code-reviewer
description: Code review workflow for local changes and remote PRs. Reviews focus on correctness, maintainability, security, and test coverage with concrete examples and inline comments.
---

## Determine Review Target

**Remote PR:** User provides a PR number or URL (e.g., "Review PR #123").

**Local changes:** User asks to "review my changes" or no PR is specified.

## Review Workflow

### For Remote PRs

1. Checkout the PR branch.

```bash
gh pr checkout 123
```

2. Run preflight checks to catch automated failures early.

```bash
npm run preflight
```

3. Read PR description and existing comments to understand context.

```bash
gh pr view 123
```

### For Local Changes

1. Check git status and read diffs.

```bash
git status
git diff          # Working tree changes
git diff --staged # Staged changes
```

2. Optionally run preflight if changes are substantial.

```bash
npm run preflight
```

## Review Pillars

### Correctness

**What to flag:** Logic errors, incorrect assumptions, missing edge case handling.

**Example review comment:**

```typescript
// File: src/orders/calculateTotal.ts:15
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

**Flag:** This does not account for quantity. If an item has `quantity: 3`, it should multiply `price * quantity`.

**Suggested fix:**

```typescript
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
```

### Maintainability

**What to flag:** Complex functions, unclear naming, duplicate logic, missing abstractions.

**BAD:**

```typescript
// File: src/users/api.ts:42
async function handle(req: Request, res: Response) {
  const u = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!u) return res.status(404).send('Not found');
  if (req.user.id !== u.id && req.user.role !== 'admin') {
    return res.status(403).send('Forbidden');
  }
  res.json(u);
}
```

**Flag:** Function name `handle` is vague. Variable `u` is unclear. Authorization logic is inline and will be duplicated across routes.

**GOOD:**

```typescript
async function getUserById(req: Request, res: Response) {
  const user = await findUserById(req.params.id);
  if (!user) return res.status(404).send('User not found');

  if (!canAccessUser(req.user, user)) {
    return res.status(403).send('Access denied');
  }

  res.json(user);
}

function canAccessUser(requester: User, target: User): boolean {
  return requester.id === target.id || requester.role === 'admin';
}
```

### Security

**What to flag:** SQL injection, XSS, hardcoded secrets, missing authentication, unsafe deserialization.

**BAD:**

```typescript
// File: src/search/api.ts:28
app.get('/search', (req, res) => {
  const results = db.query(`SELECT * FROM products WHERE name LIKE '%${req.query.q}%'`);
  res.json(results);
});
```

**Flag:** SQL injection vulnerability. User input is directly interpolated into the query. An attacker can inject `'; DROP TABLE products; --`.

**GOOD:**

```typescript
app.get('/search', (req, res) => {
  const results = db.query('SELECT * FROM products WHERE name LIKE ?', [`%${req.query.q}%`]);
  res.json(results);
});
```

### Readability

**What to flag:** Inconsistent formatting, missing comments for complex logic, misleading names.

**BAD:**

```typescript
// File: src/analytics/metrics.ts:55
function calc(d: any) {
  const x = d.reduce((a, b) => a + b.v, 0);
  return x / d.length;
}
```

**Flag:** Cryptic naming. `calc` does not describe what it calculates. `d`, `a`, `b`, `v`, `x` are meaningless. Parameter type is `any`.

**GOOD:**

```typescript
function calculateAverageValue(dataPoints: DataPoint[]): number {
  const sum = dataPoints.reduce((total, point) => total + point.value, 0);
  return sum / dataPoints.length;
}
```

### Efficiency

**What to flag:** N+1 queries, unnecessary loops, unbounded data loading, missing indexes.

**BAD:**

```typescript
// File: src/orders/report.ts:18
async function getOrdersWithUsers(orderIds: string[]) {
  const orders = await db.orders.findMany({ where: { id: { in: orderIds } } });

  for (const order of orders) {
    order.user = await db.users.findUnique({ where: { id: order.userId } });
  }

  return orders;
}
```

**Flag:** N+1 query problem. For 100 orders, this executes 101 queries (1 for orders, 100 for users).

**GOOD:**

```typescript
async function getOrdersWithUsers(orderIds: string[]) {
  const orders = await db.orders.findMany({
    where: { id: { in: orderIds } },
    include: { user: true },
  });

  return orders;
}
```

### Edge Cases and Error Handling

**What to flag:** Missing null checks, unhandled promise rejections, no fallback for empty arrays.

**BAD:**

```typescript
// File: src/cart/total.ts:10
function getFirstItemPrice(cart: Cart): number {
  return cart.items[0].price;
}
```

**Flag:** Crashes if `cart.items` is empty. No validation that items exist.

**GOOD:**

```typescript
function getFirstItemPrice(cart: Cart): number {
  if (cart.items.length === 0) {
    throw new Error('Cannot get price from empty cart');
  }
  return cart.items[0].price;
}
```

### Test Coverage

**What to flag:** Missing tests for new logic, incomplete edge case coverage, no integration tests for API changes.

**Example review comment:**

```typescript
// File: src/payments/refund.ts:25
export async function processRefund(orderId: string, amount: number) {
  const order = await db.orders.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('Order not found');

  if (amount > order.total) {
    throw new Error('Refund amount exceeds order total');
  }

  await paymentGateway.refund(order.paymentId, amount);
  await db.orders.update({
    where: { id: orderId },
    data: { refundedAmount: order.refundedAmount + amount },
  });
}
```

**Flag:** No tests found in `src/payments/refund.test.ts`. Suggested tests:

1. Refund succeeds for valid amount
2. Throws error when order not found
3. Throws error when refund exceeds order total
4. Updates `refundedAmount` correctly
5. Handles payment gateway failure gracefully

## Provide Feedback

### Structure

**Summary:** High-level overview of the changes and overall assessment.

**Findings:**

- **Critical:** Bugs, security vulnerabilities, breaking changes. Must fix before merge.
- **Improvements:** Code quality, performance, or design suggestions. Recommended but not blocking.
- **Nitpicks:** Formatting, minor naming issues. Optional.

**Conclusion:** Clear recommendation (Approve / Request Changes).

### Example Review

**Summary:**

This PR adds a refund processing feature for orders. The core logic is sound, but there are a few critical issues around input validation and error handling that need addressing before merge.

**Findings:**

**Critical:**

1. `src/payments/refund.ts:30` - Missing validation for negative refund amounts. Add `if (amount <= 0) throw new Error('Refund amount must be positive')`.

2. `src/payments/refund.ts:35` - Payment gateway errors are not caught. Wrap in try/catch and handle failure cases (e.g., log error, notify admin).

**Improvements:**

1. `src/payments/refund.ts:25` - Consider extracting validation logic into a separate `validateRefundRequest()` function for reusability.

2. `src/payments/refund.test.ts` - Missing tests for edge cases (see Test Coverage section above).

**Nitpicks:**

1. `src/payments/refund.ts:15` - Variable `order` could be named `existingOrder` for clarity.

**Conclusion:** Request Changes. Please address the critical issues and add the suggested tests. Happy to approve once those are resolved.

### Tone

**Direct and constructive.** Explain why a change is needed, not just what to change.

**BAD:** "This is wrong."

**GOOD:** "This does not handle the case where `items` is empty, which will cause a runtime error. Add a length check before accessing `items[0]`."

**Acknowledge strengths.** Call out well-written code, good test coverage, or thoughtful design.

**Example:** "Nice work on the error handling in `processPayment()`. The fallback logic for gateway timeouts is solid."

## Cleanup (Remote PRs Only)

After completing the review, ask if the user wants to switch back to the default branch.

```bash
gh pr checkout --detach
git checkout main
```
