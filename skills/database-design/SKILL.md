---
name: database-design
description: Database architecture and query optimization for PostgreSQL and SQLite. Covers schema design, normalization to 3NF, denormalization trade-offs, indexing strategy (B-tree, GIN, partial, covering indexes), EXPLAIN ANALYZE interpretation, migrations with up/down patterns, connection pooling, ORM configuration (Prisma, Drizzle, SQLAlchemy), transactions, isolation levels, and anti-patterns like N+1 queries, missing indexes, and over-normalization. Use when designing schemas, optimizing queries, writing migrations, or debugging database performance.
---

You are a senior database architect who designs schemas that scale and writes queries that stay fast under load.

## Use this skill when

- Designing a new database schema or modifying an existing one
- Optimizing slow queries using EXPLAIN ANALYZE
- Creating or reviewing database migrations
- Choosing between normalization and denormalization
- Setting up connection pooling or ORM configuration
- Debugging N+1 queries, deadlocks, or performance issues
- Deciding between PostgreSQL and SQLite for a project

## Schema Design Principles

### Normalization to 3NF

**1NF**: Every column holds atomic values. No arrays, no comma-separated lists.
**2NF**: Every non-key column depends on the entire primary key (relevant for composite keys).
**3NF**: No transitive dependencies. If A -> B -> C, then C should be in B's table, not A's.

```sql
-- Bad: transitive dependency (city -> state)
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT,
    state TEXT    -- determined by city, not by customer
);

-- Good: normalize to 3NF
CREATE TABLE cities (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    UNIQUE (name, state)
);
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    city_id INT REFERENCES cities(id)
);
```

### When to Denormalize

Denormalize when:
- Read:write ratio exceeds 100:1 and JOINs are the bottleneck
- Reporting queries scan millions of rows across 5+ tables
- You need sub-millisecond reads (caching at DB level)

Patterns:
- **Materialized views**: precomputed JOINs, refreshed on schedule
- **Computed columns**: store `full_name` alongside `first_name` + `last_name`
- **Counter caches**: store `comment_count` on posts, update via trigger

```sql
-- Materialized view for dashboard stats
CREATE MATERIALIZED VIEW order_stats AS
SELECT
    date_trunc('day', created_at) AS day,
    COUNT(*) AS order_count,
    SUM(total) AS revenue
FROM orders
GROUP BY 1;

-- Refresh on schedule (or after batch inserts)
REFRESH MATERIALIZED VIEW CONCURRENTLY order_stats;
```

`CONCURRENTLY` requires a unique index on the view. Without it, reads are blocked during refresh.

## Indexing Strategy

### B-tree (default, 90% of cases)
```sql
-- Single column: equality and range queries
CREATE INDEX idx_users_email ON users (email);

-- Composite: leftmost prefix rule applies
CREATE INDEX idx_orders_user_date ON orders (user_id, created_at DESC);
-- This index serves: WHERE user_id = X, WHERE user_id = X AND created_at > Y
-- It does NOT serve: WHERE created_at > Y (without user_id)

-- Covering index: includes columns to avoid table lookup
CREATE INDEX idx_orders_covering ON orders (user_id, created_at DESC)
    INCLUDE (total, status);
-- Now: SELECT total, status FROM orders WHERE user_id = 1 ORDER BY created_at DESC
-- is an index-only scan. No heap fetch.
```

### Partial Index (filter out noise)
```sql
-- Only index active users (skip 80% of rows)
CREATE INDEX idx_users_active_email ON users (email) WHERE is_active = true;

-- Only index unprocessed jobs
CREATE INDEX idx_jobs_pending ON jobs (created_at) WHERE status = 'pending';

-- Example: Query using the partial index
SELECT * FROM users WHERE email = 'user@example.com' AND is_active = true;
-- Uses idx_users_active_email (fast, small index)

SELECT * FROM users WHERE email = 'user@example.com' AND is_active = false;
-- Cannot use partial index, falls back to seq scan or full email index
```

Partial indexes are smaller, faster, and should be your first optimization before adding hardware.

### GIN Index (PostgreSQL full-text, JSONB, arrays)
```sql
-- JSONB containment queries
CREATE INDEX idx_products_tags ON products USING GIN (tags);
-- SELECT * FROM products WHERE tags @> '["electronics"]';

-- Full-text search
CREATE INDEX idx_articles_search ON articles USING GIN (to_tsvector('english', title || ' ' || body));
-- SELECT * FROM articles WHERE to_tsvector('english', title || ' ' || body) @@ to_tsquery('database & design');
```

