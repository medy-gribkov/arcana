---
name: typescript-advanced
description: Advanced TypeScript patterns including branded/nominal types, discriminated unions with exhaustive matching, conditional types with infer, mapped types, template literal types, module augmentation, declaration merging, satisfies operator, const assertions, variance annotations, strict library authoring, and type-level programming. Use when writing complex type utilities, designing type-safe APIs, building shared libraries, or solving type inference problems.
---

You are a senior TypeScript type-system engineer who writes zero-runtime-cost type safety and designs APIs where invalid states are unrepresentable.

## Use this skill when

- Designing branded/nominal types to prevent value confusion (e.g., UserId vs OrderId)
- Building discriminated unions with exhaustive switch/match patterns
- Writing conditional types, mapped types, or template literal types
- Authoring shared libraries that must not leak `any`
- Using `satisfies`, `const` assertions, or variance annotations
- Solving complex type inference or type-level programming challenges

## Branded and Nominal Types

TypeScript is structurally typed. Branded types add a phantom property to create nominal-like distinctions at zero runtime cost.

```typescript
declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

type UserId = Brand<string, "UserId">;
type OrderId = Brand<string, "OrderId">;

function createUserId(raw: string): UserId {
  if (!raw.startsWith("usr_")) throw new Error("Invalid user ID");
  return raw as UserId;
}

function getOrder(userId: UserId, orderId: OrderId): void {}

const uid = createUserId("usr_abc");
const oid = "ord_123" as OrderId;
// getOrder(oid, uid); // Compile error: argument types swapped
```

For numeric brands (prevent mixing pixels, milliseconds, etc.):

```typescript
type Milliseconds = Brand<number, "Milliseconds">;
type Pixels = Brand<number, "Pixels">;

function delay(ms: Milliseconds): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
// delay(500); // Error: number is not Milliseconds
delay(500 as Milliseconds); // OK — explicit at call site
```

## Discriminated Unions and Exhaustive Matching

Always use a literal `type` or `kind` field as the discriminant. Enforce exhaustive handling with `never`.

```typescript
interface LoadingState { readonly status: "loading" }
interface ErrorState { readonly status: "error"; readonly error: Error }
interface SuccessState<T> { readonly status: "success"; readonly data: T }

type AsyncState<T> = LoadingState | ErrorState | SuccessState<T>;

function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}

function render<T>(state: AsyncState<T>): string {
  switch (state.status) {
    case "loading": return "Loading...";
    case "error": return `Error: ${state.error.message}`;
    case "success": return `Data: ${JSON.stringify(state.data)}`;
    default: return assertNever(state); // Compile error if a case is missing
  }
}
```

## Conditional Types and `infer`

Use `infer` to extract types from generic positions. Think of it as pattern matching at the type level.

```typescript
// Extract the resolved type from a Promise
type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;

// Extract function return type (simplified ReturnType)
type Return<T> = T extends (...args: any[]) => infer R ? R : never;

// Extract array element type
type ElementOf<T> = T extends ReadonlyArray<infer E> ? E : never;

// Conditional distribution: filter union members
type ExtractString<T> = T extends string ? T : never;
type Result = ExtractString<string | number | boolean>; // string

// Prevent distribution with tuple wrapping
type NoDistribute<T> = [T] extends [string] ? "yes" : "no";
type Test = NoDistribute<string | number>; // "no" (evaluated as union, not distributed)
```

## Mapped Types

Transform object types property by property. Combine with key remapping (`as`) and template literals.

```typescript
// Make all properties optional and nullable
type PartialNullable<T> = { [K in keyof T]?: T[K] | null };

// Create getters from an interface
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface User { name: string; age: number }
type UserGetters = Getters<User>;
// { getName: () => string; getAge: () => number }

// Filter keys by value type
type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};
type StringProps = PickByType<User, string>; // { name: string }
```

## Template Literal Types

Build type-safe string patterns without runtime checks.

```typescript
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
type ApiVersion = "v1" | "v2";
type Endpoint = `/${ApiVersion}/${string}`;

type EventName = `${"click" | "focus" | "blur"}${"" | `.${string}`}`;
// "click" | "focus" | "blur" | "click.foo" | "focus.bar" | ...

// Parse route params from a path string
type ExtractParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractParams<Rest>
    : T extends `${string}:${infer Param}`
      ? Param
      : never;

type Params = ExtractParams<"/users/:userId/posts/:postId">;
// "userId" | "postId"
```

## `satisfies` Operator

Validates that an expression matches a type without widening it. Preserves the narrowest inferred type.

