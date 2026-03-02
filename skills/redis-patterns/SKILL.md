---
name: redis-patterns
description: Apply production Redis patterns including caching strategies, rate limiting, distributed locks, pub/sub, streams, and memory optimization with TypeScript and Go examples
user-invokable: true
argument-hint: "[cache|session|ratelimit|lock|pubsub|stream|memory]"
---

# Redis Patterns

Production patterns for Redis covering caching, session management, rate limiting, distributed systems, and performance optimization.

## Cache-Aside Pattern

**BAD: No TTL, cache stampede vulnerability**
```typescript
// ioredis
import Redis from 'ioredis';
const redis = new Redis();

async function getUser(id: string) {
  const cached = await redis.get(`user:${id}`);
  if (cached) return JSON.parse(cached);

  const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  await redis.set(`user:${id}`, JSON.stringify(user)); // No TTL!
  return user;
}
```

**GOOD: TTL + stampede protection with locking**
```typescript
async function getUser(id: string) {
  const key = `user:${id}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  // Acquire lock to prevent stampede
  const lockKey = `lock:${key}`;
  const acquired = await redis.set(lockKey, '1', 'NX', 'EX', 10);

  if (!acquired) {
    // Wait and retry if another process is loading
    await new Promise(resolve => setTimeout(resolve, 100));
    return getUser(id);
  }

  try {
    const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    await redis.setex(key, 3600, JSON.stringify(user)); // 1 hour TTL
    return user;
  } finally {
    await redis.del(lockKey);
  }
}
```

## Write-Through Cache

**BAD: Cache and DB out of sync**
```go
// go-redis
import "github.com/redis/go-redis/v9"

func updateUser(ctx context.Context, rdb *redis.Client, user User) error {
    data, _ := json.Marshal(user)
    rdb.Set(ctx, fmt.Sprintf("user:%s", user.ID), data, 0)
    return db.Exec("UPDATE users SET name = $1 WHERE id = $2", user.Name, user.ID)
    // If DB fails, cache is dirty!
}
```

**GOOD: Write DB first, then invalidate cache**
```go
func updateUser(ctx context.Context, rdb *redis.Client, user User) error {
    // Write to DB first
    if err := db.Exec("UPDATE users SET name = $1 WHERE id = $2", user.Name, user.ID); err != nil {
        return err
    }

    // Invalidate cache, don't care if this fails
    key := fmt.Sprintf("user:%s", user.ID)
    rdb.Del(ctx, key)
    return nil
}
```

## Sliding Window Rate Limiter

**BAD: Fixed window allows burst**
```typescript
async function isRateLimited(userId: string): Promise<boolean> {
  const key = `ratelimit:${userId}:${Math.floor(Date.now() / 60000)}`;
  const count = await redis.incr(key);
  await redis.expire(key, 60);
  return count > 100; // 100/min but allows 200 across window boundary
}
```

**GOOD: Sliding window with sorted set**
```typescript
async function isRateLimited(userId: string, limit = 100, windowSec = 60): Promise<boolean> {
  const key = `ratelimit:${userId}`;
  const now = Date.now();
  const windowStart = now - (windowSec * 1000);

  const pipe = redis.pipeline();
  pipe.zremrangebyscore(key, 0, windowStart); // Remove old entries
  pipe.zadd(key, now, `${now}-${Math.random()}`); // Add current request
  pipe.zcard(key); // Count requests in window
  pipe.expire(key, windowSec);

  const results = await pipe.exec();
  const count = results[2][1] as number;
  return count > limit;
}
```

## Session Storage

**BAD: Storing entire session object, no refresh**
```go
func saveSession(ctx context.Context, rdb *redis.Client, session Session) error {
    data, _ := json.Marshal(session)
    return rdb.Set(ctx, session.ID, data, 30*time.Minute).Err()
    // Session expires even if user is active!
}
```

**GOOD: Hash with TTL refresh on access**
```go
func saveSession(ctx context.Context, rdb *redis.Client, sessionID string, fields map[string]interface{}) error {
    key := fmt.Sprintf("session:%s", sessionID)

    // Store as hash for partial updates
    for field, value := range fields {
        val, _ := json.Marshal(value)
        if err := rdb.HSet(ctx, key, field, val).Err(); err != nil {
            return err
        }
    }

    // Refresh TTL on every access
    return rdb.Expire(ctx, key, 30*time.Minute).Err()
}

