---
name: nextjs-16
description: Build Next.js 16 apps with Turbopack, Cache Components, proxy.ts, Server Actions, React 19.2 View Transitions, and App Router patterns. Covers streaming SSR, ISR, error boundaries, and advanced routing.
user-invokable: true
argument-hint: "[component-name or feature]"
---

# Next.js 16 Development Skill

You are a Next.js 16 expert. Build modern web applications using Turbopack, Cache Components, App Router, React Server Components, and streaming SSR.

## Core Principles

1. **Server Components by default.** Client Components only when needed (interactivity, hooks, browser APIs).
2. **Streaming and Suspense.** Load UI progressively, never block entire page.
3. **Cache Components over implicit caching.** Use `"use cache"` directive explicitly. All dynamic code runs at request time by default.
4. **Type safety.** TypeScript strict mode. All params/searchParams are async (`await params`).
5. **proxy.ts over middleware.ts.** Use `proxy.ts` for request interception (Node.js runtime). `middleware.ts` is deprecated.

## App Router Structure

**BAD** - Pages Router patterns:

```typescript
// pages/api/users.ts - REMOVED IN 16
export default function handler(req, res) {
  res.json({ users: [] })
}
```

**GOOD** - App Router with colocation:

```typescript
// app/dashboard/page.tsx
export default function DashboardPage() {
  return <div>Dashboard</div>
}

// app/api/users/route.ts
export async function GET() {
  return Response.json({ users: [] })
}

// app/dashboard/layout.tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className="dashboard-wrapper">{children}</div>
}
```

## Cache Components (New in 16)

**BAD** - Relying on implicit caching (removed in 16):

```typescript
// experimental.ppr flag - REMOVED
// next.config: { experimental: { ppr: true } } - REMOVED

export default async function PostsPage() {
  const res = await fetch('https://api.example.com/posts', {
    cache: 'force-cache' // Old implicit caching
  })
  const posts = await res.json()
  return <PostList posts={posts} />
}
```

**GOOD** - Explicit Cache Components with `"use cache"`:

```typescript
// next.config.ts
const nextConfig = {
  cacheComponents: true,
}
export default nextConfig

// app/posts/page.tsx
"use cache"

export default async function PostsPage() {
  const posts = await db.posts.findMany()
  return <PostList posts={posts} />
}
```

**GOOD** - Cache at function level:

```typescript
async function getProducts() {
  "use cache"
  return await db.products.findMany()
}

export default async function ProductsPage() {
  const products = await getProducts()
  return <ProductGrid products={products} />
}
```

## Proxy (Replaces Middleware)

**BAD** - Using deprecated middleware.ts:

```typescript
// middleware.ts - DEPRECATED, will be removed
export function middleware(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url))
}
```

**GOOD** - Using proxy.ts (Node.js runtime):

```typescript
// proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default function proxy(request: NextRequest) {
  const token = request.cookies.get('token')?.value

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*']
}
```

## Server Components vs Client Components

**BAD** - Using Client Component unnecessarily:

```typescript
'use client'
export default function UserList({ users }: { users: User[] }) {
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>
}
```

**GOOD** - Server Component with async params (required in 16):

```typescript
// app/users/page.tsx
export default async function UsersPage() {
  const users = await db.users.findMany()
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>
}

// app/users/[id]/page.tsx - params are async in 16
export default async function UserPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await db.users.findUnique({ where: { id } })
  return <div>{user.name}</div>
}
```

## Streaming SSR with Suspense

**BAD** - Blocking entire page load:

```typescript
export default async function Dashboard() {
  const user = await fetchUser()
  const posts = await fetchPosts()
  const comments = await fetchComments()
  return (
    <div>
      <UserProfile user={user} />
      <Posts posts={posts} />
      <Comments comments={comments} />
    </div>
  )
}
```

**GOOD** - Stream components independently:

```typescript
import { Suspense } from 'react'

export default function Dashboard() {
  return (
    <div>
      <Suspense fallback={<UserSkeleton />}>
        <UserProfile />
      </Suspense>
      <Suspense fallback={<PostsSkeleton />}>
        <Posts />
      </Suspense>
      <Suspense fallback={<CommentsSkeleton />}>
        <Comments />
      </Suspense>
    </div>
  )
}

async function UserProfile() {
  const user = await fetchUser()
  return <div>{user.name}</div>
}
```

## Server Actions

**BAD** - Client-side fetch to API route:

```typescript
'use client'
export default function CreatePostForm() {
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/posts', { method: 'POST', body: JSON.stringify({}) })
  }
  return <form onSubmit={handleSubmit}>...</form>
}
```

**GOOD** - Server Actions with progressive enhancement:

```typescript
// app/posts/actions.ts
'use server'
import { revalidateTag, updateTag } from 'next/cache'

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string
  await db.posts.create({ data: { title } })
  revalidateTag('posts', 'max') // SWR with cacheLife profile (required in 16)
  return { success: true }
}

// For read-your-writes (user sees changes instantly):
export async function updatePost(id: string, formData: FormData) {
  await db.posts.update({ where: { id }, data: { title: formData.get('title') } })
  updateTag(`post-${id}`) // New in 16: immediate cache expiry
}
```

