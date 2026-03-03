# TypeScript Async Patterns

## Callbacks vs Async/Await

**BAD:** Using callbacks. Hard to read and error-prone.

```typescript
function fetchUser(id: number, callback: (user: User) => void) {
  fetch(`/api/users/${id}`)
    .then(res => res.json())
    .then(user => callback(user));
}
```

**GOOD:** Use `async`/`await`.

```typescript
async function fetchUser(id: number): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}
```

## Promise.all for Concurrency

**BAD:** Sequential awaits. Slow when requests are independent.

```typescript
const user = await fetchUser(1);
const posts = await fetchPosts(1);
const comments = await fetchComments(1);
```

**GOOD:** Parallel requests with `Promise.all`.

```typescript
const [user, posts, comments] = await Promise.all([
  fetchUser(1),
  fetchPosts(1),
  fetchComments(1),
]);
```

## Error Handling

**BAD:** Unhandled promise rejection.

```typescript
async function loadData() {
  const data = await fetch('/api/data');
  return data.json();
}
```

**GOOD:** Wrap in try/catch.

```typescript
async function loadData() {
  try {
    const data = await fetch('/api/data');
    return data.json();
  } catch (error) {
    console.error('Failed to load data:', error);
    throw error;
  }
}
```

## Promise.allSettled for Partial Failures

When some promises failing should not abort the rest:

```typescript
const results = await Promise.allSettled([
  fetchUser(1),
  fetchUser(2),
  fetchUser(3),
]);

const succeeded = results
  .filter((r): r is PromiseFulfilledResult<User> => r.status === 'fulfilled')
  .map(r => r.value);

const failed = results
  .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
  .map(r => r.reason);
```

## Async Iteration

```typescript
async function* fetchPages(baseUrl: string) {
  let page = 1;
  while (true) {
    const res = await fetch(`${baseUrl}?page=${page}`);
    const data = await res.json();
    if (data.items.length === 0) break;
    yield data.items;
    page++;
  }
}

for await (const items of fetchPages('/api/products')) {
  processItems(items);
}
```

## Timeout Wrapper

```typescript
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

const user = await withTimeout(fetchUser(1), 5000);
```
