---
name: seo-meta
description: Generate SEO metadata, Open Graph tags, JSON-LD structured data, sitemaps, and dynamic OG images for Next.js applications
user-invokable: true
---

# SEO Meta Skill

Implement modern SEO patterns using Next.js Metadata API, structured data, and dynamic meta tag generation.

## Next.js Metadata API

BAD: Manual meta tags with duplicates and missing canonical.

```tsx
export default function BlogPost() {
  return (
    <>
      <head>
        <title>My Blog Post</title>
        <meta name="description" content="Post content" />
        {/* missing canonical, og tags, twitter cards */}
      </head>
    </>
  );
}
```

GOOD: Use `generateMetadata` with complete meta tags.

```tsx
import { Metadata } from 'next';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug);
  const url = `https://example.com/blog/${params.slug}`;
  const ogImage = `/api/og?title=${encodeURIComponent(post.title)}`;

  return {
    title: post.title,
    description: post.excerpt,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url,
      siteName: 'My Site',
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: 'article',
      publishedTime: post.publishedAt,
    },
    twitter: { card: 'summary_large_image', images: [ogImage] },
    alternates: { canonical: url },
  };
}
```

## JSON-LD Structured Data

BAD: Invalid JSON and wrong schema types.

```tsx
<script type="application/ld+json">
  {{ name: "Product", price: "$99.99" }} {/* missing @context, wrong types */}
</script>
```

GOOD: Type-safe JSON-LD with proper schema.org vocabulary.

```tsx
// lib/structured-data.ts
import { WithContext } from 'schema-dts';

export function createArticleSchema(article: {
  title: string; author: string; publishedAt: string; url: string;
}): WithContext<'Article'> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    datePublished: article.publishedAt,
    author: { '@type': 'Person', name: article.author },
    publisher: {
      '@type': 'Organization',
      name: 'My Site',
      logo: { '@type': 'ImageObject', url: 'https://example.com/logo.png' },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': article.url },
  };
}

export function createProductSchema(product: {
  name: string; price: number; currency: string; availability: string;
}): WithContext<'Product'> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    offers: {
      '@type': 'Offer',
      price: product.price.toFixed(2),
      priceCurrency: product.currency,
      availability: `https://schema.org/${product.availability}`,
    },
  };
}

// Usage
export default function BlogPost({ article }: Props) {
  const schema = createArticleSchema(article);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <article>{/* content */}</article>
    </>
  );
}
```

## Dynamic OG Images

BAD: Hardcoded static image for all pages.

```tsx
export async function generateMetadata(): Promise<Metadata> {
  return { openGraph: { images: ['/static-og.png'] } }; // same everywhere
}
```

GOOD: Generate dynamic OG images using @vercel/og.

```tsx
// app/api/og/route.tsx
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  const title = new URL(request.url).searchParams.get('title') || 'Default';

  return new ImageResponse(
    (
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        width: '100%', height: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '80px',
      }}>
        <div style={{ fontSize: 60, fontWeight: 'bold', color: 'white' }}>
          {title}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```

## Sitemap and Robots.txt

BAD: Static XML file that never updates.

```xml
<!-- public/sitemap.xml -->
<urlset><url><loc>https://example.com/blog/post-1</loc></url></urlset>
```

GOOD: Dynamic sitemap and robots.txt.

```tsx
// app/sitemap.ts
import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://example.com';
  const routes = ['', '/about'].map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'monthly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  const posts = await getAllPosts();
  const postRoutes = posts.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...routes, ...postRoutes];
}

// app/robots.ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/admin/'] },
      { userAgent: 'GPTBot', disallow: ['/'] },
    ],
    sitemap: 'https://example.com/sitemap.xml',
  };
}
```

## Canonical URLs and Meta Priority

Canonical URL workflow:

1. Identify page type: static, dynamic, paginated, duplicate
2. Set canonical in `generateMetadata` using `alternates.canonical`
3. For paginated content, point to current page
4. For duplicate content, point to original
5. Always use absolute URLs

```tsx
// app/blog/page.tsx (paginated)
export async function generateMetadata({
  searchParams,
}: {
  searchParams: { page?: string };
}): Promise<Metadata> {
  const page = Number(searchParams.page) || 1;
  const base = 'https://example.com/blog';
  return {
    alternates: { canonical: page === 1 ? base : `${base}?page=${page}` },
  };
}

// app/blog/[slug]/print/page.tsx (duplicate)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    alternates: { canonical: `https://example.com/blog/${params.slug}` },
    robots: { index: false },
  };
}
```

Meta tag priority (highest first): Page `generateMetadata` > Parent layout > Root layout > Manual `<meta>`.

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  title: { default: 'My Site', template: '%s | My Site' },
};

// app/blog/[slug]/page.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug);
  return { title: post.title }; // becomes "Post Title | My Site"
}
```

## Core Web Vitals Optimization

BAD: Blocking resources, unoptimized images.

```tsx
export default function Page() {
  return (
    <>
      <script src="https://example.com/heavy.js" /> {/* blocks render */}
      <img src="/hero.jpg" width={1200} /> {/* no optimization */}
    </>
  );
}
```

GOOD: Preload critical resources, optimize images.

```tsx
import Image from 'next/image';
import Script from 'next/script';

export default function Page() {
  return (
    <>
      <link rel="preload" href="/fonts/main.woff2" as="font" crossOrigin="" />
      <Script src="https://example.com/analytics.js" strategy="afterInteractive" />
      <Image src="/hero.jpg" width={1200} height={800} alt="Hero" priority />
    </>
  );
}

// Preconnect in layout
export const metadata: Metadata = {
  other: {
    'link-preconnect': 'https://fonts.googleapis.com',
    'link-dns-prefetch': 'https://analytics.example.com',
  },
};
```

## Implementation Workflow

1. Use `generateMetadata` for all meta tags (no manual `<meta>`)
2. Include Open Graph and Twitter Card tags with dynamic OG images
3. Add JSON-LD structured data (Article, Product, FAQ, Organization)
4. Generate dynamic sitemap.ts that updates with content
5. Configure robots.ts with proper allow/disallow rules
6. Set canonical URLs for all pages (especially paginated/duplicate)
7. Use title templates in layouts for consistent branding
8. Optimize Core Web Vitals: preload fonts, defer scripts, use next/image
9. Test with Google Rich Results Test and Search Console
