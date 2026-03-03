# REST API Design Patterns

## Pagination Implementation

### Cursor-Based (Recommended)

```typescript
// Server implementation
async function listPosts(cursor?: string, limit = 20) {
  const decodedCursor = cursor
    ? JSON.parse(Buffer.from(cursor, 'base64url').toString())
    : null;

  const posts = await db.post.findMany({
    take: limit + 1, // Fetch one extra to check hasNext
    ...(decodedCursor && {
      cursor: { id: decodedCursor.id },
      skip: 1, // Skip the cursor item itself
    }),
    orderBy: { createdAt: 'desc' },
  });

  const hasNext = posts.length > limit;
  const data = hasNext ? posts.slice(0, limit) : posts;

  return {
    data,
    pagination: {
      has_next: hasNext,
      next_cursor: hasNext
        ? Buffer.from(JSON.stringify({ id: data[data.length - 1].id })).toString('base64url')
        : null,
    },
  };
}
```

### Offset-Based

```typescript
async function listProducts(page = 1, perPage = 25) {
  const [data, totalCount] = await Promise.all([
    db.product.findMany({
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { createdAt: 'desc' },
    }),
    db.product.count(),
  ]);

  return {
    data,
    pagination: {
      page,
      per_page: perPage,
      total_count: totalCount,
      total_pages: Math.ceil(totalCount / perPage),
    },
  };
}
```

## Filtering Implementation

```typescript
// Allowlist-based filtering (prevents SQL injection via field names)
const ALLOWED_FILTERS: Record<string, string> = {
  category: 'equals',
  status: 'equals',
  'price[gte]': 'gte',
  'price[lte]': 'lte',
  'created_at[after]': 'gte',
};

function buildFilter(query: Record<string, string>) {
  const where: Record<string, unknown> = {};

  for (const [param, value] of Object.entries(query)) {
    if (!(param in ALLOWED_FILTERS)) continue;

    const field = param.replace(/\[.*\]/, '');
    const operator = ALLOWED_FILTERS[param];

    if (operator === 'equals') {
      where[field] = value;
    } else {
      where[field] = { ...where[field] as object, [operator]: value };
    }
  }

  return where;
}
```

## Error Response (RFC 7807)

```typescript
// Consistent error factory
interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  errors?: Array<{ field: string; message: string; code: string }>;
}

function problemResponse(res: Response, problem: ProblemDetail) {
  return res
    .status(problem.status)
    .set('Content-Type', 'application/problem+json')
    .json(problem);
}

// Usage
problemResponse(res, {
  type: 'https://api.example.com/errors/validation',
  title: 'Validation Error',
  status: 422,
  detail: 'The request body contains invalid fields.',
  instance: req.originalUrl,
  errors: [
    { field: 'email', message: 'must be a valid email', code: 'INVALID_FORMAT' },
  ],
});
```

## HATEOAS Links

```json
{
  "id": 123,
  "status": "pending",
  "_links": {
    "self": { "href": "/api/v1/orders/123" },
    "cancel": { "href": "/api/v1/orders/123/cancel", "method": "POST" },
    "items": { "href": "/api/v1/orders/123/items" },
    "customer": { "href": "/api/v1/customers/456" }
  }
}
```

Only include links for actions currently available. If an order is already shipped, omit the `cancel` link.

## Rate Limiting with Token Bucket

```typescript
import Redis from 'ioredis';

const redis = new Redis();

async function tokenBucket(
  key: string,
  maxTokens: number,
  refillRate: number, // tokens per second
  tokensRequired = 1
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const luaScript = `
    local key = KEYS[1]
    local max = tonumber(ARGV[1])
    local rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local required = tonumber(ARGV[4])

    local data = redis.call('HMGET', key, 'tokens', 'last')
    local tokens = tonumber(data[1]) or max
    local last = tonumber(data[2]) or now

    local elapsed = (now - last) / 1000
    tokens = math.min(max, tokens + elapsed * rate)

    local allowed = tokens >= required
    if allowed then tokens = tokens - required end

    redis.call('HMSET', key, 'tokens', tokens, 'last', now)
    redis.call('EXPIRE', key, math.ceil(max / rate) + 1)

    return {allowed and 1 or 0, math.floor(tokens), math.ceil((required - tokens) / rate * 1000)}
  `;

  const [allowed, remaining, resetMs] = await redis.eval(
    luaScript, 1, key, maxTokens, refillRate, now, tokensRequired
  ) as [number, number, number];

  return {
    allowed: allowed === 1,
    remaining,
    resetAt: Math.ceil((now + resetMs) / 1000),
  };
}
```

## Idempotency Keys

```typescript
// For POST requests that should not be duplicated
app.post('/api/v1/payments', async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header required' });
  }

  // Check if we already processed this key
  const cached = await redis.get(`idempotency:${idempotencyKey}`);
  if (cached) {
    return res.status(200).json(JSON.parse(cached));
  }

  // Process the payment
  const result = await processPayment(req.body);

  // Cache the result for 24 hours
  await redis.set(
    `idempotency:${idempotencyKey}`,
    JSON.stringify(result),
    'EX', 86400
  );

  return res.status(201).json(result);
});
```
