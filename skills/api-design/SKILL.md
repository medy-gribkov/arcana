---
name: api-design
description: REST API and GraphQL design best practices including resource naming, HTTP methods, status codes, pagination (cursor vs offset), filtering, error responses (RFC 7807), versioning strategies, OpenAPI specs, authentication (JWT, API keys, OAuth2), rate limiting, HATEOAS, GraphQL schema design, resolvers, N+1 problem, and subscriptions. Use when designing, reviewing, or documenting APIs.
---
You are an API architect specializing in RESTful API design, GraphQL schema design, and production-grade API patterns for scalability and developer experience.

## Use this skill when

- Designing REST or GraphQL APIs
- Choosing pagination, filtering, or error response patterns
- Setting up API authentication and authorization
- Writing OpenAPI/Swagger specifications
- Reviewing API design for consistency and best practices

## REST Resource Naming

```
# Resources are nouns, plural, lowercase, hyphen-separated
GET    /api/v1/users                    # list
POST   /api/v1/users                    # create
GET    /api/v1/users/{userId}           # read
PUT    /api/v1/users/{userId}           # full replace
PATCH  /api/v1/users/{userId}           # partial update
DELETE /api/v1/users/{userId}           # delete

# Nested resources for strong parent-child relationships
GET    /api/v1/users/{userId}/orders
POST   /api/v1/users/{userId}/orders

# Actions that don't map to CRUD: use verbs as sub-resources
POST   /api/v1/users/{userId}/activate
POST   /api/v1/orders/{orderId}/cancel
POST   /api/v1/reports/generate
```

**Rules:**
- Never use verbs in resource paths (`/getUser`, `/createOrder` are wrong).
- Use path params for identity (`/users/123`), query params for filtering (`/users?role=admin`).
- Max nesting depth: 2 levels (`/users/{id}/orders`). Beyond that, promote to top-level with a filter.
- Use kebab-case for multi-word resources: `/order-items`, not `/orderItems`.

## HTTP Methods and Status Codes

| Method | Idempotent | Safe | Use Case |
|--------|-----------|------|----------|
| GET | Yes | Yes | Read resource(s) |
| POST | No | No | Create resource, trigger action |
| PUT | Yes | No | Full replace (client sends complete resource) |
| PATCH | No* | No | Partial update (send only changed fields) |
| DELETE | Yes | No | Remove resource |

**Status codes to actually use:**

```
200 OK              - GET success, PUT/PATCH success with body
201 Created         - POST success (include Location header)
204 No Content      - DELETE success, PUT/PATCH success without body
400 Bad Request     - Validation error, malformed request
401 Unauthorized    - Missing or invalid authentication
403 Forbidden       - Authenticated but not authorized
404 Not Found       - Resource doesn't exist (also use for authz to prevent enumeration)
409 Conflict        - Duplicate resource, version conflict
422 Unprocessable   - Semantically invalid (valid JSON, invalid business logic)
429 Too Many Reqs   - Rate limited (include Retry-After header)
500 Internal Error  - Unhandled server error (never expose stack traces)
```

**Don't use:** 200 for everything, 403 when 404 is safer, custom 4xx codes, 500 for validation errors.

## Error Response (RFC 7807)

```json
{
  "type": "https://api.example.com/errors/validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "The request body contains invalid fields.",
  "instance": "/api/v1/users",
  "errors": [
    {
      "field": "email",
      "message": "must be a valid email address",
      "code": "INVALID_FORMAT"
    },
    {
      "field": "age",
      "message": "must be between 0 and 150",
      "code": "OUT_OF_RANGE"
    }
  ]
}
```

**Content-Type:** `application/problem+json`. Every error response uses the same shape. Include `type` as a stable URI for documentation. The `errors` array for field-level validation details is an extension.

## Pagination

### Cursor-Based (preferred for feeds, real-time data)
```
GET /api/v1/posts?limit=20&after=eyJpZCI6MTAwfQ

Response:
{
  "data": [...],
  "pagination": {
    "has_next": true,
    "next_cursor": "eyJpZCI6MTIwfQ",
    "has_previous": true,
    "previous_cursor": "eyJpZCI6MTAxfQ"
  }
}
```

