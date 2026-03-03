---
name: frontend-code-review
description: Review React/TypeScript frontend code against code quality, performance, and business logic rules. Provides structured findings with file paths, line numbers, and suggested fixes.
---

# Frontend Code Review

## Review Process

This skill reviews `.tsx`, `.ts`, and `.js` files against three categories:

1. **Code Quality** - Consistent patterns, maintainability
2. **Performance** - React rendering optimization
3. **Business Logic** - Domain-specific rules

**Two review modes:**
- **Pending-change review** - Scan staged/modified files before commit
- **File-targeted review** - Review specific files the user names

## Code Quality Rules

### Rule 1: Conditional Classnames (URGENT)

**Requirement:** Use `cn()` utility for all conditional CSS, not ternaries or string concatenation.

**BAD:**
```tsx
// Manual ternary
<div className={isActive ? 'text-primary-600' : 'text-gray-500'}>

// String concatenation
<div className={'bg-white ' + (isError ? 'border-red-500' : '')}>

// Template literal
<div className={`text-base ${highlighted && 'font-bold'}`}>
```

**GOOD:**
```tsx
import { cn } from '@/utils/classnames';

<div className={cn(
  'text-base',
  isActive && 'text-primary-600',
  !isActive && 'text-gray-500'
)}>

<div className={cn(
  'bg-white',
  isError && 'border-red-500'
)}>
```

**Why urgent:** Inconsistent patterns make global style changes difficult.

### Rule 2: Tailwind-First Styling (URGENT)

**Requirement:** Prefer Tailwind utilities over `.module.css` files unless Tailwind cannot achieve the effect.

**BAD:**
```tsx
// styles.module.css
.button {
  padding: 0.75rem 1.5rem;
  background-color: #3b82f6;
  border-radius: 0.5rem;
}

// Component.tsx
import styles from './styles.module.css';
<button className={styles.button}>Click</button>
```

**GOOD:**
```tsx
<button className="px-6 py-3 bg-blue-500 rounded-lg hover:bg-blue-600">
  Click
</button>
```

**When CSS modules are acceptable:**
- Complex animations requiring `@keyframes`
- Browser-specific hacks
- Third-party library style overrides

### Rule 3: ClassName Ordering for Overrides

**Requirement:** Place incoming `className` prop AFTER component's own classes.

**BAD:**
```tsx
const Button = ({ className }: { className?: string }) => {
  return (
    <div className={cn(className, 'bg-primary-600 text-white px-4 py-2')}>
      {/* Consumer can't override bg-primary-600 */}
    </div>
  );
};

// Consumer tries to change background
<Button className="bg-red-500" /> {/* Won't work */}
```

**GOOD:**
```tsx
const Button = ({ className }: { className?: string }) => {
  return (
    <div className={cn('bg-primary-600 text-white px-4 py-2', className)}>
      {/* className comes LAST, can override */}
    </div>
  );
};

<Button className="bg-red-500" /> {/* Works */}
```

## Performance Rules

### Rule 1: React Flow Data Access (URGENT)

**Requirement:** Use `useNodes`/`useEdges` for UI rendering. Use `useStoreApi` inside callbacks that mutate state.

**BAD:**
```tsx
import useNodes from '@/app/components/workflow/store/workflow/use-nodes';

const NodeComponent = () => {
  const nodes = useNodes(); // Wrong hook
  // ...
};
```

**GOOD:**
```tsx
import { useNodes, useStoreApi } from 'reactflow';

const NodeComponent = () => {
  const nodes = useNodes(); // Correct React Flow hook
  const store = useStoreApi();

  const handleUpdate = () => {
    const { getNodes, setNodes } = store.getState();
    // Mutate via store API
  };

  return <div>{nodes.length} nodes</div>;
};
```

**Why urgent:** Using wrong hooks causes blank screens when no `workflowStore` provider exists.

### Rule 2: Complex Prop Memoization (URGENT)

**Requirement:** Wrap objects, arrays, and functions passed as props in `useMemo` or `useCallback`.

**BAD:**
```tsx
function ParentComponent() {
  return (
    <HeavyChild
      config={{
        apiKey: 'abc',
        endpoint: '/api/data'
      }}
      filters={['active', 'recent']}
      onUpdate={() => console.log('update')}
    />
  );
  // Every render creates NEW objects/arrays/functions
  // Child re-renders even if nothing changed
}
```

**GOOD:**
```tsx
function ParentComponent() {
  const config = useMemo(() => ({
    apiKey: 'abc',
    endpoint: '/api/data'
  }), []);

  const filters = useMemo(() => ['active', 'recent'], []);

  const handleUpdate = useCallback(() => {
    console.log('update');
  }, []);

  return (
    <HeavyChild
      config={config}
      filters={filters}
      onUpdate={handleUpdate}
    />
  );
  // Stable references, child only re-renders when props actually change
}
```

**Why urgent:** Causes unnecessary re-renders, degrades performance with complex components.

## Business Logic Rules

### Rule 1: No workflowStore in Node Components (URGENT)

