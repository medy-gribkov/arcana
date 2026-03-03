---
name: typescript
description: TypeScript patterns covering strict types, generics constraints, utility types (Pick, Omit, Record, Extract), discriminated unions, async patterns, and common mistakes with BAD/GOOD comparisons.
---

## Types and Type Safety

**BAD:** Using `any` defeats the type system.

```typescript
function processData(data: any) {
  return data.value.toUpperCase();
}
```

**GOOD:** Define explicit types or use generics.

```typescript
interface DataWithValue {
  value: string;
}

function processData(data: DataWithValue): string {
  return data.value.toUpperCase();
}
```

### When TypeScript Can Infer

**BAD:** Redundant type annotations.

```typescript
const count: number = 42;
const name: string = 'Alice';
```

**GOOD:** Let TypeScript infer.

```typescript
const count = 42;       // inferred as number
const name = 'Alice';   // inferred as string
```

### Record vs Object

**BAD:** Using `object` or `{}`. These allow any object.

**GOOD:** Use `Record<PropertyKey, unknown>` for arbitrary objects.

```typescript
function logData(data: Record<PropertyKey, unknown>) {
  console.log(data);
}
```

## Interfaces vs Types

**GOOD:** Use `interface` for object shapes. Use `type` for unions, intersections, and primitives.

```typescript
// Object shapes: interface
interface User {
  id: number;
  name: string;
}

// Unions: type
type Status = 'pending' | 'approved' | 'rejected';

// Intersections: type
type AdminUser = User & { role: 'admin' };
```

## Generics Constraints

**BAD:** Unconstrained generics allow any type.

```typescript
function getProperty<T>(obj: T, key: string) {
  return obj[key];  // Error: key is not guaranteed to exist on T
}
```

**GOOD:** Constrain generics with `extends`.

```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { id: 1, name: 'Alice' };
const name = getProperty(user, 'name');  // Type: string
```

### Multiple Constraints

```typescript
function findById<T extends Identifiable & Named>(
  items: T[],
  id: number
): T | undefined {
  return items.find(item => item.id === id);
}
```

### Default Generic Types

```typescript
function createArray<T = string>(length: number, value: T): T[] {
  return Array(length).fill(value);
}
```

## Utility Types

Pick, Omit, Partial, Required, Record, Extract, Exclude, ReturnType. Full reference with BAD/GOOD pairs for each.

See references/utility-types.md for the complete utility types reference.

## Discriminated Unions

**BAD:** Unions without discriminator. TypeScript cannot narrow types.

```typescript
type Result = { data: string } | { error: Error };
```

**GOOD:** Add a discriminator property.

```typescript
type Success = { status: 'success'; data: string };
type Failure = { status: 'error'; error: Error };
type Result = Success | Failure;

function handleResult(result: Result) {
  if (result.status === 'success') {
    console.log(result.data);  // TypeScript knows this is Success
  } else {
    console.error(result.error);  // TypeScript knows this is Failure
  }
}
```

### Exhaustive Checks

```typescript
function handleStatus(status: Status): string {
  switch (status) {
    case 'pending': return 'Awaiting review';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    default:
      const _exhaustive: never = status;  // Error if a case is missing
      throw new Error(`Unhandled status: ${_exhaustive}`);
  }
}
```

## Async Patterns

async/await, Promise.all for concurrency, error handling with try/catch, Promise.allSettled for partial failures, timeout wrappers.

See references/async-patterns.md for full patterns with BAD/GOOD examples.

## Common Mistakes

### Magic Values

**BAD:** Hardcoded strings and numbers.

**GOOD:** Use named constants.

```typescript
const USER_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;
```

### Type Assertions

**BAD:** Using `as any` to bypass type checking.

**GOOD:** Use `@ts-expect-error` for known issues. Forces re-evaluation when fixed.

## Performance

Prefer `for...of` over index loops, async APIs over `*Sync` variants, `??` over `||` for defaults, destructuring for clarity.

See references/performance-tips.md for the complete set of performance patterns.
