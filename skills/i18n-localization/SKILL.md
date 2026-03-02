---
name: i18n-localization
description: Internationalization and localization for web applications. Handles next-intl, react-intl, ICU MessageFormat, RTL layouts, and dynamic locale loading.
user-invokable: true
---

# i18n-localization

Internationalization (i18n) and localization (l10n) for web applications. Implements proper message formatting, locale routing, RTL support, and dynamic translation loading.

## Translation File Structure

**BAD: Flat structure, mixed namespaces**
```json
// messages/en.json
{
  "welcomeMessage": "Welcome",
  "homePageTitle": "Home",
  "userProfileName": "Name",
  "userProfileEmail": "Email",
  "checkoutButtonSubmit": "Submit Order"
}
```

**GOOD: Namespaced structure**
```json
// messages/en/common.json
{
  "welcome": "Welcome",
  "loading": "Loading...",
  "error": "An error occurred"
}

// messages/en/home.json
{
  "title": "Home",
  "hero": {
    "heading": "Welcome to our platform",
    "subheading": "Build amazing things"
  }
}

// messages/en/user.json
{
  "profile": {
    "name": "Name",
    "email": "Email",
    "updatedAt": "Last updated {date}"
  }
}
```

## ICU MessageFormat - Plurals and Select

**BAD: String concatenation**
```typescript
// DON'T: Breaks in many languages
const message = count === 1
  ? `You have ${count} message`
  : `You have ${count} messages`;

// DON'T: No gender agreement support
const greeting = gender === 'male' ? `Welcome, Mr. ${name}` : `Welcome, Ms. ${name}`;
```

**GOOD: ICU MessageFormat**
```json
{
  "messages": {
    "count": "{count, plural, =0 {No messages} one {# message} other {# messages}}"
  },
  "greeting": {
    "formal": "{gender, select, male {Welcome, Mr. {name}} female {Welcome, Ms. {name}} other {Welcome, {name}}}"
  },
  "cart": {
    "items": "{itemCount, plural, =0 {Your cart is empty} one {# item in cart} other {# items in cart}}",
    "total": "{total, number, ::currency/USD}"
  }
}
```

```typescript
// Usage with react-intl
import { useIntl } from 'react-intl';

function MessageCount({ count }: { count: number }) {
  const intl = useIntl();
  return <p>{intl.formatMessage({ id: 'messages.count' }, { count })}</p>;
}
```

## Next.js 16 with next-intl

**BAD: Client-side only, no routing**
```typescript
// app/page.tsx - DON'T
'use client';
import { useState } from 'react';

export default function Page() {
  const [locale, setLocale] = useState('en');
  const messages = require(`@/messages/${locale}.json`);

  return <div>{messages.welcome}</div>;
}
```

**GOOD: Server-side with middleware routing**
```typescript
// i18n.ts
import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'es', 'fr', 'ar'] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ locale }) => {
  if (!locales.includes(locale as Locale)) notFound();

  return {
    messages: (await import(`./messages/${locale}.json`)).default
  };
});

// middleware.ts
import createMiddleware from 'next-intl/middleware';
import { locales } from './i18n';

export default createMiddleware({
  locales,
  defaultLocale: 'en',
  localePrefix: 'always' // /en/about, /es/about
});

export const config = {
  matcher: ['/', '/(en|es|fr|ar)/:path*']
};

// app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/i18n';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!locales.includes(locale as any)) notFound();

  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

// app/[locale]/page.tsx
import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('home');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('hero.heading')}</p>
    </div>
  );
}
```

## Date and Number Formatting

**BAD: Hardcoded formats**
```typescript
// DON'T: Breaks internationalization
const date = new Date().toLocaleDateString('en-US');
const price = `$${amount.toFixed(2)}`;
const percent = `${(value * 100).toFixed(1)}%`;
```

**GOOD: Intl API**
```typescript
import { useIntl } from 'react-intl';

function ProductCard({ price, date, discount }: Props) {
  const intl = useIntl();

  // Date formatting
  const formattedDate = intl.formatDate(date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Currency formatting
  const formattedPrice = intl.formatNumber(price, {
    style: 'currency',
    currency: 'USD'
  });

  // Percentage formatting
  const formattedDiscount = intl.formatNumber(discount, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  });

  return (
    <div>
      <p>{formattedPrice}</p>
      <p>{formattedDiscount} off</p>
      <time>{formattedDate}</time>
    </div>
  );
}

// Or use native Intl API directly
const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'full',
  timeStyle: 'short'
});

const numberFormatter = new Intl.NumberFormat('de-DE', {
  style: 'decimal',
  minimumFractionDigits: 2
});

console.log(dateFormatter.format(new Date())); // "domingo, 2 de marzo de 2026, 14:30"
console.log(numberFormatter.format(1234.5)); // "1.234,50"
```

## RTL Layout Support

**BAD: Hardcoded left/right**
```css
/* DON'T: Breaks in RTL languages */
.sidebar {
  float: left;
  margin-right: 20px;
  text-align: left;
}

.arrow {
  padding-left: 10px;
}
```

**GOOD: Logical properties**
```css
/* Use logical properties */
.sidebar {
  float: inline-start;
  margin-inline-end: 20px;
  text-align: start;
}

.arrow {
  padding-inline-start: 10px;
}

/* Or use Tailwind RTL utilities */
.element {
  @apply ms-4 me-2; /* margin-start, margin-end */
  @apply ps-4 pe-2; /* padding-start, padding-end */
}

/* RTL-specific overrides */
[dir="rtl"] .custom-element {
  transform: scaleX(-1); /* Flip icons */
}
```

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {}
  },
  plugins: [
    require('tailwindcss-logical')
  ]
};

