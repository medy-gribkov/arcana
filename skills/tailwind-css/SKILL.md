---
name: tailwind-css
description: Apply Tailwind CSS v4 patterns, custom plugins, responsive design, dark mode, cn() utility, and performance optimization. Avoid common anti-patterns.
user-invokable: true
---

# Tailwind CSS Skill

## Core Configuration (v4)

**BAD: Mixing inline styles with Tailwind**
```tsx
// C:\Users\Dev\components\Button.tsx
export function Button() {
  return (
    <button
      style={{ padding: '12px 24px' }}
      className="bg-blue-500"
    >
      Click me
    </button>
  );
}
```

**GOOD: Pure Tailwind with custom design tokens**
```tsx
// C:\Users\Dev\components\Button.tsx
export function Button() {
  return (
    <button className="px-6 py-3 bg-blue-500 hover:bg-blue-600 transition-colors">
      Click me
    </button>
  );
}

// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      colors: {
        brand: {
          50: '#f0f9ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
      },
    },
  },
} satisfies Config;
```

## cn() Utility Pattern

**BAD: String concatenation without proper merging**
```tsx
// C:\Users\Dev\components\Card.tsx
interface CardProps {
  className?: string;
  variant?: 'default' | 'outlined';
}

export function Card({ className, variant = 'default' }: CardProps) {
  const baseClasses = 'p-4 rounded-lg';
  const variantClasses = variant === 'default'
    ? 'bg-white shadow'
    : 'border border-gray-300';

  // Problem: conflicting classes not merged properly
  return <div className={`${baseClasses} ${variantClasses} ${className}`} />;
}

// Usage causes conflicts
<Card className="p-8 bg-blue-50" /> // p-8 and bg-blue-50 don't override properly
```

**GOOD: Proper cn() with clsx and tailwind-merge**
```tsx
// C:\Users\Dev\lib\utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// C:\Users\Dev\components\Card.tsx
import { cn } from '@/lib/utils';

interface CardProps {
  className?: string;
  variant?: 'default' | 'outlined';
}

export function Card({ className, variant = 'default' }: CardProps) {
  return (
    <div
      className={cn(
        'p-4 rounded-lg',
        variant === 'default' && 'bg-white shadow',
        variant === 'outlined' && 'border border-gray-300',
        className
      )}
    />
  );
}

// Usage properly overrides
<Card className="p-8 bg-blue-50" /> // p-8 and bg-blue-50 override correctly
```

## Responsive Design Patterns

**BAD: Mobile-last with max-width breakpoints**
```tsx
// C:\Users\Dev\components\Grid.tsx
export function Grid() {
  return (
    <div className="grid-cols-4 md:grid-cols-2 sm:grid-cols-1">
      {/* Content */}
    </div>
  );
}
```

**GOOD: Mobile-first progressive enhancement**
```tsx
// C:\Users\Dev\components\Grid.tsx
export function Grid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {/* Content */}
    </div>
  );
}

// Custom breakpoint configuration
// tailwind.config.ts
export default {
  theme: {
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
  },
} satisfies Config;
```

## Dark Mode Implementation

**BAD: Manual dark mode with separate classes**
```tsx
// C:\Users\Dev\components\Panel.tsx
export function Panel({ isDark }: { isDark: boolean }) {
  return (
    <div className={isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}>
      Content
    </div>
  );
}
```

**GOOD: Class-based dark mode with system preference**
```tsx
// tailwind.config.ts
export default {
  darkMode: 'class', // or 'media' for system preference only
  // ...
} satisfies Config;

// C:\Users\Dev\components\Panel.tsx
export function Panel() {
  return (
    <div className="bg-white text-gray-900 dark:bg-gray-900 dark:text-white">
      Content
    </div>
  );
}

// C:\Users\Dev\app\layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

## Custom Plugin Development

**BAD: Repetitive utility classes**
```tsx
// C:\Users\Dev\components\GlassCard.tsx
export function GlassCard() {
  return (
    <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-lg shadow-xl">
      Content
    </div>
  );
}

// Used in 20+ places with same pattern
```

**GOOD: Custom plugin for reusable patterns**
```ts
// tailwind.config.ts
import plugin from 'tailwindcss/plugin';

export default {
  plugins: [
    plugin(function({ addUtilities, addComponents, theme }) {
      addUtilities({
        '.glass': {
          'backdrop-filter': 'blur(12px)',
          'background-color': 'rgba(255, 255, 255, 0.1)',
          'border': '1px solid rgba(255, 255, 255, 0.2)',
        },
        '.glass-dark': {
          'backdrop-filter': 'blur(12px)',
          'background-color': 'rgba(0, 0, 0, 0.1)',
          'border': '1px solid rgba(0, 0, 0, 0.2)',
        },
      });

      addComponents({
        '.btn-primary': {
          padding: `${theme('spacing.2')} ${theme('spacing.4')}`,
          borderRadius: theme('borderRadius.lg'),
          backgroundColor: theme('colors.blue.500'),
          color: theme('colors.white'),
          '&:hover': {
            backgroundColor: theme('colors.blue.600'),
          },
        },
      });
    }),
  ],
} satisfies Config;

// C:\Users\Dev\components\GlassCard.tsx
export function GlassCard() {
  return <div className="glass rounded-lg shadow-xl">Content</div>;
}
```

## Anti-Pattern: @apply Overuse

**BAD: CSS file full of @apply**
```css
/* C:\Users\Dev\styles\components.css */
.button {
  @apply px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors;
}

.card {
  @apply p-6 bg-white rounded-lg shadow-md dark:bg-gray-800;
}

.input {
  @apply w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500;
}

