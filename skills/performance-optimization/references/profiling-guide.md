# Profiling Guide

## Browser DevTools (Chrome)

### Performance Tab

1. Open DevTools (F12) > Performance tab.
2. Click Record, perform the slow action, click Stop.
3. Look for:
   - **Long Tasks** (red bars): anything over 50ms blocks the main thread.
   - **Layout Shifts**: yellow markers indicate CLS issues.
   - **Scripting vs Rendering vs Painting**: pie chart shows where time is spent.

### Lighthouse

```bash
# CLI audit
npx lighthouse http://localhost:3000 --output=json --output-path=report.json

# Key scores to track
# Performance: > 90
# Accessibility: > 90
# Best Practices: > 90
```

Focus on:
- LCP element identified and optimized (preload, fetchpriority)
- Total Blocking Time under 200ms
- CLS under 0.1

### Memory Tab

1. Take Heap Snapshot before the action.
2. Perform the suspected leaking action.
3. Take Heap Snapshot after.
4. Use "Comparison" view to find allocated-but-not-freed objects.
5. Filter for `Detached HTMLDivElement` (DOM nodes removed from tree but referenced in JS).
6. Check "Retainers" panel to find what holds the reference.

### Network Tab

1. Enable "Disable cache" checkbox.
2. Look for waterfall gaps (sequential requests that could be parallel).
3. Check response sizes (enable "Use large request rows").
4. Filter by type: JS, CSS, Img, Font, Fetch.
5. Sort by "Time" to find slowest requests.

## Node.js Profiling

### CPU Profiling

```bash
# Start with inspector
node --inspect dist/server.js
# Open chrome://inspect in Chrome

# Generate CPU profile programmatically
node --prof dist/server.js
# Generates isolate-*.log
node --prof-process isolate-*.log > processed.txt
```

### Heap Snapshot

```bash
# Signal-based (Linux/Mac)
kill -USR2 <pid>  # Node writes .heapsnapshot to cwd

# Programmatic
node -e "
const v8 = require('v8');
const fs = require('fs');
const snapshot = v8.writeHeapSnapshot();
console.log('Heap snapshot written to', snapshot);
"
```

### Common Leak Sources

1. **Event listeners** never removed. Fix: use `AbortController`.
```typescript
const controller = new AbortController();
element.addEventListener('click', handler, { signal: controller.signal });
// Cleanup
controller.abort();
```

2. **Closures** capturing large objects. Fix: null out after use.
3. **Global caches** without eviction. Fix: use `lru-cache`.
```typescript
import { LRUCache } from 'lru-cache';
const cache = new LRUCache<string, object>({ max: 1000, ttl: 300_000 });
```

4. **Unreferenced timers**. Fix: always `clearInterval`/`clearTimeout`.

### Clinic.js (All-in-One)

```bash
npm install -g clinic
clinic doctor -- node dist/server.js
# Generates HTML report showing event loop delays, CPU, memory
```

## Database Profiling

### PostgreSQL EXPLAIN ANALYZE

```sql
-- Basic usage
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 42;

-- Look for
-- Seq Scan: full table scan, needs an index
-- Nested Loop: may indicate N+1
-- Sort: check if an index could eliminate the sort
-- Rows (estimated vs actual): big gap = stale statistics, run ANALYZE

-- Full output with buffers
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
  SELECT o.*, u.name
  FROM orders o
  JOIN users u ON u.id = o.user_id
  WHERE o.status = 'pending'
  ORDER BY o.created_at DESC
  LIMIT 20;
```

### Index Diagnosis

```sql
-- Find missing indexes (queries causing sequential scans)
SELECT schemaname, relname, seq_scan, seq_tup_read,
       idx_scan, idx_tup_fetch
FROM pg_stat_user_tables
WHERE seq_scan > 100
ORDER BY seq_tup_read DESC;

-- Find unused indexes (wasting disk and write performance)
SELECT indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey';
```

### Slow Query Log

```sql
-- PostgreSQL: enable slow query logging
ALTER SYSTEM SET log_min_duration_statement = 100;  -- Log queries > 100ms
SELECT pg_reload_conf();

-- MySQL
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 0.1;
```

### Connection Pool Monitoring

```sql
-- PostgreSQL: check active connections
SELECT count(*), state
FROM pg_stat_activity
GROUP BY state;

-- If connections are maxed out, check pool settings
-- Target: max_connections / number_of_app_instances = pool max
```

## Quick Profiling Checklist

1. [ ] Run Lighthouse, fix anything under 90
2. [ ] Check Network waterfall for sequential requests
3. [ ] Run EXPLAIN on the 5 slowest API queries
4. [ ] Take heap snapshots before/after suspected leak actions
5. [ ] Check bundle size with `npx vite-bundle-visualizer` or webpack analyzer
6. [ ] Verify cache headers on static assets (immutable for hashed files)
7. [ ] Monitor connection pool usage under load
