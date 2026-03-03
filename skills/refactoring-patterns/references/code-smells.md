# Code Smells Catalog

## Long Method

**Smell:** Method exceeds 20-30 lines.

**Fix:** Extract methods for logical blocks.

## Large Class

**Smell:** Class exceeds 200-300 lines or has multiple responsibilities.

**Fix:** Extract classes for cohesive groups of fields and methods.

## Feature Envy

**Smell:** A method uses another class's data more than its own.

**BEFORE:**

```typescript
class Report {
  generateSummary(user: User): string {
    return `${user.name} has ${user.orders.length} orders totaling $${user.getTotalSpent()}`;
  }
}
```

**AFTER:**

```typescript
class User {
  getSummary(): string {
    return `${this.name} has ${this.orders.length} orders totaling $${this.getTotalSpent()}`;
  }
}
```

## Data Clumps

**Smell:** Groups of variables appear together repeatedly.

**BEFORE:**

```typescript
function createUser(name: string, street: string, city: string, zipCode: string) {
  // ...
}

function updateUser(id: number, name: string, street: string, city: string, zipCode: string) {
  // ...
}
```

**AFTER:**

```typescript
interface Address {
  street: string;
  city: string;
  zipCode: string;
}

function createUser(name: string, address: Address) {
  // ...
}

function updateUser(id: number, name: string, address: Address) {
  // ...
}
```

## Primitive Obsession

**Smell:** Using strings or numbers where a domain type is clearer.

**BEFORE:**

```typescript
function sendEmail(email: string) {
  if (!email.includes('@')) {
    throw new Error('Invalid email');
  }
  // ...
}
```

**AFTER:**

```typescript
class Email {
  constructor(private value: string) {
    if (!value.includes('@')) {
      throw new Error('Invalid email');
    }
  }

  toString(): string {
    return this.value;
  }
}

function sendEmail(email: Email) {
  // Email is guaranteed valid
}
```

## Divergent Change

**Smell:** One class is frequently changed for multiple unrelated reasons.

**Fix:** Split into classes that each change for one reason only.

## Shotgun Surgery

**Smell:** A single change requires edits across many files.

**Fix:** Move related code into one module. If changing "how emails are sent" touches 10 files, consolidate email logic.

## Message Chains

**Smell:** `order.getCustomer().getAddress().getCity()` chains through multiple objects.

**Fix:** Add a direct method: `order.getShippingCity()`. Hide the internal structure.

## Speculative Generality

**Smell:** Interfaces with one implementation, abstract classes never subclassed, parameters never used.

**Fix:** Delete it. YAGNI. Add abstraction when the second use case actually arrives.
