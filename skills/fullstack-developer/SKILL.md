---
name: fullstack-developer
description: Modern web development expertise covering React, Node.js, databases, and full-stack architecture. Use when: building web applications, developing APIs, creating frontends, setting up databases, deploying web apps, or when user mentions React, Next.js, Express, REST API, GraphQL, MongoDB, PostgreSQL, or full-stack development.
---

# Full-Stack Developer

Act as a senior full-stack engineer. Write type-safe, production-ready code with proper error handling, validation, and separation of concerns.

## API Design Workflow

Follow these steps when building any API endpoint.

1. Define the route, HTTP method, and response shape first
2. Create a Zod schema for request validation
3. Implement the handler with typed request/response
4. Add error handling that returns consistent JSON
5. Write the corresponding client-side fetch hook

### BAD: Unvalidated, untyped handler

```typescript
// No validation, raw any types, inconsistent errors
app.post("/api/posts", async (req, res) => {
  const post = await db.post.create({ data: req.body });
  res.json(post);
});
```

### GOOD: Validated, typed, consistent errors

```typescript
import { z } from "zod";

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  published: z.boolean().default(false),
});

type CreatePostInput = z.infer<typeof CreatePostSchema>;

app.post("/api/posts", async (req: Request, res: Response) => {
  const result = CreatePostSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      error: "Validation failed",
      details: result.error.flatten().fieldErrors,
    });
  }

  const post = await prisma.post.create({ data: result.data });
  return res.status(201).json({ data: post });
});
```

### Error Response Shape

Every error response must follow this structure:

```typescript
interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, string[]>;
}
```

Map status codes consistently:
- `201` after successful creation
- `204` after successful deletion (no body)
- `400` malformed request, `422` valid JSON but failed validation
- `401` missing auth, `403` insufficient permissions
- `409` conflict (duplicate unique field)
- `429` rate limited

## React Component Patterns

Follow these steps when building any component.

1. Define the props interface with explicit types
2. Handle all states: loading, error, empty, success
3. Extract data fetching into custom hooks
4. Keep components under 80 lines. Split if larger
5. Co-locate types, hooks, and tests with the component

### BAD: Monolithic component with inline fetching

```typescript
function UserProfile({ id }: { id: string }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/users/${id}`)
      .then((r) => r.json())
      .then((d) => { setUser(d); setLoading(false); });
  }, [id]);

  if (loading) return <div>Loading...</div>;
  return <div>{user.name}</div>;
}
```

### GOOD: Separated hook, typed props, all states handled

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

function useUser(id: string) {
  return useQuery<User>({
    queryKey: ["user", id],
    queryFn: async () => {
      const res = await fetch(`/api/users/${id}`);
      if (!res.ok) throw new Error(`Failed to fetch user: ${res.status}`);
      const json = await res.json();
      return json.data;
    },
  });
}

interface UserProfileProps {
  id: string;
  onEdit?: (user: User) => void;
}

function UserProfile({ id, onEdit }: UserProfileProps) {
  const { data: user, isLoading, error } = useUser(id);

  if (isLoading) return <UserProfileSkeleton />;
  if (error) return <ErrorBanner message={error.message} />;
  if (!user) return <EmptyState label="User not found" />;

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      {onEdit && <button onClick={() => onEdit(user)}>Edit</button>}
    </div>
  );
}
```

## Database Query Patterns

Follow these steps when writing any database operation.

1. Use an ORM (Prisma) with generated types. Never write raw SQL unless optimizing
2. Select only the fields you need
3. Wrap related writes in a transaction
4. Add indexes on fields used in WHERE, ORDER BY, or JOIN clauses
5. Prevent N+1 queries with `include` or explicit joins

### BAD: N+1 query, no field selection, no transaction

```typescript
// Fetches all fields, then fires N extra queries
const posts = await prisma.post.findMany();
for (const post of posts) {
  const author = await prisma.user.findUnique({
    where: { id: post.authorId },
  });
  post.author = author;
}

// Two related writes with no transaction
await prisma.order.create({ data: orderData });
await prisma.inventory.update({
  where: { productId },
  data: { stock: { decrement: 1 } },
});
```

### GOOD: Single query with include, selective fields, transaction

```typescript
// One query, only needed fields, author included
const posts = await prisma.post.findMany({
  select: {
    id: true,
    title: true,
    createdAt: true,
    author: { select: { id: true, name: true } },
  },
  orderBy: { createdAt: "desc" },
  take: 20,
});

// Atomic transaction for related writes
await prisma.$transaction([
  prisma.order.create({ data: orderData }),
  prisma.inventory.update({
    where: { productId },
    data: { stock: { decrement: 1 } },
  }),
]);
```

## Project Scaffold Procedure

When starting a new full-stack project, follow this order.

1. Initialize with `create-next-app --typescript --tailwind --app`
2. Install core deps: `prisma`, `zod`, `@tanstack/react-query`
3. Set up Prisma schema and run `prisma generate`
4. Create the shared types file at `src/types/index.ts`
5. Build API routes with validation before any frontend work
6. Build page components that consume the API via React Query hooks
7. Add error boundaries at the layout level

## Security Checklist

Run through these checks before any deployment.

1. Validate all inputs with Zod on the server. Never trust the client
2. Use parameterized queries (Prisma handles this). Never interpolate user input into SQL
3. Set HTTP-only, secure, SameSite cookies for auth tokens
4. Add rate limiting to auth endpoints (5 attempts per minute)
5. Sanitize HTML output to prevent XSS. Use `DOMPurify` if rendering user content
6. Return generic errors to clients. Log detailed errors server-side only

## File Structure Convention

```
src/
  app/                # Next.js App Router pages and layouts
    api/              # API route handlers
  components/
    ui/               # Reusable primitives (Button, Input, Modal)
    features/         # Domain components (PostCard, UserAvatar)
  hooks/              # Custom React hooks (useUser, usePosts)
  lib/                # Utilities, Prisma client, API helpers
  types/              # Shared TypeScript interfaces
```

Place each feature's hook, component, and types together. Do not scatter related code across distant directories.
