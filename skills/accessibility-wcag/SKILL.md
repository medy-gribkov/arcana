---
name: accessibility-wcag
description: Audit and fix web accessibility issues. Enforce WCAG 2.1 AA compliance, semantic HTML, ARIA patterns, keyboard navigation, screen reader compatibility.
user-invokable: true
argument-hint: "[file-path|url] [--level=AA|AAA] [--fix]"
---

# Accessibility & WCAG Compliance

Audit web applications for WCAG 2.1/2.2 compliance, fix accessibility barriers, implement proper semantic HTML and ARIA patterns.

## BAD: Common Accessibility Violations

```tsx
// BAD: Div button without keyboard support
<div className="btn" onClick={handleClick}>
  Submit
</div>

// BAD: Color-only error indication
<input className="border-red-500" />
<span style={{color: 'red'}}>Error</span>

// BAD: Image without alt text
<img src="/chart.png" />

// BAD: Aria-label overuse
<button aria-label="Click me">Click me</button>

// BAD: Auto-focus abuse
<input autoFocus />
<Modal open={isOpen}>
  <input autoFocus /> {/* Steals focus */}
</Modal>

// BAD: No heading hierarchy
<h1>Page Title</h1>
<h4>Section</h4> {/* Skips h2, h3 */}

// BAD: Form without labels
<input type="text" placeholder="Email" />
<select>
  <option>Choose...</option>
</select>

// BAD: Custom dropdown without keyboard support
<div onClick={toggle}>
  {options.map(opt => <div onClick={() => select(opt)}>{opt}</div>)}
</div>
```

## GOOD: Accessible Implementations