func getSessionField(ctx context.Context, rdb *redis.Client, sessionID, field string) (string, error) {
    key := fmt.Sprintf("session:%s", sessionID)
    val, err := rdb.HGet(ctx, key, field).Result()
    if err != nil {
        return "", err
    }

    // Refresh TTL on read
    rdb.Expire(ctx, key, 30*time.Minute)
    return val, nil
}
```

## Distributed Lock (Redlock)

**BAD: No timeout, no fencing token**
```typescript
async function acquireLock(resource: string): Promise<boolean> {
  const acquired = await redis.setnx(`lock:${resource}`, '1');
  return acquired === 1; // Held forever if process crashes!
}
```

**GOOD: Lock with timeout and fencing token**
```typescript
import { randomBytes } from 'crypto';

interface Lock {
  token: string;
  resource: string;
}

async function acquireLock(resource: string, ttlMs = 10000): Promise<Lock | null> {
  const token = randomBytes(16).toString('hex');
  const key = `lock:${resource}`;

  const acquired = await redis.set(key, token, 'PX', ttlMs, 'NX');
  if (!acquired) return null;

  return { token, resource };
}

async function releaseLock(lock: Lock): Promise<boolean> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  const result = await redis.eval(script, 1, `lock:${lock.resource}`, lock.token);
  return result === 1;
}
```

## Pub/Sub for Real-Time Events

**GOOD: Publisher with fanout**
```go
func publishEvent(ctx context.Context, rdb *redis.Client, channel string, event interface{}) error {
    data, err := json.Marshal(event)
    if err != nil {
        return err
    }
    return rdb.Publish(ctx, channel, data).Err()
}
```

**GOOD: Subscriber with graceful shutdown**
```go
func subscribe(ctx context.Context, rdb *redis.Client, channel string) {
    pubsub := rdb.Subscribe(ctx, channel)
    defer pubsub.Close()

    ch := pubsub.Channel()
    for {
        select {
        case msg := <-ch:
            var event Event
            if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
                log.Printf("decode error: %v", err)
                continue
            }
            handleEvent(event)
        case <-ctx.Done():
            return
        }
    }
}
```

## Sorted Sets for Leaderboards

**GOOD: Leaderboard with score and rank**
```typescript
async function updateScore(userId: string, score: number) {
  await redis.zadd('leaderboard', score, userId);
}

async function getTopPlayers(limit = 10): Promise<Array<{userId: string, score: number, rank: number}>> {
  const results = await redis.zrevrange('leaderboard', 0, limit - 1, 'WITHSCORES');

  const players = [];
  for (let i = 0; i < results.length; i += 2) {
    players.push({
      userId: results[i],
      score: parseFloat(results[i + 1]),
      rank: Math.floor(i / 2) + 1
    });
  }
  return players;
}

async function getUserRank(userId: string): Promise<{rank: number, score: number} | null> {
  const [rank, score] = await Promise.all([
    redis.zrevrank('leaderboard', userId),
    redis.zscore('leaderboard', userId)
  ]);

  if (rank === null) return null;
  return { rank: rank + 1, score: parseFloat(score) };
}
```

## Streams for Event Sourcing

**GOOD: Append events and consume with consumer groups**
```typescript
async function appendEvent(stream: string, event: Record<string, string>) {
  await redis.xadd(stream, '*', ...Object.entries(event).flat());
}

async function consumeEvents(stream: string, group: string, consumer: string) {
  // Create consumer group if not exists
  try {
    await redis.xgroup('CREATE', stream, group, '0', 'MKSTREAM');
  } catch (err) {
    // Group already exists
  }

  while (true) {
    const results = await redis.xreadgroup(
      'GROUP', group, consumer,
      'BLOCK', 5000,
      'COUNT', 10,
      'STREAMS', stream, '>'
    );

    if (!results || results.length === 0) continue;

    for (const [streamName, entries] of results) {
      for (const [id, fields] of entries) {
        const event = Object.fromEntries(
          fields.reduce((acc, val, i, arr) => {
            if (i % 2 === 0) acc.push([val, arr[i + 1]]);
            return acc;
          }, [])
        );

        await processEvent(event);
        await redis.xack(stream, group, id);
      }
    }
  }
}
```

## Key Naming Conventions

**BAD: Inconsistent, hard to debug**
```typescript
await redis.set('user_123', data);
await redis.set('User:456', data);
await redis.set('u:789', data);
```

**GOOD: Hierarchical, predictable**
```typescript
// Pattern: {resource}:{id}:{field}
await redis.set('user:123:profile', profileData);
await redis.set('user:123:settings', settingsData);
await redis.set('session:abc:user', userId);
await redis.zadd('leaderboard:daily:2024-03-02', score, userId);
```

## Memory Optimization

**BAD: Large blobs in cache**
```go
func cacheDocument(ctx context.Context, rdb *redis.Client, docID string, doc []byte) error {
    // Storing 10MB PDFs in Redis!
    return rdb.Set(ctx, fmt.Sprintf("doc:%s", docID), doc, time.Hour).Err()
}
```

**GOOD: Store reference, maxmemory-policy**
```go
// redis.conf: maxmemory 2gb, maxmemory-policy allkeys-lru

