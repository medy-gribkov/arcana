# TypeScript Utility Types Reference

## Pick: Select Subset of Properties

**BAD:** Manually redefining subsets.

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

interface PublicUser {
  id: number;
  name: string;
  email: string;
}
```

**GOOD:** Use `Pick` to extract properties.

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

type PublicUser = Pick<User, 'id' | 'name' | 'email'>;
```

## Omit: Exclude Properties

```typescript
type UserWithoutPassword = Omit<User, 'password'>;
```

## Partial: Make All Properties Optional

**BAD:** Manually creating optional types.

```typescript
interface UpdateUserInput {
  id?: number;
  name?: string;
  email?: string;
}
```

**GOOD:** Use `Partial`.

```typescript
function updateUser(id: number, updates: Partial<User>) {
  // All User properties are optional in updates
}
```

## Required: Make All Properties Required

```typescript
interface Config {
  apiKey?: string;
  timeout?: number;
}

type RequiredConfig = Required<Config>;  // All fields required
```

## Record: Map Keys to Values

**BAD:** Using index signatures.

```typescript
interface StatusMap {
  [key: string]: string;
}
```

**GOOD:** Use `Record` for type-safe key-value maps.

```typescript
type Status = 'pending' | 'approved' | 'rejected';
type StatusMessages = Record<Status, string>;

const messages: StatusMessages = {
  pending: 'Awaiting review',
  approved: 'Request approved',
  rejected: 'Request denied',
};
```

## Extract: Filter Union Types

```typescript
type Shape = 'circle' | 'square' | 'triangle' | 'rectangle';
type RoundShapes = Extract<Shape, 'circle'>;  // 'circle'

type Event =
  | { type: 'click'; x: number; y: number }
  | { type: 'keypress'; key: string }
  | { type: 'focus' };

type ClickEvent = Extract<Event, { type: 'click' }>;
```

## Exclude: Remove Types from Union

```typescript
type Shape = 'circle' | 'square' | 'triangle' | 'rectangle';
type AngularShapes = Exclude<Shape, 'circle'>;  // 'square' | 'triangle' | 'rectangle'
```

## ReturnType: Extract Function Return Type

```typescript
function getUser() {
  return { id: 1, name: 'Alice' };
}

type User = ReturnType<typeof getUser>;  // { id: number; name: string }
```
