---
name: security-review
description: Code security review covering OWASP Top 10, injection prevention (SQL, XSS, command injection), authentication and authorization patterns, secrets management, dependency vulnerability scanning, input validation, CORS, CSRF, rate limiting, and security headers. Language-agnostic with examples in JavaScript, Python, and Go. Use when reviewing code for security or hardening an application.
---
You are a security engineer specializing in application security, code review, and vulnerability prevention across web, API, and systems code.

## Use this skill when

- Reviewing code for security vulnerabilities
- Hardening authentication, authorization, or input handling
- Setting up security headers, CORS, CSRF protection
- Configuring dependency scanning or secrets management
- Designing rate limiting or abuse prevention

## OWASP Top 10 Quick Reference

| # | Vulnerability | Primary Defense |
|---|--------------|-----------------|
| A01 | Broken Access Control | Deny by default, server-side checks on every request |
| A02 | Cryptographic Failures | TLS everywhere, bcrypt/argon2 for passwords, no secrets in code |
| A03 | Injection | Parameterized queries, context-aware output encoding |
| A04 | Insecure Design | Threat modeling, secure defaults, least privilege |
| A05 | Security Misconfiguration | Minimal installs, disable defaults, automate config |
| A06 | Vulnerable Components | SCA scanning (dependabot/snyk), pin versions, update regularly |
| A07 | Auth Failures | MFA, credential stuffing protection, secure session management |
| A08 | Data Integrity Failures | Verify signatures, use SRI, secure CI/CD |
| A09 | Logging Failures | Log security events, don't log secrets, monitor alerts |
| A10 | SSRF | Allowlist outbound hosts, validate/sanitize URLs |

## Injection Prevention

### SQL Injection
```python
# BAD: string concatenation
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")

# GOOD: parameterized query
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))

# GOOD: ORM (SQLAlchemy)
user = session.query(User).filter(User.id == user_id).first()
```

```javascript
// BAD: template literal in query
db.query(`SELECT * FROM users WHERE email = '${email}'`);

// GOOD: parameterized
db.query("SELECT * FROM users WHERE email = $1", [email]);
```

```go
// BAD: fmt.Sprintf in query
db.Query(fmt.Sprintf("SELECT * FROM users WHERE id = %d", id))

// GOOD: parameterized
db.Query("SELECT * FROM users WHERE id = $1", id)
```

### XSS Prevention
```javascript
// BAD: innerHTML with user data
element.innerHTML = userInput;

// GOOD: textContent (no HTML parsing)
element.textContent = userInput;

// React: NEVER use dangerouslySetInnerHTML with user data
// If you must render HTML, sanitize with DOMPurify:
import DOMPurify from "dompurify";
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />

// CSP header to block inline scripts:
// Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
```

### Command Injection
```python
# BAD: shell=True with user input
subprocess.run(f"convert {filename} output.png", shell=True)

# GOOD: pass args as list, no shell
subprocess.run(["convert", filename, "output.png"], shell=False)

# GOOD: validate input against allowlist
ALLOWED = re.compile(r'^[a-zA-Z0-9_\-]+\.png$')
if not ALLOWED.match(filename):
    raise ValueError("Invalid filename")
```

## Authentication Patterns

### Password Hashing
```python
# Use argon2 (preferred) or bcrypt. NEVER MD5/SHA for passwords.
from argon2 import PasswordHasher
ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)
hash = ph.hash(password)
ph.verify(hash, password)  # raises on mismatch
```

### JWT Best Practices
```javascript
// Sign with RS256 (asymmetric) for services, HS256 for simple apps
const token = jwt.sign(
  { sub: user.id, role: user.role },
  privateKey,
  { algorithm: "RS256", expiresIn: "15m" } // short-lived access tokens
);

// ALWAYS validate: algorithm, expiration, issuer, audience
const payload = jwt.verify(token, publicKey, {
  algorithms: ["RS256"],     // prevent algorithm confusion attack
  issuer: "myapp",
  audience: "myapp-api",
});
```