```typescript
type Route = { path: string; exact?: boolean };
type Routes = Record<string, Route>;

// BAD: annotation widens — loses literal types
const routes: Routes = { home: { path: "/", exact: true } };
routes.home.path; // string (widened)

// GOOD: satisfies validates but keeps literals
const routes2 = {
  home: { path: "/", exact: true },
  about: { path: "/about" },
} satisfies Routes;
routes2.home.path; // "/" (literal preserved)
routes2.missing; // Compile error: property doesn't exist
```

### Deep Dive: When to Use `satisfies`

**Use `satisfies` when you want:**
1. Type validation at declaration without widening
2. Autocomplete on object keys
3. Literal type preservation for better type narrowing

```typescript
// Example 1: Config with literal preservation
type Config = {
  env: "development" | "staging" | "production";
  features: Record<string, boolean>;
};

const config = {
  env: "production",
  features: { darkMode: true, beta: false },
} satisfies Config;

config.env; // "production" (literal), not string

// Example 2: Catch typos in object keys
type APIEndpoints = Record<"users" | "posts" | "comments", string>;

const endpoints = {
  users: "/api/users",
  posts: "/api/posts",
  // comments: "/api/comments", // Missing — satisfies catches this
} satisfies APIEndpoints; // Error: missing "comments"

// Example 3: Discriminated union with exhaustiveness
type Status =
  | { kind: "idle" }
  | { kind: "loading"; progress: number }
  | { kind: "error"; message: string };

const current = {
  kind: "loading",
  progress: 42,
} satisfies Status;

current.kind; // "loading" (literal), enables exhaustive switch

// Example 4: Combining with const assertion
const ROUTES = {
  home: "/",
  about: "/about",
  contact: "/contact",
} as const satisfies Record<string, string>;

type RouteKeys = keyof typeof ROUTES; // "home" | "about" | "contact"
ROUTES.home; // "/" (literal string)
```

**When NOT to use `satisfies`:**
- When you actually want widening (accepting any string, not just literals)
- When the type is already narrow enough (primitive types)
- When using with functions (use return type annotation instead)

## `const` Assertions

Freeze literal types at declaration. Pairs with `satisfies` for validated readonly data.

```typescript
const PERMISSIONS = ["read", "write", "admin"] as const;
type Permission = (typeof PERMISSIONS)[number]; // "read" | "write" | "admin"

const CONFIG = {
  retries: 3,
  timeout: 5000,
  endpoints: ["https://a.com", "https://b.com"],
} as const satisfies { retries: number; timeout: number; endpoints: readonly string[] };
// CONFIG.retries is literal 3, not number
```

## Variance Annotations (`in`, `out`)

Explicit variance on generics catches unsound assignments that structural typing misses. Use in library code.

```typescript
interface Producer<out T> { get(): T }
interface Consumer<in T> { accept(value: T): void }
interface Invariant<in out T> { transform(value: T): T }

// Producer<Dog> assignable to Producer<Animal> (covariant) — OK
// Consumer<Animal> assignable to Consumer<Dog> (contravariant) — OK
// Invariant<Dog> NOT assignable to Invariant<Animal> — correctly blocked
```

## Module Augmentation and Declaration Merging

Extend third-party types without patching source. Interfaces with the same name merge automatically.

```typescript
// Augment Express Request with custom properties
declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
    correlationId: string;
  }
}

// Augment a library's enum-like namespace
declare module "@prisma/client" {
  interface PrismaClient {
    $metrics: { prometheus(): Promise<string> };
  }
}
```

## Strict Library Authoring

When publishing types, prevent `any` leakage and ensure consumers get correct narrowing.

1. Enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` in tsconfig.
2. Never export `any`. Use `unknown` and force consumers to narrow.
3. Use `readonly` on all public array/object types.
4. Prefer `interface` for extendable shapes, `type` for closed unions.
5. Add explicit return types on all public functions — inference leaks implementation details.
6. Test types with `expectType` from `tsd` or `@ts-expect-error` assertions.

```typescript
// Type-level test: ensure an assignment fails
// @ts-expect-error — UserId should not accept raw string
const bad: UserId = "raw_string";
```

## Type-Level Programming Patterns

```typescript
// Recursive type: deep partial
type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

// Type-safe builder pattern
class QueryBuilder<Selected extends string = never> {
  select<Col extends string>(col: Col): QueryBuilder<Selected | Col> {
    return this as any; // runtime implementation
  }
  where(col: Selected, value: unknown): this { return this; }
}

new QueryBuilder()
  .select("name")
  .select("age")
  .where("name", "Alice") // OK
  // .where("email", "x")  // Error: "email" not in Selected
```
