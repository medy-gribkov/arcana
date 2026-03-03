---
name: performance-optimization
description: Web and backend performance optimization including Core Web Vitals (LCP, FID, INP, CLS), bundle analysis with webpack-bundle-analyzer, code splitting, lazy loading, image optimization (WebP, AVIF, responsive srcset), caching strategies (HTTP Cache-Control, CDN, Redis, application-level), database query optimization (indexing, EXPLAIN ANALYZE, N+1), memory leak detection with Chrome DevTools and Node --inspect, connection pooling, and async processing patterns. Use when diagnosing slow pages, reducing bundle size, optimizing API response times, or fixing memory leaks.
---

Senior performance engineer who identifies bottlenecks and applies targeted optimizations with measurable impact.

## Use this skill when

- Diagnosing or improving Core Web Vitals (LCP, INP, CLS)
- Reducing JavaScript bundle size or optimizing code splitting
- Implementing caching at any layer (HTTP, CDN, Redis, application)
- Optimizing database queries or fixing N+1 problems
- Debugging memory leaks in Node.js or browser
- Designing async processing pipelines for throughput

## Core Web Vitals

### LCP (Largest Contentful Paint) — Target: < 2.5s

LCP measures when the largest visible element finishes rendering. Usually a hero image, video, or large text block.

**Common fixes:**
1. Preload the LCP resource: `<link rel="preload" as="image" href="/hero.webp">`
2. Inline critical CSS, defer the rest. Use `critters` for automated critical CSS extraction.
3. Set `fetchpriority="high"` on the LCP image. Remove `loading="lazy"` from above-the-fold images.
4. Serve from CDN. Eliminate redirect chains.
5. Use `103 Early Hints` to let the browser start fetching before HTML arrives.

```html
<!-- Optimal LCP image -->
<img
  src="/hero.webp"
  srcset="/hero-480.webp 480w, /hero-800.webp 800w, /hero-1200.webp 1200w"
  sizes="(max-width: 600px) 480px, (max-width: 1024px) 800px, 1200px"
  width="1200"
  height="630"
  alt="Hero image"
  fetchpriority="high"
  decoding="async"
/>
```

### INP (Interaction to Next Paint) — Target: < 200ms

INP replaced FID in March 2024. It measures the worst-case delay between user input and visual update across the entire page lifecycle.

**Common fixes:**
1. Break long tasks (>50ms) with `scheduler.yield()` or `setTimeout(0)`.
2. Move heavy computation to Web Workers.
3. Debounce rapid-fire events (scroll, resize, input) — 100-150ms debounce.
4. Avoid layout thrashing: batch DOM reads, then batch DOM writes.
5. Use `content-visibility: auto` on offscreen sections.

```typescript
// Break a long task into yielding chunks
async function processItems(items: Item[]) {
  for (let i = 0; i < items.length; i++) {
    processItem(items[i]);
    if (i % 50 === 0) {
      // Yield to main thread every 50 items
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}
```

### CLS (Cumulative Layout Shift) — Target: < 0.1

**Common fixes:**
1. Always set explicit `width` and `height` on images and videos (browser calculates aspect ratio).
2. Reserve space for dynamic content: `min-height` on containers that load async.
3. Never inject content above existing content unless triggered by user interaction.
4. Use `font-display: optional` or preload fonts to prevent FOIT/FOUT shifts.
5. Use CSS `aspect-ratio` for responsive embeds: `aspect-ratio: 16 / 9`.

## Bundle Analysis and Code Splitting

### Analyze First

```bash
# Next.js — built-in analyzer
ANALYZE=true next build

# Webpack
npx webpack-bundle-analyzer dist/stats.json

# Vite
npx vite-bundle-visualizer
```

Look for: duplicate dependencies, moment.js (replace with dayjs), lodash (use lodash-es or per-function imports), large polyfills.

### Code Splitting Patterns

```typescript
// Route-based splitting (React)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Settings = lazy(() => import("./pages/Settings"));

// Component-level splitting for heavy UI
const HeavyChart = lazy(() => import("./components/HeavyChart"));

function App() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}

// Prefetch on hover for perceived instant loading
function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const prefetch = () => {
    if (to === "/dashboard") import("./pages/Dashboard");
  };
  return <Link to={to} onMouseEnter={prefetch}>{children}</Link>;
}
```

### Tree Shaking Essentials

- Use ESM (`import/export`), not CJS (`require`). CJS is not tree-shakeable.
- Set `"sideEffects": false` in package.json (or list files with side effects).
- Avoid barrel files (`index.ts` re-exporting everything) — they defeat tree shaking.

## Image Optimization

### Format Selection

| Format | Use for | Browser support |
|--------|---------|-----------------|
| AVIF | Photos, complex images. 50% smaller than JPEG. | Chrome, Firefox, Safari 16.4+ |
| WebP | Universal fallback. 30% smaller than JPEG. | All modern browsers |
| SVG | Icons, logos, simple graphics. Infinite scale. | Universal |
| PNG | Screenshots with text, transparency needed. | Universal |

### Next.js Image Component

```tsx
import Image from "next/image";

// Automatically serves AVIF > WebP > JPEG, responsive sizes, lazy loaded
<Image
  src="/product.jpg"
  width={800}
  height={600}
  alt="Product photo"
  sizes="(max-width: 768px) 100vw, 50vw"
  priority={isAboveFold} // Sets fetchpriority="high", disables lazy load
/>
```

### Sharp for Server-Side Processing

```typescript
import sharp from "sharp";

await sharp(inputBuffer)
  .resize(1200, 630, { fit: "cover", position: "attention" }) // Smart crop
  .avif({ quality: 50 }) // AVIF at quality 50 ≈ JPEG at quality 80
  .toFile("output.avif");
```