/* Defeats Tailwind's purpose, loses composability */
```

**GOOD: Component abstraction with Tailwind classes**
```tsx
// C:\Users\Dev\components\ui\Button.tsx
import { cn } from '@/lib/utils';
import { type VariantProps, cva } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-blue-500 text-white hover:bg-blue-600',
        outline: 'border border-gray-300 bg-transparent hover:bg-gray-100',
        ghost: 'hover:bg-gray-100',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4',
        lg: 'h-11 px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
```

## Animation Utilities

**BAD: Custom CSS animations without tokens**
```css
/* C:\Users\Dev\styles\animations.css */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in {
  animation: fadeIn 0.5s ease-in;
}
```

**GOOD: Tailwind animation configuration**
```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'shimmer': 'shimmer 2s infinite linear',
      },
    },
  },
} satisfies Config;

// C:\Users\Dev\components\Skeleton.tsx
export function Skeleton() {
  return (
    <div className="relative overflow-hidden rounded bg-gray-200 dark:bg-gray-800">
      <div className="animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}
```

## Performance: JIT and Content Configuration

**BAD: Scanning too many files**
```ts
// tailwind.config.ts
export default {
  content: [
    './**/*.{js,ts,jsx,tsx}', // Scans node_modules, .git, etc.
  ],
} satisfies Config;
```

**GOOD: Precise content paths with safelist**
```ts
// tailwind.config.ts
export default {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/lib/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    // Dynamic classes that might be missed
    'bg-red-500',
    'bg-green-500',
    'bg-blue-500',
    {
      pattern: /bg-(red|green|blue)-(400|500|600)/,
      variants: ['hover', 'dark'],
    },
  ],
} satisfies Config;

// C:\Users\Dev\components\Alert.tsx
const colorMap = {
  error: 'bg-red-500',
  success: 'bg-green-500',
  info: 'bg-blue-500',
} as const;

// Safelisted ensures these dynamic classes aren't purged
export function Alert({ type }: { type: keyof typeof colorMap }) {
  return <div className={colorMap[type]}>Alert</div>;
}
```

## Container Queries

**BAD: Media queries for component-level responsiveness**
```tsx
// C:\Users\Dev\components\Card.tsx
export function Card() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h2 className="text-lg md:text-xl lg:text-2xl">Title</h2>
    </div>
  );
}
// Breaks when card is in narrow sidebar on large screen
```

**GOOD: Container queries for true component responsiveness**
```ts
// tailwind.config.ts
export default {
  plugins: [
    require('@tailwindcss/container-queries'),
  ],
} satisfies Config;

// C:\Users\Dev\components\Card.tsx
export function Card() {
  return (
    <div className="@container">
      <div className="p-4 @md:p-6 @lg:p-8">
        <h2 className="text-lg @md:text-xl @lg:text-2xl">Title</h2>
      </div>
    </div>
  );
}
```

## Arbitrary Values and CSS Variables

**BAD: Hardcoded magic values**
```tsx
// C:\Users\Dev\components\Hero.tsx
export function Hero() {
  return (
    <section className="h-[calc(100vh-64px)] pt-[72px]">
      Content
    </section>
  );
}
```

**GOOD: CSS variables with Tailwind arbitrary values**
```css
/* C:\Users\Dev\styles\globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --header-height: 64px;
    --content-padding: 72px;
  }
}
```

```tsx
// C:\Users\Dev\components\Hero.tsx
export function Hero() {
  return (
    <section className="h-[calc(100vh-var(--header-height))] pt-[var(--content-padding)]">
      Content
    </section>
  );
}
```

## Form Patterns with Focus States

**GOOD: Accessible form components with proper focus**
```tsx
// C:\Users\Dev\components\ui\Input.tsx
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export function Input({ className, error, ...props }: InputProps) {
  return (
    <div className="space-y-1">
      <input
        className={cn(
          'w-full rounded-lg border bg-white px-3 py-2 text-sm',
          'transition-colors placeholder:text-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'dark:bg-gray-900 dark:border-gray-700',
          error && 'border-red-500 focus:ring-red-500',
          className
        )}
        {...props}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
```

## Workflow: Apply This Skill

1. **Audit className usage**: Search for string concatenation without cn()
2. **Check @apply usage**: Refactor CSS files into component abstractions
3. **Verify content paths**: Ensure tailwind.config.ts scans only source files
4. **Test dark mode**: Verify dark: variants work across all components
5. **Review responsive design**: Confirm mobile-first breakpoint usage
6. **Validate animations**: Check keyframes are in config, not separate CSS
7. **Check dynamic classes**: Add patterns to safelist if computed at runtime
8. **Performance check**: Run `npm run build` and verify CSS bundle size

## Installation Commands

```bash
# Install Tailwind CSS v4
npm install -D tailwindcss@next @tailwindcss/postcss@next

# Install utilities
npm install clsx tailwind-merge class-variance-authority

# Install official plugins
npm install -D @tailwindcss/forms @tailwindcss/typography @tailwindcss/container-queries
```

## Common Fixes

**Fix: Tailwind classes not applying**
- Check content paths in tailwind.config.ts include the file
- Verify PostCSS config includes tailwindcss plugin
- Clear .next cache: `rm -rf .next`
- Check class isn't being overridden by CSS specificity

**Fix: Dynamic classes not working**
- Add pattern to safelist in tailwind.config.ts
- Use complete class strings, not template literals with partial classes
- Bad: `text-${color}-500` | Good: colorMap object with full class names

**Fix: Dark mode not switching**
- Verify darkMode: 'class' in config
- Check html element has 'dark' class applied
- Ensure dark: variants are on affected elements