```tsx
// GOOD: Semantic button with proper keyboard support
<button type="button" onClick={handleClick}>
  Submit
</button>

// GOOD: Multi-sensory error indication
<input
  className="border-red-500"
  aria-invalid="true"
  aria-describedby="email-error"
/>
<span id="email-error" className="text-red-600" role="alert">
  <span className="sr-only">Error:</span>
  Invalid email format
</span>

// GOOD: Descriptive alt text (or empty for decorative)
<img src="/sales-chart.png" alt="Sales increased 40% in Q4" />
<img src="/decorative-line.svg" alt="" role="presentation" />

// GOOD: Redundant aria-label removed
<button>Click me</button>

// GOOD: Managed focus with trap
function Modal({ open, onClose, children }) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement;
    modalRef.current?.focus();

    return () => previousFocus?.focus();
  }, [open]);

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      {children}
    </div>
  );
}

// GOOD: Proper heading hierarchy
<h1>Page Title</h1>
<h2>Main Section</h2>
<h3>Subsection</h3>
<h2>Another Section</h2>

// GOOD: Labeled form controls
<label htmlFor="email">Email address</label>
<input
  id="email"
  type="email"
  aria-required="true"
  aria-describedby="email-hint"
/>
<span id="email-hint" className="text-gray-600">
  We'll never share your email
</span>

<label htmlFor="country">Country</label>
<select id="country" aria-required="true">
  <option value="">Select a country</option>
  <option value="us">United States</option>
</select>

// GOOD: Accessible custom dropdown
function Dropdown({ options, value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => Math.min(prev + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onChange(options[activeIndex]);
        setOpen(false);
        buttonRef.current?.focus();
        break;
      case 'Escape':
        setOpen(false);
        buttonRef.current?.focus();
        break;
    }
  };

  return (
    <div>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby="dropdown-label"
        onClick={() => setOpen(!open)}
      >
        <span id="dropdown-label">{label}</span>: {value}
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-labelledby="dropdown-label"
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          {options.map((opt, i) => (
            <li
              key={opt}
              role="option"
              aria-selected={i === activeIndex}
              onClick={() => {
                onChange(opt);
                setOpen(false);
                buttonRef.current?.focus();
              }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

## Keyboard Navigation Patterns

```tsx
// Roving tabindex for toolbar
function Toolbar({ items }) {
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleKeyDown = (e: KeyboardEvent, index: number) => {
    let newIndex = index;

    if (e.key === 'ArrowRight') {
      newIndex = (index + 1) % items.length;
    } else if (e.key === 'ArrowLeft') {
      newIndex = (index - 1 + items.length) % items.length;
    } else if (e.key === 'Home') {
      newIndex = 0;
    } else if (e.key === 'End') {
      newIndex = items.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    setFocusedIndex(newIndex);
  };

  return (
    <div role="toolbar" aria-label="Formatting tools">
      {items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          tabIndex={i === focusedIndex ? 0 : -1}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onFocus={() => setFocusedIndex(i)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// Skip navigation link
function Layout({ children }) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-blue-600 focus:text-white"
      >
        Skip to main content
      </a>

      <nav aria-label="Main navigation">
        {/* Nav items */}
      </nav>

      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}

// Focus-visible styling (CSS)
/* Show focus only for keyboard users */
button:focus {
  outline: none;
}

button:focus-visible {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}
```

## Live Regions and Dynamic Content

```tsx
// Status announcements
function Toast({ message, type }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="toast"
    >
      {message}
    </div>
  );
}

// Urgent alerts
function ErrorAlert({ message }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="bg-red-100 border border-red-600 p-4"
    >
      <strong>Error:</strong> {message}
    </div>
  );
}

// Loading state announcement
function DataTable({ loading, data }) {
  return (
    <div>
      {loading && (
        <div role="status" aria-live="polite">
          <span className="sr-only">Loading data...</span>
          <div className="spinner" aria-hidden="true" />
        </div>
      )}

      <table>
        <caption className="sr-only">Sales data for 2025</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.id}>
              <th scope="row">{row.month}</th>
              <td>{row.revenue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## Color Contrast and Motion

```css
/* GOOD: WCAG AA contrast ratios */
.text-normal {
  color: #1a1a1a; /* 4.5:1 on white */
  background: #ffffff;
}

.text-large {
  font-size: 18px;
  font-weight: 700;
  color: #4a4a4a; /* 3:1 on white (large text) */
}

.button-primary {
  background: #0066cc; /* 4.5:1 with white text */
  color: #ffffff;
}

/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* GOOD: Graceful animation degradation */
@media (prefers-reduced-motion: no-preference) {
  .fade-in {
    animation: fadeIn 0.3s ease-in;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fade-in {
    opacity: 1; /* Skip animation, show immediately */
  }
}
```

## Automated Testing

```typescript
// axe-core integration (Jest + React Testing Library)
import { axe, toHaveNoViolations } from 'jest-axe';
import { render } from '@testing-library/react';

expect.extend(toHaveNoViolations);

test('LoginForm has no accessibility violations', async () => {
  const { container } = render(<LoginForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

// Playwright accessibility audit
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Homepage should not have accessibility violations', async ({ page }) => {
  await page.goto('http://localhost:3000');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

// Cypress accessibility testing
describe('Accessibility', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.injectAxe();
  });

  it('Has no detectable accessibility violations', () => {
    cy.checkA11y();
  });

  it('Has no violations on specific component', () => {
    cy.checkA11y('.navigation-menu');
  });

  it('Respects wcag2aa standard', () => {
    cy.checkA11y(null, {
      runOnly: {
        type: 'tag',
        values: ['wcag2aa']
      }
    });
  });
});
```

## Workflow

When auditing accessibility:

1. **Run automated tools first**: axe DevTools, Lighthouse, WAVE
2. **Check keyboard navigation**: Tab through entire page, verify focus order
3. **Test with screen reader**: NVDA (Windows), VoiceOver (Mac), JAWS
4. **Verify color contrast**: Use contrast checker for all text/UI elements
5. **Validate ARIA**: Ensure roles/states match component behavior
6. **Test dynamic content**: Live regions announce properly
7. **Check form accessibility**: Labels, errors, validation messages
8. **Verify responsive behavior**: Touch targets >= 44x44px on mobile

Common WCAG 2.1 Level AA failures:
- Missing alt text (1.1.1)
- Insufficient contrast (1.4.3)
- No keyboard access (2.1.1)
- Missing form labels (3.3.2)
- Invalid HTML/ARIA (4.1.1, 4.1.2)

Fix priority: Critical (blocks screen readers) > High (keyboard issues) > Medium (contrast) > Low (enhancements).
