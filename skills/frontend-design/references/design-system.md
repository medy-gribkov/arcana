# Design System Reference

Design tokens, component API patterns, responsive breakpoints, and accessibility checklist for production frontends.

## Design Token Structure

```css
:root {
  /* ── Color Primitives ── */
  --gray-50: #fafafa;
  --gray-100: #f5f5f5;
  --gray-200: #e5e5e5;
  --gray-700: #404040;
  --gray-800: #262626;
  --gray-900: #171717;
  --gray-950: #0a0a0a;

  /* ── Semantic Colors ── */
  --color-bg: var(--gray-950);
  --color-surface: var(--gray-900);
  --color-surface-raised: var(--gray-800);
  --color-text: var(--gray-100);
  --color-text-muted: var(--gray-200);
  --color-border: var(--gray-700);
  --color-primary: #d4943a;
  --color-accent: #ff6b35;
  --color-success: #22c55e;
  --color-warning: #eab308;
  --color-error: #ef4444;

  /* ── Typography Scale (modular: 1.25 ratio) ── */
  --text-xs: 0.75rem;     /* 12px */
  --text-sm: 0.875rem;    /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg: 1.25rem;     /* 20px */
  --text-xl: 1.563rem;    /* 25px */
  --text-2xl: 1.953rem;   /* 31px */
  --text-3xl: 2.441rem;   /* 39px */
  --text-4xl: 3.052rem;   /* 49px */

  /* ── Spacing Scale (4px base) ── */
  --space-1: 0.25rem;     /* 4px */
  --space-2: 0.5rem;      /* 8px */
  --space-3: 0.75rem;     /* 12px */
  --space-4: 1rem;        /* 16px */
  --space-6: 1.5rem;      /* 24px */
  --space-8: 2rem;        /* 32px */
  --space-12: 3rem;       /* 48px */
  --space-16: 4rem;       /* 64px */
  --space-24: 6rem;       /* 96px */

  /* ── Borders & Radii ── */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 20px;
  --radius-full: 9999px;

  /* ── Shadows ── */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 20px rgba(212, 148, 58, 0.3);

  /* ── Motion ── */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* ── Z-index Scale ── */
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-overlay: 300;
  --z-modal: 400;
  --z-toast: 500;
}

/* Light theme override */
[data-theme="light"] {
  --color-bg: var(--gray-50);
  --color-surface: #ffffff;
  --color-surface-raised: var(--gray-100);
  --color-text: var(--gray-900);
  --color-text-muted: var(--gray-700);
  --color-border: var(--gray-200);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.1);
}
```

## Component API Patterns (React)

```tsx
// Pattern 1: Polymorphic "as" prop
interface ButtonProps<T extends React.ElementType = "button"> {
  as?: T;
  variant: "primary" | "secondary" | "ghost";
  size: "sm" | "md" | "lg";
  children: React.ReactNode;
}

function Button<T extends React.ElementType = "button">({
  as, variant, size, children, ...props
}: ButtonProps<T> & React.ComponentPropsWithoutRef<T>) {
  const Component = as || "button";
  return <Component className={`btn btn-${variant} btn-${size}`} {...props}>{children}</Component>;
}

// Pattern 2: Compound component
function Tabs({ children, defaultValue }: TabsProps) { /* provider */ }
Tabs.List = function TabsList({ children }: { children: React.ReactNode }) { /* tab buttons */ };
Tabs.Panel = function TabsPanel({ value, children }: TabsPanelProps) { /* content */ };

// Usage:
// <Tabs defaultValue="tab1">
//   <Tabs.List><button>Tab 1</button></Tabs.List>
//   <Tabs.Panel value="tab1">Content</Tabs.Panel>
// </Tabs>

// Pattern 3: Slot pattern (Radix-style)
interface CardProps {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}
```

## Responsive Breakpoints

```css
/* Mobile-first breakpoints */
/* Base: 0-639px (mobile) */
@media (min-width: 640px)  { /* sm: landscape phones, small tablets */ }
@media (min-width: 768px)  { /* md: tablets */ }
@media (min-width: 1024px) { /* lg: laptops */ }
@media (min-width: 1280px) { /* xl: desktops */ }
@media (min-width: 1536px) { /* 2xl: large screens */ }

/* Container query (component-level responsiveness) */
.card-container { container-type: inline-size; }

@container (min-width: 400px) {
  .card { flex-direction: row; }
}

/* Touch target sizing */
button, a, [role="button"] {
  min-height: 44px;
  min-width: 44px;
}
```

## Accessibility Checklist

### Color & Contrast
- [ ] Text contrast >= 4.5:1 (WCAG AA normal text)
- [ ] Large text contrast >= 3:1 (>= 18pt or 14pt bold)
- [ ] UI component contrast >= 3:1 against adjacent colors
- [ ] Information not conveyed by color alone (add icons, text, patterns)

### Keyboard Navigation
- [ ] All interactive elements reachable via Tab
- [ ] Logical tab order matches visual order
- [ ] Focus indicator visible on every focusable element
- [ ] Escape closes modals, dropdowns, popups
- [ ] Arrow keys navigate within composite widgets (tabs, menus)
- [ ] Skip-to-content link as first focusable element

### Semantic HTML & ARIA
- [ ] Use `<button>` for actions, `<a>` for navigation (never div/span)
- [ ] Headings in order (h1 > h2 > h3, no skipping levels)
- [ ] Form inputs have associated `<label>` elements
- [ ] `aria-live="polite"` on dynamic status messages
- [ ] `aria-expanded` on disclosure triggers
- [ ] `aria-hidden="true"` on decorative elements
- [ ] `role="dialog"` + `aria-modal="true"` on modals

### Motion & Media
- [ ] `prefers-reduced-motion` disables non-essential animations
- [ ] `prefers-color-scheme` respected for auto dark/light mode
- [ ] No content flashes more than 3 times per second
- [ ] Videos have captions, audio has transcripts

### Testing
- [ ] Screen reader test (VoiceOver on Mac, NVDA on Windows)
- [ ] Keyboard-only navigation test (no mouse)
- [ ] axe DevTools or Lighthouse audit score >= 95
- [ ] Zoom to 200% without content loss or horizontal scroll
