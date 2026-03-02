---
name: vercel-deploy
description: Deploy to Vercel with edge functions, ISR, middleware, and proper caching. Use when deploying Next.js apps, configuring preview environments, or optimizing Vercel builds.
user-invokable: true
---

# Vercel Deployment Skill

## Core Concept

Deploy applications to Vercel with proper runtime selection, caching strategies, and environment configuration. Edge Functions run at CDN edge nodes for low latency (under 50ms cold start), Serverless Functions run in regional data centers (up to 10s execution).

## vercel.json Configuration

**BAD: Kitchen sink configuration**
```json
{
  "functions": {
    "api/**/*.js": {
      "runtime": "nodejs18.x",
      "maxDuration": 10
    }
  },
  "headers": [],
  "rewrites": []
}
```

**GOOD: Targeted runtime and caching**
```json
{
  "functions": {
    "api/slow-process.ts": {
      "runtime": "nodejs20.x",
      "maxDuration": 60,
      "memory": 1024
    }
  },
  "headers": [
    {
      "source": "/api/static-data",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "s-maxage=3600, stale-while-revalidate=86400"
        }
      ]
    }
  ],
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 0 * * *"
    }
  ]
}
```

## Edge vs Serverless Selection

**BAD: Everything as serverless**
```typescript
// app/api/geo/route.ts
export async function GET(request: Request) {
  // Runs in us-east-1 every time, slow for global users
  const country = request.headers.get('x-forwarded-for')
  return Response.json({ country })
}
```

**GOOD: Edge for geo/auth, serverless for heavy compute**
```typescript
// app/api/geo/route.ts
export const runtime = 'edge'

export async function GET(request: Request) {
  const country = request.headers.get('x-vercel-ip-country')
  const city = request.headers.get('x-vercel-ip-city')
  return Response.json({ country, city })
}

// app/api/process-video/route.ts
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes, requires Pro plan

export async function POST(request: Request) {
  const formData = await request.formData()
  // Heavy video processing requires serverless
  const result = await processVideo(formData)
  return Response.json(result)
}
```

## Middleware for Auth and Geo-Routing

**BAD: Auth in every route**
```typescript
// app/api/protected/route.ts
import { verify } from 'jsonwebtoken'

export async function GET(request: Request) {
  const token = request.headers.get('authorization')
  try {
    verify(token, process.env.JWT_SECRET)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Protected logic
}
```

**GOOD: Middleware at edge for auth and geo**
```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const config = {
  matcher: ['/api/protected/:path*', '/dashboard/:path*']
}

export function middleware(request: NextRequest) {
  // Runs at edge, low latency globally
  const token = request.cookies.get('session')?.value
  const country = request.geo?.country

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Geo-block sanctioned countries
  if (['CU', 'IR', 'KP', 'SY'].includes(country || '')) {
    return NextResponse.json(
      { error: 'Service unavailable in your region' },
      { status: 451 }
    )
  }

  // Add custom headers for downstream routes
  const response = NextResponse.next()
  response.headers.set('x-user-country', country || 'unknown')
  return response
}
```

## Environment Variables Strategy

**BAD: Hardcoded secrets, no environment separation**
```typescript
// lib/config.ts
export const config = {
  apiKey: 'sk_live_abc123', // NEVER hardcode
  dbUrl: process.env.DATABASE_URL // Same DB for preview and production
}
```

**GOOD: Environment-specific variables**
```typescript
// lib/config.ts
export const config = {
  apiKey: process.env.API_KEY!, // Set in Vercel dashboard
  dbUrl: process.env.DATABASE_URL!,
  isProduction: process.env.VERCEL_ENV === 'production',
  isPreview: process.env.VERCEL_ENV === 'preview',
  deploymentUrl: process.env.VERCEL_URL
}

// Vercel dashboard environment settings:
// API_KEY (production): sk_live_abc123
// API_KEY (preview): sk_test_xyz789
// DATABASE_URL (production): postgres://prod.db
// DATABASE_URL (preview): postgres://staging.db
```

Vercel automatically provides: `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`.

## Preview Deployments Workflow

Every git push to non-production branch creates preview deployment:

```bash
# Automatic preview on PR
git checkout -b feature/new-ui
git push origin feature/new-ui
# Vercel creates: https://myapp-git-feature-new-ui-user.vercel.app

# Preview-specific env vars for testing
# Set in Vercel dashboard: ENABLE_FEATURE_FLAG=true (preview only)
```

**Workflow for preview comments:**
```typescript
// app/api/comments/route.ts
export async function POST(request: Request) {
  const isPreview = process.env.VERCEL_ENV === 'preview'

  if (isPreview) {
    // Use test Stripe key, mock email service
    return Response.json({
      success: true,
      note: 'Preview mode, no real charges'
    })
  }

  // Production logic with real services
  const result = await stripe.charges.create({...})
  return Response.json(result)
}
```

