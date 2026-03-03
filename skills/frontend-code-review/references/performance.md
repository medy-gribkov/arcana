# Rule Catalog — Performance

## Use library-provided hooks for state access

IsUrgent: True
Category: Performance

### Description

When using state management libraries (Redux, Zustand, React Flow, etc.), prefer the library's built-in hooks for reading state in components. Use store APIs directly only inside callbacks that mutate state. Avoid manually pulling state outside of hooks.

## Complex prop memoization

IsUrgent: True
Category: Performance

### Description

Wrap complex prop values (objects, arrays, maps) in `useMemo` prior to passing them into child components to guarantee stable references and prevent unnecessary renders.

Update this file when adding, editing, or removing Performance rules so the catalog remains accurate.

Wrong:

```tsx
<HeavyComp
    config={{
        provider: ...,
        detail: ...
    }}
/>
```

Right:

```tsx
const config = useMemo(() => ({
    provider: ...,
    detail: ...
}), [provider, detail]);

<HeavyComp
    config={config}
/>
```
