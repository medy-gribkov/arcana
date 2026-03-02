---
name: postgres-advanced
description: Advanced PostgreSQL patterns including window functions, CTEs, JSONB operations, full-text search, partitioning, and performance optimization with EXPLAIN ANALYZE
user-invokable: true
---

# Advanced PostgreSQL Operations

Expert-level PostgreSQL patterns for production systems: analytical queries, JSON handling, search optimization, and performance tuning.

## Window Functions

Perform calculations across row sets without collapsing results.

**BAD: Self-join for ranking**
```sql
-- Inefficient, creates cartesian product
SELECT e1.name, e1.salary, COUNT(e2.salary) as rank
FROM employees e1
LEFT JOIN employees e2 ON e1.salary <= e2.salary
GROUP BY e1.name, e1.salary;
```

**GOOD: ROW_NUMBER and RANK**
```sql
-- Efficient window function
SELECT
  name,
  salary,
  department,
  ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) as row_num,
  RANK() OVER (PARTITION BY department ORDER BY salary DESC) as rank,
  DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC) as dense_rank
FROM employees;
```

**BAD: Subquery for previous value**
```sql
-- Poor performance, scalar subquery per row
SELECT
  date,
  revenue,
  (SELECT revenue FROM sales s2
   WHERE s2.date < s1.date
   ORDER BY date DESC LIMIT 1) as prev_revenue
FROM sales s1;
```

**GOOD: LAG/LEAD for row comparison**
```sql
-- Single scan with window function
SELECT
  date,
  revenue,
  LAG(revenue, 1) OVER (ORDER BY date) as prev_revenue,
  LEAD(revenue, 1) OVER (ORDER BY date) as next_revenue,
  revenue - LAG(revenue, 1) OVER (ORDER BY date) as revenue_change
FROM sales;
```

**Running totals and moving averages**
```sql
-- Cumulative sum and 7-day moving average
SELECT
  date,
  amount,
  SUM(amount) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as running_total,
  AVG(amount) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as moving_avg_7d,
  FIRST_VALUE(amount) OVER (ORDER BY date) as first_amount,
  LAST_VALUE(amount) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as last_amount
FROM transactions;
```

## Common Table Expressions (CTEs)

**BAD: Nested subqueries**
```sql
-- Unreadable, hard to maintain
SELECT * FROM (
  SELECT * FROM (
    SELECT user_id, COUNT(*) as cnt
    FROM orders
    GROUP BY user_id
  ) t1 WHERE cnt > 5
) t2 JOIN users ON t2.user_id = users.id;
```

**GOOD: Named CTEs**
```sql
-- Clear, reusable, optimized by planner
WITH high_value_users AS (
  SELECT user_id, COUNT(*) as order_count
  FROM orders
  WHERE total > 100
  GROUP BY user_id
  HAVING COUNT(*) > 5
),
user_details AS (
  SELECT u.id, u.name, u.email, hvu.order_count
  FROM users u
  JOIN high_value_users hvu ON u.id = hvu.user_id
)
SELECT * FROM user_details WHERE order_count > 10;
```

**BAD: Unbounded recursive CTE**
```sql
-- Risk of infinite loop
WITH RECURSIVE tree AS (
  SELECT id, parent_id, name FROM categories WHERE id = 1
  UNION ALL
  SELECT c.id, c.parent_id, c.name
  FROM categories c JOIN tree t ON c.parent_id = t.id
)
SELECT * FROM tree;
```

**GOOD: Recursive CTE with depth limit**
```sql
-- Safe recursion with cycle detection
WITH RECURSIVE category_tree AS (
  SELECT id, parent_id, name, 1 as depth, ARRAY[id] as path
  FROM categories WHERE parent_id IS NULL
  UNION ALL
  SELECT c.id, c.parent_id, c.name, ct.depth + 1, ct.path || c.id
  FROM categories c
  JOIN category_tree ct ON c.parent_id = ct.id
  WHERE ct.depth < 10 AND NOT c.id = ANY(ct.path)
)
SELECT * FROM category_tree ORDER BY path;
```

## JSONB Operations

**BAD: No index on JSON queries**
```sql
-- Table scan on every query
SELECT * FROM products
WHERE metadata->>'brand' = 'Acme';
```

**GOOD: GIN index on JSONB**
```sql
-- Create GIN index for fast JSON queries
CREATE INDEX idx_products_metadata ON products USING GIN (metadata);

-- Containment operator (uses index)
SELECT * FROM products
WHERE metadata @> '{"brand": "Acme"}';

-- Path queries with index
SELECT * FROM products
WHERE metadata->>'brand' = 'Acme'
  AND metadata->'specs'->>'color' = 'red';
```

**JSONB manipulation and aggregation**
```sql
-- Update nested JSON
UPDATE products
SET metadata = jsonb_set(
  metadata,
  '{specs,color}',
  '"blue"'
)
WHERE id = 123;

-- Aggregate into JSONB
SELECT
  category,
  jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', name,
      'price', price
    )
  ) as products
FROM products
GROUP BY category;

-- Extract and transform
SELECT
  id,
  metadata->>'brand' as brand,
  (metadata->'specs'->'dimensions'->>'height')::numeric as height,
  jsonb_array_elements_text(metadata->'tags') as tag
FROM products;
```