**Applies to:** Files matching `web/app/components/workflow/nodes/[nodeName]/node.tsx`

**Requirement:** Node components cannot import `workflowStore` because they're used in contexts without the provider.

**BAD:**
```tsx
// web/app/components/workflow/nodes/TextNode/node.tsx
import useNodes from '@/app/components/workflow/store/workflow/use-nodes';

export const TextNode = () => {
  const nodes = useNodes(); // Breaks when no provider
  // ...
};
```

**GOOD:**
```tsx
// web/app/components/workflow/nodes/TextNode/node.tsx
import { useNodes } from 'reactflow';

export const TextNode = () => {
  const nodes = useNodes(); // Works in all contexts
  // ...
};
```

**Why urgent:** Causes blank screens when creating RAG Pipes from templates (no workflowStore provider in that flow).

## Review Output Format

### Template A: Issues Found

```
# Code review
Found <N> urgent issues that need to be fixed:

## 1. Using manual ternary instead of cn() utility
FilePath: src\components\Button.tsx line 12
<div className={isActive ? 'text-primary-600' : 'text-gray-500'}>

### Suggested fix
Replace with cn() utility:
import { cn } from '@/utils/classnames';
<div className={cn(isActive ? 'text-primary-600' : 'text-gray-500')}>

---

## 2. Object prop not memoized
FilePath: src\pages\Dashboard.tsx line 45
<HeavyComponent config={{ apiKey: key, url: endpoint }} />

### Suggested fix
Wrap in useMemo:
const config = useMemo(() => ({ apiKey: key, url: endpoint }), [key, endpoint]);
<HeavyComponent config={config} />

---

Found <M> suggestions for improvement:

## 1. Consider using Tailwind instead of CSS module
FilePath: src\components\Card.tsx line 5
import styles from './Card.module.css';

### Suggested fix
Replace CSS module with Tailwind utilities if possible.

---
```

**If >= 10 issues:** Show first 10, summarize as "10+ urgent issues".

**If any issue requires code changes:** End with "Would you like me to apply the suggested fixes?"

### Template B: No Issues

```
## Code review
No issues found.
```

## Example Review Workflow

### Step 1: Scan File

```tsx
// src/components/UserCard.tsx
import { useNodes } from 'reactflow';
import styles from './UserCard.module.css';

export const UserCard = ({ user, className }) => {
  const nodes = useNodes();

  return (
    <div className={className + ' ' + styles.card}>
      <img src={user.avatar} className={user.isOnline ? 'border-green' : 'border-gray'} />
      <ExpensiveChild data={{ id: user.id, name: user.name }} />
    </div>
  );
};
```

### Step 2: Identify Violations

1. **Line 2:** Using CSS module (Code Quality, suggestion)
2. **Line 7:** Manual string concatenation instead of `cn()` (Code Quality, URGENT)
3. **Line 8:** Manual ternary instead of `cn()` (Code Quality, URGENT)
4. **Line 9:** Object prop not memoized (Performance, URGENT)

### Step 3: Generate Report

```
# Code review
Found 3 urgent issues that need to be fixed:

## 1. Manual string concatenation for classnames
FilePath: src\components\UserCard.tsx line 7
<div className={className + ' ' + styles.card}>

### Suggested fix
Replace with cn() utility:
import { cn } from '@/utils/classnames';
<div className={cn(styles.card, className)}>

---

## 2. Manual ternary for conditional classname
FilePath: src\components\UserCard.tsx line 8
<img className={user.isOnline ? 'border-green' : 'border-gray'} />

### Suggested fix
import { cn } from '@/utils/classnames';
<img className={cn(user.isOnline ? 'border-green' : 'border-gray')} />

---

## 3. Object prop not memoized
FilePath: src\components\UserCard.tsx line 9
<ExpensiveChild data={{ id: user.id, name: user.name }} />

### Suggested fix
const data = useMemo(() => ({ id: user.id, name: user.name }), [user.id, user.name]);
<ExpensiveChild data={data} />

---

Found 1 suggestion for improvement:

## 1. Consider Tailwind instead of CSS module
FilePath: src\components\UserCard.tsx line 2
import styles from './UserCard.module.css';

### Suggested fix
Evaluate if CSS module is necessary or if Tailwind utilities can replace it.

---

Would you like me to apply the suggested fixes?
```

## Quick Reference

**Urgency Levels:**
```
URGENT:     Code Quality violations, Performance issues, Business Logic bugs
SUGGESTION: Best practices, minor improvements
```

**Common Patterns to Flag:**
```
BAD: className={a ? 'x' : 'y'}
GOOD: className={cn(a ? 'x' : 'y')}

BAD: <Child config={{...}} />
GOOD: const config = useMemo(() => ({...}), [deps]);

BAD: import useNodes from '@/store/workflow/use-nodes'
GOOD: import { useNodes } from 'reactflow'
```

---

**Use this skill**: Before committing frontend changes, during PR reviews, or when diagnosing rendering performance issues.
