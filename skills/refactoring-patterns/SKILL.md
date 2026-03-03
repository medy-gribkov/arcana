---
name: refactoring-patterns
description: Code refactoring patterns with before/after diffs for extract method, extract class, inline, move, rename, dead code removal, dependency injection, and code smell detection.
---

## Extract Method

**When:** A code block does one logical thing within a function that does more.

**BEFORE:**

```typescript
function processOrder(order: Order) {
  // Validate order
  if (!order.items || order.items.length === 0) {
    throw new Error('Order must have items');
  }
  if (order.total <= 0) {
    throw new Error('Order total must be positive');
  }

  // Calculate tax
  let tax = 0;
  for (const item of order.items) {
    tax += item.price * item.quantity * 0.08;
  }

  // Save to database
  db.orders.insert({ ...order, tax });
}
```

**AFTER:**

```typescript
function processOrder(order: Order) {
  validateOrder(order);
  const tax = calculateTax(order.items);
  saveOrder(order, tax);
}

function validateOrder(order: Order) {
  if (!order.items || order.items.length === 0) {
    throw new Error('Order must have items');
  }
  if (order.total <= 0) {
    throw new Error('Order total must be positive');
  }
}

function calculateTax(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity * 0.08, 0);
}

function saveOrder(order: Order, tax: number) {
  db.orders.insert({ ...order, tax });
}
```

**Why:** Each function has a single responsibility. Method names replace comments.

## Extract Class

**When:** A class has multiple responsibilities or a group of fields are always used together.

**BEFORE:**

```typescript
class User {
  id: number;
  name: string;
  email: string;
  street: string;
  city: string;
  zipCode: string;
  country: string;

  getFullAddress(): string {
    return `${this.street}, ${this.city}, ${this.zipCode}, ${this.country}`;
  }
}
```

**AFTER:**

```typescript
class Address {
  constructor(
    public street: string,
    public city: string,
    public zipCode: string,
    public country: string
  ) {}

  getFullAddress(): string {
    return `${this.street}, ${this.city}, ${this.zipCode}, ${this.country}`;
  }
}

class User {
  id: number;
  name: string;
  email: string;
  address: Address;
}
```

**Why:** Address is a cohesive concept. Extracting it makes User simpler and Address reusable.

## Inline Method

**When:** A method's body is as clear as its name. The indirection adds no value.

**BEFORE:**

```typescript
function getDiscountedPrice(price: number, discount: number): number {
  return applyDiscount(price, discount);
}

function applyDiscount(price: number, discount: number): number {
  return price * (1 - discount);
}
```

**AFTER:**

```typescript
function getDiscountedPrice(price: number, discount: number): number {
  return price * (1 - discount);
}
```

## Replace Conditional with Polymorphism

**When:** A switch or if/else chain selects behavior based on type.

**BEFORE:**

```typescript
class Order {
  type: 'standard' | 'express' | 'overnight';

  calculateShipping(): number {
    if (this.type === 'standard') return 5;
    else if (this.type === 'express') return 15;
    else if (this.type === 'overnight') return 30;
  }
}
```

**AFTER:**

```typescript
interface Order {
  calculateShipping(): number;
}

class StandardOrder implements Order {
  calculateShipping(): number { return 5; }
}

class ExpressOrder implements Order {
  calculateShipping(): number { return 15; }
}

class OvernightOrder implements Order {
  calculateShipping(): number { return 30; }
}
```

**Why:** Adding new order types requires no changes to existing code. Open/closed principle.

## Dependency Injection

**When:** A class creates its dependencies internally. Hard to test and couples implementation.

**BEFORE:**

```typescript
class OrderService {
  private db = new Database();
  private emailer = new EmailService();

  async createOrder(order: Order) {
    await this.db.orders.insert(order);
    await this.emailer.send(order.email, 'Order confirmed');
  }
}
```

**AFTER:**

```typescript
class OrderService {
  constructor(
    private db: Database,
    private emailer: EmailService
  ) {}

  async createOrder(order: Order) {
    await this.db.orders.insert(order);
    await this.emailer.send(order.email, 'Order confirmed');
  }
}

// Testing
const testService = new OrderService(mockDb, mockEmailer);
```

**Why:** Dependencies are explicit. Testing with mocks is trivial.

## Code Smells

Catalog of common code smells: Long Method, Large Class, Feature Envy, Data Clumps, Primitive Obsession, Divergent Change, Shotgun Surgery, and more. Each with detection criteria and fix patterns.

See references/code-smells.md for the full catalog with BAD/GOOD examples.

## Technical Debt Prioritization

Score = (Frequency x Blast Radius) / Effort. Prioritize highest-score items first. Includes scoring table, priority tiers (P0-P3), and a tracking template.

See references/tech-debt-prioritization.md for the full scoring system, workflow, and register template.

## Refactoring Workflow

1. Write tests if none exist. Refactoring without tests is gambling.
2. Make one change per commit. Small commits are reviewable and revertable.
3. Run tests after every change. Failing tests mean behavior changed.
4. Use IDE refactoring tools. They are less error-prone than manual edits.
5. Review the diff before committing. Automated tools sometimes surprise.
6. Explain intent in pull request descriptions. Clarify why structure changed.