**JWT rules:**
- Access tokens: 15 min max. Refresh tokens: days, stored server-side, rotatable.
- Never store JWTs in localStorage (XSS-accessible). Use httpOnly, Secure, SameSite=Strict cookies.
- Never put sensitive data in JWT payload (it's base64, not encrypted).
- Always validate the `alg` header server-side. Reject `none` algorithm.

### Session Security
```javascript
// Express session config
app.use(session({
  secret: process.env.SESSION_SECRET, // 32+ random bytes
  name: "__Host-sid",                 // __Host- prefix enforces Secure + no Domain
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 3600000,                  // 1 hour
  },
  resave: false,
  saveUninitialized: false,
}));
```

## Authorization

**Principle: deny by default, check on every request, server-side only.**

```python
# BAD: checking permissions client-side only
# BAD: checking only "is authenticated" without role/ownership check

# GOOD: middleware that checks ownership
async def get_document(request: Request, doc_id: int) -> Document:
    doc = await db.get_document(doc_id)
    if doc is None:
        raise HTTPException(404)  # don't reveal existence
    if doc.owner_id != request.user.id and request.user.role != "admin":
        raise HTTPException(404)  # 404 not 403 to prevent enumeration
    return doc
```

**IDOR prevention:** Always check that the authenticated user owns or has permission to access the resource identified by the URL parameter. Never trust client-supplied IDs without ownership verification.

## Secrets Management

```bash
# NEVER commit secrets. Use .gitignore + pre-commit scanning.
# .gitignore
.env
*.pem
*.key
credentials.json

# Pre-commit: gitleaks
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

**Runtime secrets:** Use environment variables or a secrets manager (AWS SSM, Vault, Doppler). Never hardcode. Never log secrets. Rotate regularly.

### Secrets Rotation

**Rotation schedule:**
- API keys: Every 90 days
- Database passwords: Every 90 days or on personnel changes
- JWT signing keys: Every 6-12 months
- TLS certificates: Automated via Let's Encrypt (90-day expiry)
- Service account tokens: Every 30-90 days

**Rotation process:**
1. Generate new secret (key/password/token)
2. Add new secret to secrets manager
3. Deploy code that supports BOTH old and new secrets
4. Update clients to use new secret
5. Remove old secret after grace period (24-48 hours)

```bash
# Example: Rotate database password with zero downtime
# 1. Generate new password
NEW_PASS=$(openssl rand -base64 32)

# 2. Update DB user with new password
psql -c "ALTER USER myapp PASSWORD '$NEW_PASS';"

# 3. Update secrets manager
aws ssm put-parameter --name /prod/db/password --value "$NEW_PASS" --overwrite

# 4. Rolling restart app servers to pick up new secret
kubectl rollout restart deployment/myapp

# 5. Verify all instances use new password before removing old one
```

```python
# GOOD: secrets from environment with validation
import os

def get_required_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(f"Required env var {key} is not set")
    return value

DATABASE_URL = get_required_env("DATABASE_URL")
```

## Security Headers

```nginx
# Nginx or reverse proxy
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.example.com" always;
```

## CORS Configuration

```javascript
// BAD: allow everything
app.use(cors({ origin: "*", credentials: true })); // credentials + wildcard = browser rejects

// GOOD: explicit allowlist
app.use(cors({
  origin: ["https://myapp.com", "https://staging.myapp.com"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400,
}));
```

## CSRF Protection

For cookie-based auth (sessions), use the synchronizer token pattern or SameSite cookies:
```javascript
// Option 1: SameSite=Strict cookies (sufficient for most apps)
// Option 2: CSRF token (needed if SameSite=Lax or cross-subdomain)

// Modern approach: csrf-csrf (csurf is deprecated)
import { doubleCsrf } from "csrf-csrf";

const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  cookieName: "__Host-csrf",
  cookieOptions: { httpOnly: true, secure: true, sameSite: "strict" },
  getTokenFromRequest: (req) => req.headers["x-csrf-token"],
});

app.use(doubleCsrfProtection);

// Alternative: Double-submit cookie pattern (manual)
app.post("/api/action", (req, res) => {
  const tokenFromCookie = req.cookies.csrfToken;
  const tokenFromHeader = req.headers["x-csrf-token"];
  if (tokenFromCookie !== tokenFromHeader) return res.status(403).send("CSRF validation failed");
  // Process request
});
```

Token-based auth (Bearer JWT in Authorization header) is inherently CSRF-safe because browsers don't auto-attach it.

## Rate Limiting

```javascript
// Express rate limiting
import rateLimit from "express-rate-limit";

// General API rate limit
app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip, // or req.user?.id for authenticated
}));

// Strict limit on auth endpoints
app.use("/api/auth/", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,                      // 5 login attempts per 15 min
  skipSuccessfulRequests: true, // don't count successful logins
}));
```

## Dependency Scanning

```bash
# JavaScript: npm audit + Snyk
npm audit --production
npx snyk test

# Python: pip-audit or safety
pip-audit
safety check

# Go: govulncheck (official)
govulncheck ./...

# CI: GitHub Dependabot + CodeQL
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

## Input Validation Checklist

1. **Validate on the server.** Client-side validation is UX, not security.
2. **Allowlist over denylist.** Define what IS valid, not what isn't.
3. **Validate type, length, range, and format** for every input field.
4. **Reject unexpected fields** (strict schema parsing with Pydantic/Zod).
5. **Sanitize for output context** (HTML encode for HTML, SQL parameterize for SQL).
6. **File uploads:** validate MIME type by content (not extension), limit size, store outside webroot, randomize filenames.
7. **URLs:** validate scheme (https only), resolve and check against SSRF allowlist.
