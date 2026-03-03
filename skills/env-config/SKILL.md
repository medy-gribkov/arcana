---
name: env-config
description: "Environment and configuration management covering .env patterns, runtime validation with zod and envalid, secret handling, 12-factor config principles, and Docker env injection."
---

## Purpose

Prevent misconfigurations from reaching production. Validate environment variables at startup, manage secrets safely, and keep config portable across local dev, CI, and production.

## .env File Patterns

### File Hierarchy

- `.env` holds shared defaults. Commit this to the repo with safe placeholder values.
- `.env.local` holds developer-specific overrides. Add to `.gitignore`.
- `.env.production`, `.env.staging`, `.env.test` hold environment-specific values.
- Load order (most frameworks): `.env` < `.env.local` < `.env.[environment]` < `.env.[environment].local`.

### Naming Conventions

- Prefix variables with the app or service name: `MYAPP_DATABASE_URL`, not just `DATABASE_URL`.
- Use SCREAMING_SNAKE_CASE. No dots, no dashes.
- Boolean values: use `true`/`false`, not `1`/`0` or `yes`/`no`.
- Group related variables with a common prefix: `MYAPP_REDIS_HOST`, `MYAPP_REDIS_PORT`.

### Template Files

- Maintain a `.env.example` with every variable, documented with comments.
- Use placeholder values that make the expected format obvious: `MYAPP_API_KEY=sk_test_xxxxxxxxxxxx`.
- Script a setup step that copies `.env.example` to `.env` if `.env` does not exist.

## Validation with Zod

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(10),
  ENABLE_CACHE: z.coerce.boolean().default(false),
});

export const env = envSchema.parse(process.env);
```

- Call this at application startup, before any other initialization.
- Fail fast with a clear error listing all missing or invalid variables.
- Export the parsed result as a typed object. Never access `process.env` directly elsewhere.
- Use `z.coerce` for numbers and booleans since env vars are always strings.

## Validation with Envalid

```typescript
import { cleanEnv, str, port, bool, url } from 'envalid';

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'staging', 'production'] }),
  PORT: port({ default: 3000 }),
  DATABASE_URL: url(),
  API_KEY: str(),
  ENABLE_CACHE: bool({ default: false }),
});
```

- Envalid strips `NODE_ENV` awareness into the validator. Use `env.isDev`, `env.isProd`.
- Built-in validators: `str`, `bool`, `num`, `port`, `url`, `email`, `json`, `host`.
- Custom validators: pass a function to `makeValidator`.

## Secret Management

### Principles

- Never commit secrets to version control. Not even in private repos.
- Rotate secrets on a schedule. Automate rotation where possible.
- Use short-lived tokens over long-lived API keys.
- Audit secret access. Log who accessed what and when.

### Tools

- **Local dev:** Use `.env.local` (gitignored) or a secrets manager CLI.
- **CI/CD:** Use the platform's built-in secrets (GitHub Actions secrets, GitLab CI variables).
- **Production:** Use a dedicated secrets manager: HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager, or Doppler.
- **Encryption at rest:** Use SOPS or age to encrypt secrets files that must live in the repo.

### Git Protection

- Add a pre-commit hook with gitleaks or trufflehog to scan for secrets.
- Configure `.gitignore` to exclude all `.env*` files except `.env.example`.
- If a secret is committed accidentally, rotate it immediately. Removing it from history is not enough.

## 12-Factor Config

### Core Principles

- Store config in environment variables, not in code or config files baked into the image.
- Config varies between deploys (staging, production). Code does not.
- Never group config into named environments inside the app ("the staging config object"). Use individual env vars.

### Implementation

- One env var per config value. Compose connection strings from parts if needed.
- Default values should be safe for local development, never for production.
- Validate all config at startup. Log which config source was used (env var, default, file).

## Docker Environment Injection

### Build-time vs Runtime

- `ARG` in Dockerfile: available only during build. Use for build tools, versions.
- `ENV` in Dockerfile: baked into the image. Use for static defaults.
- Runtime env vars (`docker run -e`): override `ENV` values. Use for secrets and deploy-specific config.

### Compose

```yaml
services:
  app:
    environment:
      - NODE_ENV=production
      - PORT=3000
    env_file:
      - .env.production
```

- `environment` in compose takes precedence over `env_file`.
- Use `env_file` for bulk variables. Use `environment` for overrides.
- Never put secrets in `docker-compose.yml`. Use Docker secrets or an external env file.

### Multi-stage Builds

- Do not copy `.env` files into Docker images.
- Pass build-time config via `ARG` and `--build-arg`.
- Inject runtime config via environment variables at container start.

## dotenv-vault

Encrypted .env files for teams. Alternative to secrets managers for small projects.

```bash
# Install
npm install dotenv-vault-core

# Setup
npx dotenv-vault new
npx dotenv-vault push production  # Upload .env to vault

# In production, use DOTENV_KEY instead of .env file
DOTENV_KEY="dotenv://vault-key-here" node server.js
```

```javascript
// Load in app
require('dotenv-vault-core').config();
console.log(process.env.DATABASE_URL);  // Decrypted from vault
```

**When to use:** Small teams (< 10 people), need encryption at rest, want git-based workflow without committing secrets.

## Cloud Provider Env Patterns

### AWS Systems Manager (SSM) Parameter Store

```javascript
// Fetch secrets at startup
import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

const client = new SSMClient({ region: "us-east-1" });
const response = await client.send(new GetParametersCommand({
  Names: ["/myapp/database-url", "/myapp/api-key"],
  WithDecryption: true,
}));

const env = {};
for (const param of response.Parameters) {
  const key = param.Name.split('/').pop().toUpperCase().replace('-', '_');
  env[key] = param.Value;
}

// Now use env.DATABASE_URL, env.API_KEY
```

### Vercel Environment Variables

- Set env vars in the Vercel dashboard or via `vercel env add`.
- Prefix client-exposed vars with `NEXT_PUBLIC_` in Next.js.
- Use different values per environment (Production, Preview, Development).
- Pull env vars to local: `vercel env pull .env.local`.

### GitHub Actions

- Store secrets in Settings > Secrets and variables > Actions.
- Access via `${{ secrets.MY_SECRET }}` in workflow files.
- Use environment-level secrets for deploy targets that need different credentials.

### Kubernetes

- Use ConfigMaps for non-sensitive config, Secrets for sensitive data.
- Mount as environment variables or files depending on the consumer.
- Use External Secrets Operator to sync from cloud secret managers.

## Troubleshooting

- Variable not loading: check file encoding (must be UTF-8, no BOM), line endings (LF not CRLF).
- Variable undefined in browser: ensure the framework prefix is correct (NEXT_PUBLIC_, VITE_, REACT_APP_).
- Docker env not applying: check that env_file path is relative to the compose file, not the build context.
- Validation failing in CI: ensure CI secrets are set for the correct environment (not just production).