## Full-Text Search

**BAD: LIKE pattern matching**
```sql
-- Cannot use indexes efficiently
SELECT * FROM articles
WHERE content LIKE '%postgresql%'
  OR title LIKE '%postgresql%';
```

**GOOD: tsvector with GIN index**
```sql
-- Create tsvector column
ALTER TABLE articles
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(content, '')), 'B')
) STORED;

-- Create GIN index
CREATE INDEX idx_articles_search ON articles USING GIN (search_vector);

-- Fast full-text search with ranking
SELECT
  id,
  title,
  ts_rank(search_vector, query) as rank
FROM articles,
  websearch_to_tsquery('english', 'postgresql performance') as query
WHERE search_vector @@ query
ORDER BY rank DESC
LIMIT 20;

-- Highlight search terms
SELECT
  ts_headline(
    'english',
    content,
    websearch_to_tsquery('english', 'postgresql performance'),
    'MaxWords=50, MinWords=25'
  ) as snippet
FROM articles
WHERE search_vector @@ websearch_to_tsquery('english', 'postgresql performance');
```

## Performance Optimization

**BAD: SELECT * in production**
```sql
-- Fetches unnecessary data, prevents covering indexes
SELECT * FROM orders WHERE status = 'pending';
```

**GOOD: Specific columns with covering index**
```sql
-- Covering index (index-only scan)
CREATE INDEX idx_orders_status_covering
ON orders (status)
INCLUDE (id, created_at, total);

SELECT id, created_at, total
FROM orders
WHERE status = 'pending';
```

**Partial indexes for common queries**
```sql
-- Index only active records
CREATE INDEX idx_users_active_email
ON users (email)
WHERE deleted_at IS NULL;

-- Index only recent orders
CREATE INDEX idx_orders_recent
ON orders (created_at DESC)
WHERE created_at > NOW() - INTERVAL '90 days';
```

**EXPLAIN ANALYZE interpretation**
```sql
-- Get actual execution plan
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT u.name, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at > '2024-01-01'
GROUP BY u.id, u.name
HAVING COUNT(o.id) > 5;

-- Look for:
-- 1. Sequential Scans on large tables → add indexes
-- 2. High "Rows Removed by Filter" → tighten WHERE clause
-- 3. Nested Loop on large datasets → check join conditions
-- 4. High "Buffers: shared hit" vs "read" → cache hit ratio
```

## Table Partitioning

```sql
-- Range partitioning by date
CREATE TABLE events (
  id BIGSERIAL,
  event_type VARCHAR(50),
  data JSONB,
  created_at TIMESTAMP NOT NULL
) PARTITION BY RANGE (created_at);

-- Create partitions
CREATE TABLE events_2024_q1
PARTITION OF events
FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

CREATE TABLE events_2024_q2
PARTITION OF events
FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');

-- Create default partition
CREATE TABLE events_default
PARTITION OF events DEFAULT;

-- Indexes on partitions
CREATE INDEX idx_events_2024_q1_type
ON events_2024_q1 (event_type);

-- Partition pruning (automatic with PG 11+)
EXPLAIN SELECT * FROM events
WHERE created_at BETWEEN '2024-02-01' AND '2024-02-28';
-- Only scans events_2024_q1 partition
```

## Advanced Features

**Advisory locks for coordination**
```sql
-- Prevent concurrent execution of job
SELECT pg_advisory_lock(12345);

-- Process data...
UPDATE jobs SET status = 'processing' WHERE id = 100;

-- Release lock
SELECT pg_advisory_unlock(12345);

-- Try lock (non-blocking)
DO $$
BEGIN
  IF pg_try_advisory_lock(12345) THEN
    -- Got lock, do work
    RAISE NOTICE 'Processing job';
    PERFORM pg_advisory_unlock(12345);
  ELSE
    RAISE NOTICE 'Job already running';
  END IF;
END $$;
```

**Connection pooling with PgBouncer**
```ini
# pgbouncer.ini
[databases]
mydb = host=localhost dbname=mydb

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
reserve_pool_size = 5
reserve_pool_timeout = 3
```

**Logical replication for zero-downtime migrations**
```sql
-- On source database
CREATE PUBLICATION my_publication
FOR TABLE users, orders;

-- On target database
CREATE SUBSCRIPTION my_subscription
CONNECTION 'host=source-db port=5432 dbname=mydb'
PUBLICATION my_publication;

-- Monitor replication lag
SELECT
  slot_name,
  active,
  pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) as lag
FROM pg_replication_slots;
```

## Workflow

1. **Design queries**: Start with CTEs for readability, use window functions for analytics
2. **Add indexes**: GIN for JSONB/tsvector, partial indexes for filtered queries, covering indexes for hot paths
3. **Analyze performance**: Run EXPLAIN ANALYZE, check for sequential scans and high buffer reads
4. **Optimize schema**: Consider partitioning for large time-series tables, use JSONB for flexible schemas
5. **Monitor production**: Track query execution time, connection pool utilization, replication lag

Use window functions for row-based calculations, CTEs for complex queries, JSONB indexes for JSON searches, and tsvector for full-text search. Always EXPLAIN ANALYZE before deploying performance-critical queries.