## Caching Strategies

### HTTP Cache-Control Headers

```
# Static assets (hashed filenames): cache forever
Cache-Control: public, max-age=31536000, immutable

# API responses: revalidate after 60s, serve stale while revalidating
Cache-Control: public, max-age=60, stale-while-revalidate=300

# User-specific data: no shared cache
Cache-Control: private, max-age=0, must-revalidate

# Never cache
Cache-Control: no-store
```

### Redis Caching Patterns

```typescript
async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as T;

  const data = await fetcher();
  // SET with EX (expire) and NX (only if not exists) to prevent thundering herd
  await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
  return data;
}

// Cache-aside with stale-while-revalidate pattern
async function getWithSWR<T>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
  const cached = await redis.get(key);
  if (cached) {
    const parsed = JSON.parse(cached) as { data: T; fetchedAt: number };
    const age = Date.now() - parsed.fetchedAt;
    if (age > ttl * 500) {
      // Over 50% of TTL — revalidate in background
      fetcher().then((fresh) =>
        redis.set(key, JSON.stringify({ data: fresh, fetchedAt: Date.now() }), "EX", ttl)
      );
    }
    return parsed.data;
  }
  const data = await fetcher();
  await redis.set(key, JSON.stringify({ data, fetchedAt: Date.now() }), "EX", ttl);
  return data;
}
```

## Database Query Optimization

### Index Strategy

1. Run `EXPLAIN ANALYZE` on every slow query. Look for `Seq Scan` on large tables.
2. Index columns used in `WHERE`, `JOIN`, `ORDER BY`. Composite indexes: leftmost prefix matters.
3. Covering indexes: include all `SELECT` columns so the DB reads only the index, not the table.

```sql
-- Composite index: supports WHERE user_id = ? AND created_at > ?
CREATE INDEX idx_orders_user_created ON orders (user_id, created_at DESC);

-- Covering index: query satisfied entirely from index
CREATE INDEX idx_orders_covering ON orders (user_id, created_at DESC)
  INCLUDE (total_amount, status);

-- Partial index: only index rows that matter
CREATE INDEX idx_orders_pending ON orders (created_at)
  WHERE status = 'pending';
```

### N+1 Detection and Fix

```typescript
// BAD: N+1 — 1 query for users + N queries for orders
const users = await db.query("SELECT * FROM users LIMIT 100");
for (const user of users) {
  user.orders = await db.query("SELECT * FROM orders WHERE user_id = $1", [user.id]);
}

// GOOD: 2 queries total with a join or IN clause
const users = await db.query("SELECT * FROM users LIMIT 100");
const userIds = users.map((u) => u.id);
const orders = await db.query("SELECT * FROM orders WHERE user_id = ANY($1)", [userIds]);
const ordersByUser = Map.groupBy(orders, (o) => o.user_id);
for (const user of users) {
  user.orders = ordersByUser.get(user.id) ?? [];
}
```

## Memory Leak Detection

### Node.js

```bash
# Start with inspector
node --inspect dist/server.js

# Generate heap snapshot programmatically
kill -USR2 <pid>  # Node writes .heapsnapshot to cwd
```

Common Node.js leak sources:
1. **Event listeners** never removed. Use `AbortController` to clean up.
2. **Closures** capturing large objects. Null out references after use.
3. **Global caches** without eviction. Use `lru-cache` with `max` and `ttl`.
4. **Unreferenced timers**. Always `clearInterval`/`clearTimeout` on shutdown.

```typescript
import { LRUCache } from "lru-cache";

// Bounded cache: max 1000 entries, 5-minute TTL
const cache = new LRUCache<string, object>({
  max: 1000,
  ttl: 1000 * 60 * 5,
});
```

### Browser (Chrome DevTools)

1. Open Memory tab. Take a heap snapshot (Snapshot 1).
2. Perform the suspected leaking action (navigate, open modal, etc.).
3. Take Snapshot 2. Use "Comparison" view to see allocated-but-not-freed objects.
4. Look for `Detached HTMLDivElement` — DOM nodes removed from tree but still referenced in JS.
5. Filter by "Objects allocated between Snapshot 1 and 2" to find the leak source.

## Connection Pooling

```go
// Go database/sql — pool is built in
db, err := sql.Open("postgres", connStr)
db.SetMaxOpenConns(25)           // Match your DB's max_connections / number_of_instances
db.SetMaxIdleConns(10)           // Keep idle connections warm
db.SetConnMaxLifetime(5 * time.Minute)  // Rotate connections to rebalance after DB failover
db.SetConnMaxIdleTime(1 * time.Minute)  // Close idle connections to free DB resources
```

```typescript
// Node.js with pg pool
import { Pool } from "pg";

const pool = new Pool({
  max: 20,                    // Max connections in pool
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail fast if no connection available
});

// Always release connections — use pool.query() for auto-release
const result = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
```

## Async Processing Patterns

When an API handler does work that isn't needed for the response, move it out of the request path.

```typescript
// BAD: user waits for email sending + analytics
app.post("/signup", async (req, res) => {
  const user = await createUser(req.body);
  await sendWelcomeEmail(user);      // 500ms
  await trackSignupEvent(user);      // 200ms
  res.json(user);                    // Total: 700ms+ for user
});

// GOOD: respond immediately, process async via queue
app.post("/signup", async (req, res) => {
  const user = await createUser(req.body);
  await queue.add("send-welcome-email", { userId: user.id });
  await queue.add("track-signup", { userId: user.id });
  res.json(user);                    // Total: ~50ms for user
});
```

Use BullMQ (Node.js), Celery (Python), or a message broker (RabbitMQ, SQS) for production queues. Always make queue consumers idempotent — jobs may be retried.