**GOOD** - Server Actions with useActionState:

```typescript
'use client'
import { useActionState } from 'react'
import { updateProfile } from './actions'

export default function ProfileForm() {
  const [state, formAction, isPending] = useActionState(updateProfile, null)
  return (
    <form action={formAction}>
      <input name="name" />
      {state?.error && <p className="error">{state.error}</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Update'}
      </button>
    </form>
  )
}
```

## Caching APIs (Updated in 16)

**BAD** - Old revalidateTag with single argument (deprecated):

```typescript
revalidateTag('posts') // Deprecated single-arg form
```

**GOOD** - New caching APIs:

```typescript
import { revalidateTag, updateTag, refresh } from 'next/cache'

// SWR revalidation with cacheLife profile
revalidateTag('posts', 'max')       // Background revalidation, serve stale
revalidateTag('news', 'hours')      // Revalidate within hours profile
revalidateTag('data', { expire: 3600 }) // Custom TTL

// Read-your-writes (Server Actions only)
updateTag('user-profile')           // Expire + immediate fresh read

// Refresh uncached data (Server Actions only)
refresh()                           // Refresh dynamic data without touching cache
```

## React 19.2 Features

### View Transitions:

```typescript
'use client'
import { ViewTransition } from 'react'

export default function PhotoGrid({ photos }) {
  return (
    <div className="grid">
      {photos.map(photo => (
        <ViewTransition key={photo.id} name={`photo-${photo.id}`}>
          <Link href={`/photos/${photo.id}`}>
            <img src={photo.url} alt={photo.title} />
          </Link>
        </ViewTransition>
      ))}
    </div>
  )
}
```

### Activity (background rendering):

```typescript
'use client'
import { Activity } from 'react'

export default function TabPanel({ activeTab, tabs }) {
  return (
    <div>
      {tabs.map(tab => (
        <Activity key={tab.id} mode={tab.id === activeTab ? 'visible' : 'hidden'}>
          <TabContent tab={tab} />
        </Activity>
      ))}
    </div>
  )
}
```

## Error Boundaries

```typescript
// app/posts/[id]/error.tsx
'use client'
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <p>{error.message}</p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  )
}

// app/posts/[id]/loading.tsx
export default function Loading() {
  return <div className="skeleton">Loading post...</div>
}

// app/posts/[id]/not-found.tsx
export default function NotFound() {
  return <div>Post not found</div>
}
```

## Parallel Routes

**BAD** - Conditional rendering in one component:

```typescript
export default function Dashboard({ searchParams }) {
  return (
    <div>
      <Sidebar />
      {searchParams.modal === 'settings' && <SettingsModal />}
    </div>
  )
}
```

**GOOD** - Parallel routes with slots (all slots need default.tsx in 16):

```
app/dashboard/
├── @modal/
│   ├── settings/page.tsx
│   ├── profile/page.tsx
│   └── default.tsx          # REQUIRED in 16
├── @sidebar/
│   ├── page.tsx
│   └── default.tsx          # REQUIRED in 16
├── layout.tsx
└── page.tsx
```

```typescript
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children, modal, sidebar,
}: {
  children: React.ReactNode
  modal: React.ReactNode
  sidebar: React.ReactNode
}) {
  return (
    <div className="dashboard">
      <aside>{sidebar}</aside>
      <main>{children}</main>
      {modal}
    </div>
  )
}

// app/dashboard/@modal/default.tsx - REQUIRED
import { notFound } from 'next/navigation'
export default function Default() {
  return null // or notFound()
}
```

## Route Handlers

```typescript
// app/api/posts/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'

const postSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = postSchema.parse(body)
    const post = await db.posts.create({ data: validated })
    return Response.json({ post }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.errors }, { status: 400 })
    }
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Async params in route handlers (required in 16)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const post = await db.posts.findUnique({ where: { id } })
  if (!post) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ post })
}
```

## Procedural Workflow: New Feature

1. **Create route segment** in `app/` with `page.tsx`
2. **Add layout.tsx** if shared UI needed across child routes
3. **Use Server Component** by default, fetch data directly
4. **Add `"use cache"`** directive for pages/components that benefit from caching
5. **Add Suspense boundaries** for slow data fetching
6. **Create loading.tsx** and **error.tsx** for each route
7. **Add Server Actions** in `actions.ts` for mutations (use `updateTag` for read-your-writes)
8. **Add proxy.ts** if auth/redirects needed (not middleware.ts)
9. **Add default.tsx** to all parallel route slots
10. **Enable Turbopack FS caching** for large projects (`turbopackFileSystemCacheForDev`)

## Turbopack Configuration

```typescript
// next.config.ts
const nextConfig = {
  // Turbopack is default in 16, no config needed
  // To use webpack instead:
  // webpack: true, // or run: next dev --webpack

  // Enable filesystem caching (beta) for faster restarts
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },

  // React Compiler (stable in 16, opt-in)
  reactCompiler: true,

  // Cache Components
  cacheComponents: true,
}
export default nextConfig
```

Use `proxy.ts` instead of `middleware.ts`. All params are async. All parallel slots need `default.tsx`. Use `"use cache"` instead of `experimental.ppr`. Turbopack is default.