Cursor is an opaque base64-encoded token (typically the last item's sort key). **Advantages:** consistent results when data changes, O(1) seek performance. **Use for:** social feeds, activity logs, any dataset that mutates frequently.

### Offset-Based (for admin dashboards, search results)
```
GET /api/v1/products?page=3&per_page=25

Response:
{
  "data": [...],
  "pagination": {
    "page": 3,
    "per_page": 25,
    "total_count": 1234,
    "total_pages": 50
  }
}
```

**Disadvantages:** slow on large offsets (OFFSET 10000 scans 10000 rows), inconsistent with concurrent writes. Use only when users need to jump to arbitrary pages.

## Filtering, Sorting, and Field Selection

```
# Filtering: field[operator]=value
GET /api/v1/products?category=electronics&price[gte]=10&price[lte]=100&status=active

# Sorting: sort=field (ascending), sort=-field (descending), comma-separated
GET /api/v1/products?sort=-created_at,name

# Field selection (sparse fieldsets): reduce payload size
GET /api/v1/users?fields=id,name,email

# Search: use a dedicated query parameter
GET /api/v1/products?q=wireless+keyboard
```

**Implementation tip:** Validate all filter fields against an allowlist. Never pass user input directly to SQL ORDER BY or WHERE clauses.

## Versioning Strategies

| Strategy | Example | Pros | Cons |
|----------|---------|------|------|
| URL path | `/api/v1/users` | Obvious, cacheable, easy routing | URL pollution |
| Header | `Accept: application/vnd.api.v1+json` | Clean URLs | Hidden, hard to test in browser |
| Query param | `/api/users?version=1` | Easy to switch | Pollutes query string |

**Recommended: URL path versioning.** It's the most explicit and tooling-friendly. Only bump major version for breaking changes. Keep at most 2 versions alive. Deprecate with `Sunset` header and 6-month timeline.

## Authentication Patterns

### API Keys (server-to-server, simple integrations)
```
# Send in header, never in URL (URLs get logged)
Authorization: ApiKey sk_live_abc123def456

# Server-side: hash the key, store the hash. Show the key only once at creation.
# Scope keys: read-only vs read-write, per-resource permissions.
# Rotate: support multiple active keys per client for zero-downtime rotation.
```

### JWT Bearer (user-facing APIs)
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...

# Access token: 15 min, stateless, contains user ID + roles
# Refresh token: 7 days, stored server-side, one-time use (rotate on refresh)
# Token refresh endpoint:
POST /api/v1/auth/refresh
{ "refresh_token": "rt_abc123" }
```

### OAuth2 (third-party integrations)
Use Authorization Code flow with PKCE for SPAs and mobile apps. Never use Implicit flow (deprecated). Client Credentials flow for service-to-service.

## Rate Limiting

```
# Response headers (standard)
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1708300800     # Unix timestamp when window resets
Retry-After: 30                    # seconds (on 429 response)
```

**Implementation patterns:**
- **Fixed window:** Simple but bursty at window boundaries. 100 req/min resets at :00.
- **Sliding window:** Smoother. Count requests in the last 60 seconds.
- **Token bucket:** Best for APIs. Allows bursts up to bucket size, refills at steady rate.

**Tiered limits:** Different limits per plan (free: 100/hr, pro: 10,000/hr). Different limits per endpoint (auth: 5/min, reads: 1000/min, writes: 100/min).

**BAD/GOOD rate limiting patterns:**
```javascript
// BAD: Client-side only enforcement (easily bypassed)
if (requestCount > 100) {
  alert("Rate limit exceeded");
  return;
}

// GOOD: Server-side with Redis sliding window
const key = `rate:${userId}:${endpoint}`;
const count = await redis.incr(key);
if (count === 1) await redis.expire(key, 3600); // 1 hour window
if (count > 100) {
  res.set("Retry-After", "3600");
  return res.status(429).json({ error: "Rate limit exceeded" });
}
```

## OpenAPI Spec (snippet)

```yaml
openapi: 3.1.0
info:
  title: My API
  version: 1.0.0
paths:
  /api/v1/users:
    get:
      summary: List users
      operationId: listUsers
      tags: [users]
      parameters:
        - name: page
          in: query
          schema: { type: integer, minimum: 1, default: 1 }
        - name: per_page
          in: query
          schema: { type: integer, minimum: 1, maximum: 100, default: 25 }
      responses:
        "200":
          description: Paginated list of users
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: "#/components/schemas/User" }
                  pagination:
                    $ref: "#/components/schemas/Pagination"
        "401":
          $ref: "#/components/responses/Unauthorized"
