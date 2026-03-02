---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, or applications. Generates creative, polished code that avoids generic AI aesthetics.
license: Complete terms in LICENSE.txt
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS custom properties for theming. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.

```css
/* CSS custom property theming example */
:root {
  --color-primary: #d4943a;
  --color-bg: #0c0b0e;
  --color-text: #f5f5f5;
  --color-accent: #ff6b35;
  --spacing-unit: 0.5rem;
  --radius-sm: 4px;
  --radius-lg: 12px;
}

[data-theme="light"] {
  --color-bg: #f5f5f5;
  --color-text: #0c0b0e;
}

.card {
  background: var(--color-bg);
  color: var(--color-text);
  border-radius: var(--radius-lg);
  padding: calc(var(--spacing-unit) * 4);
}
```

- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

## Component Patterns

**BAD** - Generic card with no design intent:
```tsx
function Card({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ border: "1px solid #ccc", padding: 16, borderRadius: 8 }}>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}
```

**GOOD** - Card with intentional design system, motion, and composition:
```tsx
function Card({ title, desc, accent }: CardProps) {
  return (
    <motion.div
      className="group relative overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `radial-gradient(circle at var(--mouse-x) var(--mouse-y), ${accent}15, transparent 60%)` }}
      />
      <div className="relative p-8 border border-white/10 rounded-2xl backdrop-blur-sm">
        <h3 className="font-display text-xl tracking-tight">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-white/60">{desc}</p>
      </div>
    </motion.div>
  );
}
```

## CSS Architecture

**BAD** - Inline styles and magic numbers:
```css
.header { margin-top: 23px; font-size: 14.5px; color: #333; }
.sidebar { width: 247px; padding: 13px 17px; }
```

**GOOD** - Design tokens and systematic spacing:
```css
:root {
  --space-1: 0.25rem;  --space-2: 0.5rem;  --space-3: 0.75rem;
  --space-4: 1rem;     --space-6: 1.5rem;   --space-8: 2rem;
  --space-12: 3rem;    --space-16: 4rem;

  --text-xs: 0.75rem;  --text-sm: 0.875rem; --text-base: 1rem;
  --text-lg: 1.125rem; --text-xl: 1.25rem;  --text-2xl: 1.5rem;

  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}

.header { margin-top: var(--space-6); font-size: var(--text-sm); color: var(--color-text); }
.sidebar { width: 16rem; padding: var(--space-3) var(--space-4); }
```

## Layout Patterns

**BAD** - Same grid everywhere:
```css
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
```

**GOOD** - Responsive, context-aware layouts:
```css
/* Fluid grid that adapts to content */
.auto-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
  gap: var(--space-6);
}

/* Asymmetric hero layout */
.hero {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: var(--space-12);
  align-items: end;
}

/* Overlapping composition */
.overlap-stack > * {
  grid-area: 1 / 1;
}
```

## Procedural Workflow

1. **Audit the brief.** Define purpose, audience, constraints, one memorable detail.
2. **Pick a direction.** Choose tone (brutalist, luxury, editorial, etc.). Commit fully.
3. **Set tokens.** Define color, spacing, typography scales in CSS custom properties.
4. **Build mobile-first.** Start at 320px. Add complexity at breakpoints.
5. **Add motion last.** Entrance animations, hover states, scroll triggers. Respect `prefers-reduced-motion`.
6. **Test contrast.** WCAG 2.1 AA minimum. Use browser DevTools audit.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code. Minimalist designs need restraint and precision. Elegance comes from executing the vision well.

## Accessibility Checklist

Build beautiful AND accessible interfaces:

```html
<!-- Semantic HTML with ARIA -->
<button aria-label="Close dialog" aria-pressed="false">
  <svg aria-hidden="true">...</svg>
</button>

<nav aria-label="Main navigation">
  <ul role="list">
    <li><a href="/" aria-current="page">Home</a></li>
  </ul>
</nav>

<dialog aria-labelledby="dialog-title" aria-describedby="dialog-desc">
  <h2 id="dialog-title">Confirm Action</h2>
  <p id="dialog-desc">This will delete your account.</p>
</dialog>

<!-- Form accessibility -->
<label for="email">Email address</label>
<input
  id="email"
  type="email"
  aria-required="true"
  aria-invalid="false"
  aria-describedby="email-error"
/>
<span id="email-error" role="alert" aria-live="polite"></span>
```

**Checklist:**
- [ ] Color contrast ratio ≥ 4.5:1 for text, ≥ 3:1 for large text
- [ ] All interactive elements keyboard-accessible (tab order, Enter/Space)
- [ ] Focus indicators visible and distinct (`:focus-visible`)
- [ ] `aria-label` or `aria-labelledby` on all controls without visible text
- [ ] `role="alert"` for dynamic error messages with `aria-live="polite"`
- [ ] Images have `alt` text (empty `alt=""` for decorative images)
- [ ] Skip to main content link for keyboard users
- [ ] No seizure-inducing animations (use `prefers-reduced-motion`)

```css
/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.