### SQLite Indexing
SQLite uses B-tree exclusively. Same composite index rules apply. Key difference: SQLite has no concurrent index creation -- `CREATE INDEX` locks the entire database.

```sql
-- SQLite: use WITHOUT ROWID for narrow lookup tables
CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
) WITHOUT ROWID;
```

## EXPLAIN ANALYZE: Reading Query Plans

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT u.name, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.created_at > '2025-01-01'
GROUP BY u.id;
```

What to look for:
- **Seq Scan on large tables**: Add an index. If the table has <1000 rows, Seq Scan is fine.
- **Nested Loop with inner Seq Scan**: The inner table needs an index on the join column.
- **Hash Join**: Normal for large table joins. Worry if `Batches > 1` (means spilling to disk -- increase `work_mem`).
- **Sort with `external merge`**: Sort is spilling to disk. Add an index that matches the ORDER BY, or increase `work_mem`.
- **Rows: estimated vs actual**: If wildly off (10x+), run `ANALYZE tablename` to update statistics.
- **Buffers: shared hit vs read**: `read` means disk I/O. If `read >> hit`, your working set exceeds `shared_buffers`.

## Migrations

### Up/Down Pattern
```sql
-- 001_create_users.up.sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 001_create_users.down.sql
DROP TABLE users;
```

### Safe Migration Rules (zero-downtime)
1. **Never rename a column directly**. Add new, backfill, deploy code that reads both, drop old.
2. **Never add NOT NULL without a default**. Existing rows will fail. Add column nullable, backfill, then set NOT NULL.
3. **Never drop a column that's still read by running code**. Deploy code that stops reading it first.
4. **Create indexes concurrently** in PostgreSQL:
```sql
CREATE INDEX CONCURRENTLY idx_users_email ON users (email);
-- This does NOT lock the table. Regular CREATE INDEX does.
```
5. **Wrap DDL in transactions** (PostgreSQL supports transactional DDL, MySQL does NOT).

Tools: golang-migrate, Prisma Migrate, Drizzle Kit, Alembic (Python).

## GORM (Go ORM)

```go
// Define models with tags
type User struct {
    ID        uint      `gorm:"primaryKey"`
    Email     string    `gorm:"uniqueIndex;not null"`
    Name      string    `gorm:"size:100;not null"`
    Orders    []Order   `gorm:"foreignKey:UserID"`
    CreatedAt time.Time `gorm:"autoCreateTime"`
    UpdatedAt time.Time `gorm:"autoUpdateTime"`
}

type Order struct {
    ID        uint      `gorm:"primaryKey"`
    UserID    uint      `gorm:"index;not null"`
    Total     float64   `gorm:"type:decimal(10,2);not null"`
    Status    string    `gorm:"type:varchar(20);default:'pending'"`
    CreatedAt time.Time `gorm:"autoCreateTime"`
}

// Auto-migrate (development only, use migrations in production)
db.AutoMigrate(&User{}, &Order{})

// Queries with preloading (avoid N+1)
var users []User
db.Preload("Orders").Where("email LIKE ?", "%@example.com").Find(&users)

// Raw SQL for complex queries
var results []struct {
    Name       string
    OrderCount int64
}
db.Raw(`
    SELECT users.name, COUNT(orders.id) as order_count
    FROM users
    LEFT JOIN orders ON orders.user_id = users.id
    GROUP BY users.id
`).Scan(&results)

// Transactions
err := db.Transaction(func(tx *gorm.DB) error {
    if err := tx.Create(&user).Error; err != nil {
        return err
    }
    if err := tx.Create(&order).Error; err != nil {
        return err
    }
    return nil
})
```

**GORM best practices:**
- Use `gorm:"index"` on all foreign keys (GORM doesn't auto-index FKs).
- Use `Preload()` or `Joins()` to avoid N+1 queries.
- Never use `AutoMigrate` in production. Generate SQL and review before running.
- Use `db.Raw()` for complex queries GORM can't express efficiently.
- Add `gorm:"-"` to fields that shouldn't be persisted.

Tools: golang-migrate, Prisma Migrate, Drizzle Kit, Alembic (Python).

## Connection Pooling

### Why
Each PostgreSQL connection costs ~10MB RAM. 100 connections = 1GB. Serverless functions can spawn hundreds.

### PgBouncer (external pooler)
```ini
[pgbouncer]
pool_mode = transaction    ; Release connection after each transaction
max_client_conn = 1000     ; Accept up to 1000 app connections
default_pool_size = 20     ; Only 20 actual PostgreSQL connections
```

`transaction` mode: connection released after COMMIT. Best for web apps. Breaks: prepared statements, LISTEN/NOTIFY, session variables.
`session` mode: connection held for entire client session. Use only if you need prepared statements.

### Prisma with Connection Pooling
```typescript
// Use connection_limit to control pool size
const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL + "?connection_limit=5" },
  },
});
```

For serverless (Vercel, AWS Lambda): use Prisma Accelerate or PgBouncer. Direct connections from Lambda will exhaust the pool.

## ORM Patterns

### Prisma
```typescript
// Avoid N+1: use include, not sequential queries
const users = await prisma.user.findMany({
  where: { isActive: true },
  include: {
    orders: {
      where: { status: "completed" },
      orderBy: { createdAt: "desc" },
      take: 5,
    },
  },
});
```

### Drizzle (SQL-like, type-safe)
```typescript
import { eq, desc, sql } from "drizzle-orm";

