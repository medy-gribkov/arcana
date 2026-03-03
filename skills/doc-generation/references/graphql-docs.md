# GraphQL Documentation

## Step 1: Extract Schema

```bash
# Using introspection
npx get-graphql-schema http://localhost:4000/graphql > schema.graphql

# Or from code (Apollo Server)
npm install @graphql-tools/schema
```

```typescript
// Extract schema from TypeScript
import { printSchema } from 'graphql';
import { schema } from './schema';
import { writeFileSync } from 'fs';

writeFileSync('schema.graphql', printSchema(schema));
```

## Step 2: Generate TypeScript Types

```yaml
# codegen.yml
overwrite: true
schema: "http://localhost:4000/graphql"
documents: "src/**/*.graphql"
generates:
  src/__generated__/types.ts:
    plugins:
      - "typescript"
      - "typescript-operations"
      - "typescript-react-apollo"
    config:
      withHooks: true
```

```bash
npm install -D @graphql-codegen/cli @graphql-codegen/typescript
npx graphql-codegen --config codegen.yml
```

**Result:**
```typescript
// __generated__/types.ts
export type User = {
  __typename?: 'User';
  id: Scalars['ID'];
  name: Scalars['String'];
  email: Scalars['String'];
};

export const useGetUserQuery = (
  options?: Omit<Urql.UseQueryArgs<GetUserQueryVariables>, 'query'>
) => Urql.useQuery<GetUserQuery>({ query: GetUserDocument, ...options });
```

## Step 3: Generate Static Docs

```bash
npm install -g spectaql
spectaql config.yml
```

```yaml
# config.yml
spectaql:
  servers:
    - url: http://localhost:4000/graphql
  introspection:
    schemaFile: schema.graphql
  options:
    targetFile: docs/api.html
```