## Caching Headers and ISR

**BAD: No caching, every request hits origin**
```typescript
// app/blog/[slug]/page.tsx
export default async function BlogPost({ params }) {
  const post = await fetchPost(params.slug)
  return <article>{post.content}</article>
}
```

**GOOD: ISR with on-demand revalidation**
```typescript
// app/blog/[slug]/page.tsx
export const revalidate = 3600 // ISR: regenerate after 1 hour

export async function generateStaticParams() {
  const posts = await fetchAllPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export default async function BlogPost({ params }) {
  const post = await fetchPost(params.slug)
  return <article>{post.content}</article>
}

// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  const { slug, secret } = await request.json()

  if (secret !== process.env.REVALIDATION_SECRET) {
    return Response.json({ error: 'Invalid secret' }, { status: 401 })
  }

  revalidatePath(`/blog/${slug}`)
  return Response.json({ revalidated: true })
}
```

**GOOD: API route caching with stale-while-revalidate**
```typescript
// app/api/stats/route.ts
export async function GET() {
  const stats = await fetchStats()

  return Response.json(stats, {
    headers: {
      'Cache-Control': 's-maxage=60, stale-while-revalidate=300'
      // Cache for 60s, serve stale for 5min while revalidating
    }
  })
}
```

## Image Optimization

**BAD: Unoptimized images**
```jsx
<img src="/hero.png" alt="Hero" /> {/* Serves original 5MB PNG */}
```

**GOOD: next/image with formats and sizes**
```jsx
import Image from 'next/image'

// next.config.js
module.exports = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.example.com',
        pathname: '/images/**'
      }
    ]
  }
}

// Component
<Image
  src="/hero.png"
  alt="Hero"
  width={1200}
  height={600}
  priority
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

## Monorepo Setup

**GOOD: Turborepo with Vercel**
```json
// vercel.json (root)
{
  "buildCommand": "turbo run build --filter=web",
  "outputDirectory": "apps/web/.next",
  "installCommand": "pnpm install"
}

// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    }
  }
}

// apps/web/package.json
{
  "name": "web",
  "scripts": {
    "build": "next build"
  }
}
```

## Build Optimization

**BAD: No output file tracing**
```javascript
// next.config.js
module.exports = {
  // Default includes all node_modules in function bundles
}
```

**GOOD: Output file tracing and standalone build**
```javascript
// next.config.js
module.exports = {
  output: 'standalone', // Only includes necessary files
  experimental: {
    outputFileTracingRoot: require('path').join(__dirname, '../../')
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize large dependencies
      config.externals.push('canvas', 'bufferutil', 'utf-8-validate')
    }
    return config
  }
}
```

## Custom Domains and SSL

```bash
# Add custom domain (Vercel dashboard or CLI)
vercel domains add example.com
vercel domains add www.example.com

# DNS records (automatic with Vercel nameservers):
# A record: @ -> 76.76.21.21
# CNAME: www -> cname.vercel-dns.com

# SSL is automatic, renews via Let's Encrypt
```

## Analytics and Speed Insights

**GOOD: Integrate Vercel Analytics**
```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}

// package.json
{
  "dependencies": {
    "@vercel/analytics": "^1.1.1",
    "@vercel/speed-insights": "^1.0.2"
  }
}
```

## Deployment Commands

```bash
# Install Vercel CLI
npm i -g vercel

# Initial setup (links project)
vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Set environment variable
vercel env add API_KEY production
vercel env add API_KEY preview

# Pull environment variables locally
vercel env pull .env.local

# Check deployment logs
vercel logs https://myapp-abc123.vercel.app

# List deployments
vercel ls

# Promote preview to production
vercel promote https://myapp-git-feature.vercel.app
```

## Common Deployment Checks

Before deploying:
1. Run `next build` locally to catch build errors
2. Check bundle size: `npx @next/bundle-analyzer`
3. Verify environment variables are set in Vercel dashboard
4. Test middleware logic doesn't block legitimate traffic
5. Ensure ISR paths are properly configured
6. Validate edge runtime compatibility (no Node.js APIs like `fs`)

Edge runtime restrictions:
- No `fs`, `child_process`, `crypto` (use `crypto.subtle`)
- Max 1MB per edge function after compression
- No native modules or binaries

## Troubleshooting

**Error: Function exceeds maximum size**
Solution: Use `output: 'standalone'` and externalize large deps.

**Error: Middleware blocking all traffic**
Solution: Check `matcher` config, ensure auth logic has fallback.

**Slow cold starts on serverless**
Solution: Switch to edge runtime or reduce dependencies.

**Preview using production database**
Solution: Set environment-specific `DATABASE_URL` for preview environment.
