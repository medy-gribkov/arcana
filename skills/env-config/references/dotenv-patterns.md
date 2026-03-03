# .env File Patterns and Secret Rotation

## .env.example Template

Every project needs a `.env.example` committed to the repo. Use realistic placeholder values.

```bash
# App
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Database
DATABASE_URL=postgres://user:password@localhost:5432/mydb
DATABASE_POOL_SIZE=10

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=change-me-in-production-min-32-chars
JWT_EXPIRY=15m
REFRESH_SECRET=change-me-too-min-32-chars

# External APIs
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
SENDGRID_API_KEY=SG.xxxxxxxxxxxx

# Feature Flags
ENABLE_CACHE=false
ENABLE_RATE_LIMIT=true

# Client-side (Next.js: must start with NEXT_PUBLIC_)
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn-here
```

## Environment Hierarchy

Load order for most frameworks (later overrides earlier):

```
.env                    # Shared defaults (committed)
.env.local              # Local overrides (gitignored)
.env.development        # Dev-specific (committed or gitignored)
.env.development.local  # Dev local overrides (gitignored)
.env.production         # Production (committed, no secrets)
.env.production.local   # Production local (gitignored)
```

### .gitignore entries

```
.env.local
.env.*.local
.env.development
.env.staging
.env.production
!.env.example
```

## Secret Rotation Patterns

### Rotation with Zero Downtime

1. Generate new secret.
2. Configure app to accept BOTH old and new secrets temporarily.
3. Deploy the dual-accept config.
4. Update all callers to use the new secret.
5. Remove old secret from config.

### Automated Rotation Script

```bash
#!/usr/bin/env bash
# Rotate a secret in AWS Secrets Manager
set -euo pipefail

SECRET_NAME="myapp/api-key"
NEW_VALUE=$(openssl rand -base64 32)

aws secretsmanager update-secret \
  --secret-id "$SECRET_NAME" \
  --secret-string "$NEW_VALUE"

echo "Rotated $SECRET_NAME. Restarting service..."
kubectl rollout restart deployment/myapp -n production
```

### Rotation Schedule

| Secret Type | Rotation Frequency | Method |
|------------|-------------------|--------|
| API keys (internal) | 90 days | Automated |
| JWT signing keys | 90 days | Dual-key accept |
| Database passwords | 90 days | Automated with connection pool drain |
| OAuth client secrets | 180 days | Manual, coordinate with provider |
| SSH keys | Annually | Manual |
| Encryption keys | Annually | Key versioning (encrypt with new, decrypt with old+new) |

## Validation at Startup

Always validate before any other initialization.

```typescript
// config.ts - import this first in your app entry point
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url().startsWith('postgres'),
  REDIS_URL: z.string().url().startsWith('redis'),
  JWT_SECRET: z.string().min(32),
  ENABLE_CACHE: z.coerce.boolean().default(false),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
```

## Docker Compose env Patterns

```yaml
services:
  app:
    # env_file loads bulk variables
    env_file:
      - .env
      - .env.${APP_ENV:-development}
    # environment overrides env_file
    environment:
      - NODE_ENV=${APP_ENV:-development}
    # For secrets, use Docker secrets (not env vars in compose file)
    secrets:
      - db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

Access Docker secrets in app:

```typescript
import { readFileSync } from 'fs';

const dbPassword = readFileSync('/run/secrets/db_password', 'utf8').trim();
```
