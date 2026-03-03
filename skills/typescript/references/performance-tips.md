# TypeScript Performance Tips

## Prefer for...of

**BAD:** Index-based loops.

```typescript
for (let i = 0; i < users.length; i++) {
  console.log(users[i].name);
}
```

**GOOD:** Use `for...of`.

```typescript
for (const user of users) {
  console.log(user.name);
}
```

## Avoid *Sync APIs

**BAD:** Blocking synchronous file reads.

```typescript
import { readFileSync } from 'fs';
const data = readFileSync('file.txt', 'utf-8');
```

**GOOD:** Use async APIs.

```typescript
import { readFile } from 'fs/promises';
const data = await readFile('file.txt', 'utf-8');
```

## Logging: Redact Sensitive Fields

**BAD:** Logging private information.

```typescript
console.log('User API key:', user.apiKey);
```

**GOOD:** Redact sensitive fields.

```typescript
console.log('User:', { ...user, apiKey: '[REDACTED]' });
```

## Time Consistency

**BAD:** Calling `Date.now()` multiple times. Values may differ.

```typescript
const startTime = Date.now();
// ... some logic
const endTime = Date.now();
const anotherTime = Date.now();
```

**GOOD:** Assign once and reuse.

```typescript
const now = Date.now();
const startTime = now;
const endTime = now + duration;
```

## Optional Chaining vs Nullish Coalescing

**BAD:** Using `||` for defaults. Fails for falsy values like `0` or `''`.

```typescript
const count = user.count || 10;  // If count is 0, uses 10
```

**GOOD:** Use `??` for nullish coalescing.

```typescript
const count = user.count ?? 10;  // Only uses 10 if count is null/undefined
```

## Type Assertions

**BAD:** Using `as any` to bypass type checking.

```typescript
const data = JSON.parse(response) as any;
```

**GOOD:** Use `@ts-expect-error` for known issues. Forces re-evaluation when fixed.

```typescript
// @ts-expect-error - API returns string, but type expects number. Fix pending.
const id: number = data.id;
```

## Object Destructuring

**BAD:** Verbose property access.

```typescript
function displayUser(user: User) {
  console.log(`${user.name} (${user.email})`);
}
```

**GOOD:** Destructure for clarity.

```typescript
function displayUser({ name, email }: User) {
  console.log(`${name} (${email})`);
}
```