components:
  schemas:
    User:
      type: object
      required: [id, name, email]
      properties:
        id: { type: integer, format: int64 }
        name: { type: string, minLength: 1, maxLength: 100 }
        email: { type: string, format: email }
        created_at: { type: string, format: date-time }
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
security:
  - bearerAuth: []
```

**Write spec first (design-first), then implement.** Generate client SDKs and server stubs from the spec. Validate requests/responses against the spec in tests.

## GraphQL: Schema Design

```graphql
type Query {
  user(id: ID!): User
  users(first: Int = 20, after: String, filter: UserFilter): UserConnection!
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload!
}

type User {
  id: ID!
  name: String!
  email: String!
  orders(first: Int = 10, after: String): OrderConnection!
}

# Relay-style pagination
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  cursor: String!
  node: User!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# Input types for mutations
input CreateUserInput {
  name: String!
  email: String!
}

# Mutation payloads include the result + possible errors
type CreateUserPayload {
  user: User
  errors: [UserError!]!
}

type UserError {
  field: String!
  message: String!
}
```

**GraphQL design rules:**
- Use `Connection` pattern (Relay spec) for all lists.
- Mutations take a single `input` argument and return a `Payload` type.
- Never expose database IDs directly; use opaque global IDs.
- Make fields non-nullable by default (`String!`). Only use nullable for fields that can genuinely be absent.

## GraphQL: N+1 Problem

```javascript
// BAD: each user resolver fetches orders individually
// 1 query for users + N queries for each user's orders = N+1

// GOOD: DataLoader batches and deduplicates
import DataLoader from "dataloader";

const ordersByUserLoader = new DataLoader(async (userIds) => {
  // Single query: SELECT * FROM orders WHERE user_id IN (...)
  const orders = await db.query(
    "SELECT * FROM orders WHERE user_id = ANY($1)",
    [userIds]
  );
  // Map results back to the same order as input IDs
  const map = new Map();
  for (const order of orders) {
    if (!map.has(order.user_id)) map.set(order.user_id, []);
    map.get(order.user_id).push(order);
  }
  return userIds.map((id) => map.get(id) || []);
});

// Resolver
const resolvers = {
  User: {
    orders: (user, _args, ctx) => ctx.loaders.ordersByUser.load(user.id),
  },
};
```

**Always use DataLoader** (or equivalent) for any field that fetches related data. Create a new DataLoader instance per request to prevent cross-request caching.

## GraphQL: Subscriptions

```graphql
type Subscription {
  orderStatusChanged(orderId: ID!): Order!
  newMessage(channelId: ID!): Message!
}
```

```javascript
// Server (graphql-ws protocol, NOT the deprecated subscriptions-transport-ws)
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";

const wsServer = new WebSocketServer({ server: httpServer, path: "/graphql" });
useServer(
  {
    schema,
    context: async (ctx) => {
      // Authenticate on connection_init
      const token = ctx.connectionParams?.token;
      const user = await verifyToken(token);
      if (!user) throw new Error("Unauthorized");
      return { user };
    },
  },
  wsServer
);
```

**Subscription tips:** Use `graphql-ws` library (not the legacy `subscriptions-transport-ws`). Authenticate on WebSocket `connection_init`, not per message. Back subscriptions with Redis Pub/Sub or similar for multi-instance deployments. Always set connection timeouts and heartbeats.