export default config;
```

## Dynamic Locale Loading

**BAD: Load all locales upfront**
```typescript
// DON'T: Bundles all translations
import en from './messages/en.json';
import es from './messages/es.json';
import fr from './messages/fr.json';
import ar from './messages/ar.json';

const messages = { en, es, fr, ar };
```

**GOOD: Dynamic imports**
```typescript
// lib/i18n.ts
export async function loadMessages(locale: string) {
  try {
    const messages = await import(`@/messages/${locale}.json`);
    return messages.default;
  } catch (error) {
    console.error(`Failed to load messages for locale: ${locale}`);
    return import('@/messages/en.json').then(m => m.default);
  }
}

// For large translation files, split by namespace
export async function loadNamespace(locale: string, namespace: string) {
  const messages = await import(`@/messages/${locale}/${namespace}.json`);
  return messages.default;
}

// app/[locale]/dashboard/page.tsx
import { loadNamespace } from '@/lib/i18n';

export default async function DashboardPage({ params }: Props) {
  const messages = await loadNamespace(params.locale, 'dashboard');

  return <NextIntlClientProvider messages={messages}>
    {/* Dashboard content */}
  </NextIntlClientProvider>;
}
```

## Language Detection and Switching

**BAD: Manual cookie management**
```typescript
// DON'T: Unreliable, no fallback
'use client';
import { useRouter } from 'next/navigation';

function LangSwitcher() {
  const router = useRouter();

  const changeLocale = (locale: string) => {
    document.cookie = `locale=${locale}`;
    router.refresh();
  };

  return <button onClick={() => changeLocale('es')}>Español</button>;
}
```

**GOOD: next-intl locale switching**
```typescript
// components/LocaleSwitcher.tsx
'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { locales } from '@/i18n';

export function LocaleSwitcher() {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const changeLocale = (newLocale: string) => {
    // Replace locale in pathname
    const segments = pathname.split('/');
    segments[1] = newLocale;
    router.push(segments.join('/'));
  };

  return (
    <select
      value={locale}
      onChange={(e) => changeLocale(e.target.value)}
      aria-label={t('selectLanguage')}
    >
      {locales.map((loc) => (
        <option key={loc} value={loc}>
          {t(`locales.${loc}`)}
        </option>
      ))}
    </select>
  );
}

// With content negotiation fallback
// middleware.ts
import createMiddleware from 'next-intl/middleware';
import { locales } from './i18n';

export default createMiddleware({
  locales,
  defaultLocale: 'en',
  localeDetection: true, // Uses Accept-Language header
  localePrefix: 'as-needed' // Only add prefix for non-default locales
});
```

## Type-Safe Translations

**BAD: String keys, runtime errors**
```typescript
// DON'T: Typos cause runtime errors
const title = t('home.titel'); // Typo: "titel" instead of "title"
const message = t('user.proifle.name'); // Typo: "proifle"
```

**GOOD: Generated types**
```typescript
// scripts/generate-types.ts
import fs from 'fs';
import path from 'path';

function generateTypes() {
  const enMessages = JSON.parse(
    fs.readFileSync('./messages/en.json', 'utf-8')
  );

  const types = generateTypeFromObject(enMessages);

  fs.writeFileSync(
    './types/messages.d.ts',
    `export type Messages = ${types};`
  );
}

// types/messages.d.ts (generated)
export type Messages = {
  common: {
    welcome: string;
    loading: string;
  };
  home: {
    title: string;
    hero: {
      heading: string;
      subheading: string;
    };
  };
  user: {
    profile: {
      name: string;
      email: string;
    };
  };
};

// Usage with type safety
import { useTranslations } from 'next-intl';

function HomePage() {
  const t = useTranslations('home');

  // TypeScript autocomplete and validation
  return <h1>{t('title')}</h1>; // ✓
  // return <h1>{t('titel')}</h1>; // ✗ TypeScript error
}
```

## Common Patterns

### Pluralization with Complex Rules
```json
{
  "items": {
    "selected": "{count, plural, =0 {No items selected} one {# item selected} other {# items selected}}",
    "remaining": "{count, plural, =0 {All done!} one {# item left} other {# items left}}"
  }
}
```

### Rich Text Formatting
```typescript
// messages/en.json
{
  "terms": "By signing up, you agree to our <link>Terms of Service</link>"
}

// Component
import { useTranslations } from 'next-intl';
import Link from 'next/link';

function SignupForm() {
  const t = useTranslations('auth');

  return (
    <p>
      {t.rich('terms', {
        link: (chunks) => <Link href="/terms">{chunks}</Link>
      })}
    </p>
  );
}
```

### Server Component Translations
```typescript
// app/[locale]/about/page.tsx
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: Props) {
  const t = await getTranslations({ locale: params.locale, namespace: 'about' });

  return {
    title: t('metaTitle'),
    description: t('metaDescription')
  };
}

export default async function AboutPage({ params }: Props) {
  const t = await getTranslations({ locale: params.locale, namespace: 'about' });

  return <h1>{t('title')}</h1>;
}
```

Apply these patterns to build robust, scalable internationalization in web applications.
