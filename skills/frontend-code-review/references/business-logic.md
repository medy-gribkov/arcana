# Rule Catalog -- Business Logic

## Avoid accessing context providers outside their scope

IsUrgent: True

### Description

Components that rely on context providers (stores, themes, auth) must only be used inside that provider's tree. If a component is rendered outside the provider scope, it will crash or produce a blank screen.

Common example: a component uses a store hook but is also rendered in a template or preview context where the store provider is not mounted.

### Suggested Fix

Check if the provider exists before accessing it. Use fallback values or conditional rendering. If a component must work in multiple contexts, pass required data as props instead of pulling from context.

## Keep business logic out of UI components

IsUrgent: False

### Description

UI components should only handle rendering and user interaction. Business logic (API calls, data transformations, complex validations) belongs in hooks, services, or utility modules.

### Suggested Fix

Extract logic into custom hooks or service functions. The component should call the hook and render the result. This makes components testable and reusable.