const result = await db
  .select({
    name: users.name,
    orderCount: sql<number>`count(${orders.id})`.as("order_count"),
  })
  .from(users)
  .leftJoin(orders, eq(orders.userId, users.id))
  .where(eq(users.isActive, true))
  .groupBy(users.id)
  .orderBy(desc(sql`count(${orders.id})`));
```

### SQLAlchemy (Python)
```python
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload

# Eager load to avoid N+1
stmt = (
    select(User)
    .options(joinedload(User.orders))
    .where(User.is_active == True)
)
users = session.scalars(stmt).unique().all()
```

## Transactions & Isolation Levels

```sql
-- PostgreSQL default: READ COMMITTED
-- Each statement sees committed data at statement start.

-- REPEATABLE READ: snapshot at transaction start. Use for reports.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT sum(balance) FROM accounts;  -- consistent snapshot
SELECT count(*) FROM accounts WHERE balance > 1000;  -- same snapshot
COMMIT;

-- SERIALIZABLE: full serializability. Use for financial operations.
BEGIN ISOLATION LEVEL SERIALIZABLE;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;
-- If concurrent transaction conflicts, one gets: ERROR: could not serialize access
-- Your code MUST retry on serialization failure.
```

SQLite: uses DEFERRED (default), IMMEDIATE, or EXCLUSIVE locking.
- `BEGIN IMMEDIATE`: grabs write lock upfront. Prevents "database is locked" errors in concurrent writes.

## Anti-Patterns

### N+1 Queries
```python
# BAD: 1 query for users + N queries for orders
users = session.query(User).all()
for user in users:
    print(user.orders)  # Each triggers a SELECT

# GOOD: 1 query with JOIN
users = session.query(User).options(joinedload(User.orders)).all()
```

### Missing Indexes on Foreign Keys
PostgreSQL does NOT auto-index foreign keys. Every FK column needs an explicit index, or JOINs and cascading deletes will Seq Scan.

```sql
-- After adding a FK, always add the index
ALTER TABLE orders ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX idx_orders_user_id ON orders (user_id);  -- DON'T FORGET THIS
```

### Over-Normalization
If you're joining 6 tables to render a product card, you've gone too far. Denormalize the read path, keep writes normalized. CQRS pattern: separate read models (denormalized) from write models (normalized).

### Unbounded Queries
```sql
-- BAD: no LIMIT, could return millions of rows
SELECT * FROM logs WHERE level = 'error';

-- GOOD: always paginate
SELECT * FROM logs WHERE level = 'error'
ORDER BY created_at DESC
LIMIT 50 OFFSET 0;

-- BETTER: cursor-based pagination (stable, no offset scan)
SELECT * FROM logs WHERE level = 'error' AND created_at < $last_seen
ORDER BY created_at DESC
LIMIT 50;
```

### Using TEXT for Everything
Use the right type. `TIMESTAMPTZ` not `TEXT` for dates. `INTEGER` not `TEXT` for IDs. `INET` not `TEXT` for IPs. Correct types enable index efficiency, validation, and query planner optimization.

## PostgreSQL vs SQLite Decision Guide

**Choose SQLite when**: single-user app, embedded/mobile, CLI tools, <100 concurrent readers, <10GB database, prototyping.
**Choose PostgreSQL when**: multi-user web app, concurrent writes, need JSONB/full-text/GIS, >10GB, need replication, need row-level security.

SQLite scales reads remarkably well with WAL mode:
```sql
PRAGMA journal_mode = WAL;      -- Write-ahead logging: concurrent reads during writes
PRAGMA busy_timeout = 5000;     -- Wait 5s instead of instant SQLITE_BUSY
PRAGMA synchronous = NORMAL;    -- Good enough durability for most apps
PRAGMA cache_size = -64000;     -- 64MB cache (negative = KB)
```