func cacheDocument(ctx context.Context, rdb *redis.Client, docID string, s3Key string) error {
    // Store S3 reference only
    meta := map[string]interface{}{
        "s3_key": s3Key,
        "cached_at": time.Now().Unix(),
    }
    data, _ := json.Marshal(meta)
    return rdb.Set(ctx, fmt.Sprintf("doc:%s", docID), data, time.Hour).Err()
}
```

## Connection Pooling

**BAD: New connection per request**
```typescript
async function getKey(key: string) {
  const redis = new Redis(); // New connection every time!
  const value = await redis.get(key);
  await redis.quit();
  return value;
}
```

**GOOD: Reuse connection pool**
```typescript
// Initialize once
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});

async function getKey(key: string) {
  return redis.get(key); // Reuses connection
}
```

## Pipeline for Batching

**BAD: Sequential round trips**
```go
func getUserData(ctx context.Context, rdb *redis.Client, userID string) (User, error) {
    profile, _ := rdb.Get(ctx, fmt.Sprintf("user:%s:profile", userID)).Result()
    settings, _ := rdb.Get(ctx, fmt.Sprintf("user:%s:settings", userID)).Result()
    posts, _ := rdb.LLen(ctx, fmt.Sprintf("user:%s:posts", userID)).Result()
    // 3 round trips!

    return User{Profile: profile, Settings: settings, PostCount: posts}, nil
}
```

**GOOD: Single round trip with pipeline**
```go
func getUserData(ctx context.Context, rdb *redis.Client, userID string) (User, error) {
    pipe := rdb.Pipeline()

    profileCmd := pipe.Get(ctx, fmt.Sprintf("user:%s:profile", userID))
    settingsCmd := pipe.Get(ctx, fmt.Sprintf("user:%s:settings", userID))
    postsCmd := pipe.LLen(ctx, fmt.Sprintf("user:%s:posts", userID))

    _, err := pipe.Exec(ctx)
    if err != nil {
        return User{}, err
    }

    return User{
        Profile: profileCmd.Val(),
        Settings: settingsCmd.Val(),
        PostCount: postsCmd.Val(),
    }, nil
}
```

## MULTI/EXEC for Transactions

**GOOD: Atomic operations with WATCH**
```typescript
async function transferPoints(fromUser: string, toUser: string, points: number) {
  const fromKey = `user:${fromUser}:points`;
  const toKey = `user:${toUser}:points`;

  while (true) {
    await redis.watch(fromKey);

    const balance = parseInt(await redis.get(fromKey) || '0');
    if (balance < points) {
      await redis.unwatch();
      throw new Error('Insufficient points');
    }

    const multi = redis.multi();
    multi.decrby(fromKey, points);
    multi.incrby(toKey, points);

    const result = await multi.exec();
    if (result) break; // Success

    // Transaction failed due to concurrent modification, retry
  }
}
```

## When to Use Redis

Use Redis for:
- Caching frequently accessed data with TTL
- Session storage with automatic expiration
- Rate limiting and quota management
- Real-time features (pub/sub, leaderboards)
- Distributed locks for coordination
- Event streams with consumer groups
- Temporary data that can be reconstructed

Avoid Redis for:
- Primary data storage (use PostgreSQL)
- Large binary objects (use S3)
- Complex queries and joins (use SQL)
- Strong consistency requirements (Redis is eventually consistent across replicas)
- Audit logs requiring durability (Redis prioritizes speed over persistence)
