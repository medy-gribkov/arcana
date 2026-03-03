---
name: oauth-auth
description: OAuth2, OIDC, JWT validation, session management, PKCE flows, refresh token rotation, and auth middleware
user-invokable: true
---

# OAuth and Authentication

Implement secure OAuth2 flows, JWT validation, session management, and authentication patterns.

## OAuth2 Authorization Code Flow with PKCE

**BAD: No PKCE, state stored in localStorage**
```typescript
// Client initiates OAuth without PKCE
const authUrl = `https://provider.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;
localStorage.setItem('oauth_state', Math.random().toString());
window.location.href = authUrl;
```

**GOOD: PKCE with httpOnly cookie state**
```typescript
import crypto from 'crypto';

// Generate PKCE challenge
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  return { verifier, challenge };
}

// Initiate OAuth with PKCE
export async function initiateOAuth(res: Response) {
  const { verifier, challenge } = generatePKCE();
  const state = crypto.randomBytes(32).toString('base64url');

  // Store verifier and state in httpOnly cookie
  res.setHeader('Set-Cookie', [
    `pkce_verifier=${verifier}; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  ]);

  const params = new URLSearchParams({
    client_id: process.env.OAUTH_CLIENT_ID!,
    redirect_uri: process.env.OAUTH_REDIRECT_URI!,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });

  return `https://provider.com/oauth/authorize?${params}`;
}
```

## Token Exchange and Validation

**BAD: No validation, symmetric JWT with weak secret**
```typescript
// Exchange code without validating state
const response = await fetch('https://provider.com/oauth/token', {
  method: 'POST',
  body: JSON.stringify({ code, client_id: clientId, client_secret: secret })
});
const { access_token } = await response.json();

// Weak symmetric JWT
import jwt from 'jsonwebtoken';
const token = jwt.sign({ userId }, 'weak-secret', { expiresIn: '1h' });
```

**GOOD: State validation, PKCE verification, asymmetric JWT**
```typescript
import { SignJWT, jwtVerify, importSPKI, importPKCS8 } from 'jose';

export async function handleOAuthCallback(
  code: string,
  state: string,
  cookies: Record<string, string>
) {
  // Validate state to prevent CSRF
  if (state !== cookies.oauth_state) {
    throw new Error('Invalid state parameter');
  }

  // Exchange code with PKCE verifier
  const response = await fetch('https://provider.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.OAUTH_REDIRECT_URI!,
      client_id: process.env.OAUTH_CLIENT_ID!,
      code_verifier: cookies.pkce_verifier
    })
  });

  if (!response.ok) {
    throw new Error('Token exchange failed');
  }

  const tokens = await response.json();
  return tokens;
}

// Create asymmetric JWT (RS256)
export async function createAccessToken(payload: Record<string, any>) {
  const privateKey = await importPKCS8(
    process.env.JWT_PRIVATE_KEY!,
    'RS256'
  );

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(process.env.JWT_ISSUER!)
    .setAudience(process.env.JWT_AUDIENCE!)
    .setExpirationTime('15m')
    .sign(privateKey);
}

// Verify JWT with public key
export async function verifyAccessToken(token: string) {
  const publicKey = await importSPKI(
    process.env.JWT_PUBLIC_KEY!,
    'RS256'
  );

  const { payload } = await jwtVerify(token, publicKey, {
    issuer: process.env.JWT_ISSUER!,
    audience: process.env.JWT_AUDIENCE!
  });

  return payload;
}
```

## Refresh Token Rotation with Reuse Detection

**BAD: No rotation, long-lived refresh tokens**
```typescript
// Single refresh token, no rotation
const refreshToken = crypto.randomBytes(32).toString('hex');
await db.saveRefreshToken(userId, refreshToken, { expiresIn: '30d' });
```

**GOOD: Rotation with family tracking and reuse detection**
```typescript
interface RefreshToken {
  tokenHash: string;
  userId: string;
  family: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedBy?: string;
}

export async function createRefreshToken(userId: string, family?: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const tokenFamily = family || crypto.randomBytes(16).toString('hex');

  await db.refreshTokens.create({
    tokenHash,
    userId,
    family: tokenFamily,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });

  return { token, family: tokenFamily };
}

export async function rotateRefreshToken(token: string) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const existing = await db.refreshTokens.findOne({ tokenHash });

  if (!existing || existing.expiresAt < new Date()) {
    throw new Error('Invalid or expired refresh token');
  }

  // Reuse detection: if token already replaced, revoke entire family
  if (existing.revokedAt || existing.replacedBy) {
    await db.refreshTokens.updateMany(
      { family: existing.family },
      { revokedAt: new Date() }
    );
    throw new Error('Token reuse detected, family revoked');
  }

  // Create new token in same family
  const { token: newToken, family } = await createRefreshToken(
    existing.userId,
    existing.family
  );

  // Mark old token as replaced
  await db.refreshTokens.updateOne(
    { tokenHash },
    {
      revokedAt: new Date(),
      replacedBy: crypto.createHash('sha256').update(newToken).digest('hex')
    }
  );

  return { accessToken: await createAccessToken({ userId: existing.userId }), refreshToken: newToken };
}
```

## Session Management

**BAD: Tokens in localStorage, no CSRF protection**
```typescript
// Client stores tokens in localStorage
localStorage.setItem('access_token', accessToken);
localStorage.setItem('refresh_token', refreshToken);

// No CSRF protection
fetch('/api/sensitive', {
  headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
});
```

**GOOD: httpOnly cookies with CSRF tokens**
```typescript
import { serialize } from 'cookie';

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string
) {
  const csrfToken = crypto.randomBytes(32).toString('base64url');

  res.setHeader('Set-Cookie', [
    serialize('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60, // 15 minutes
      path: '/'
    }),
    serialize('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/api/auth/refresh'
    }),
    serialize('csrf_token', csrfToken, {
      httpOnly: false, // Accessible to JS for request headers
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/'
    })
  ]);

  return csrfToken;
}

// Middleware validates CSRF token
export function validateCSRF(req: Request) {
  const cookieCSRF = req.cookies.csrf_token;
  const headerCSRF = req.headers.get('X-CSRF-Token');

  if (!cookieCSRF || cookieCSRF !== headerCSRF) {
    throw new Error('CSRF validation failed');
  }
}
```

## NextAuth.js/Auth.js Pattern

```typescript
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { JWT } from 'next-auth/jwt';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code'
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60 // 7 days
  },
  callbacks: {
    async jwt({ token, account, user }) {
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at! * 1000,
          userId: user.id
        };
      }

      // Return previous token if access token not expired
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Refresh access token
      return await refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.accessToken = token.accessToken as string;
      return session;
    }
  }
});

async function refreshAccessToken(token: JWT) {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken as string
      })
    });

    const refreshed = await response.json();

    if (!response.ok) {
      throw refreshed;
    }

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      refreshToken: refreshed.refresh_token ?? token.refreshToken
    };
  } catch (error) {
    return {
      ...token,
      error: 'RefreshAccessTokenError'
    };
  }
}
```

## Password Hashing with bcrypt

**BAD: Plain text or weak hashing**
```typescript
// Plain text password
await db.users.create({ email, password });

// Weak hash
import crypto from 'crypto';
const hash = crypto.createHash('md5').update(password).digest('hex');
```

**GOOD: bcrypt with salt rounds**
```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// Usage in registration
export async function registerUser(email: string, password: string) {
  const existingUser = await db.users.findOne({ email });
  if (existingUser) {
    throw new Error('User already exists');
  }

  const passwordHash = await hashPassword(password);
  return await db.users.create({ email, passwordHash });
}
```

## Authentication Middleware

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function authMiddleware(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const payload = await verifyAccessToken(token);

    // Attach user to request headers for route handlers
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('X-User-Id', payload.userId as string);

    return NextResponse.next({
      request: { headers: requestHeaders }
    });
  } catch (error) {
    // Token invalid or expired, try refresh
    const refreshToken = req.cookies.get('refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    try {
      const { accessToken, refreshToken: newRefreshToken } =
        await rotateRefreshToken(refreshToken);

      const response = NextResponse.next();
      setAuthCookies(response, accessToken, newRefreshToken);

      return response;
    } catch (refreshError) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }
}

// middleware.ts
export { authMiddleware as middleware };

export const config = {
  matcher: ['/dashboard/:path*', '/api/protected/:path*']
};
```

## Token Revocation

```typescript
// Revoke all tokens for a user (on password change, logout all devices)
export async function revokeAllUserTokens(userId: string) {
  await db.refreshTokens.updateMany(
    { userId, revokedAt: null },
    { revokedAt: new Date() }
  );
}

// Revoke specific token
export async function revokeRefreshToken(token: string) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await db.refreshTokens.updateOne(
    { tokenHash },
    { revokedAt: new Date() }
  );
}

// Cleanup expired tokens (run daily)
export async function cleanupExpiredTokens() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
  await db.refreshTokens.deleteMany({
    expiresAt: { $lt: cutoff }
  });
}
```

## OIDC ID Token Validation

```typescript
import { jwtVerify, createRemoteJWKSet } from 'jose';

export async function validateIDToken(
  idToken: string,
  clientId: string,
  issuer: string
) {
  const JWKS = createRemoteJWKSet(
    new URL(`${issuer}/.well-known/jwks.json`)
  );

  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer,
    audience: clientId,
    maxTokenAge: '10m'
  });

  // Validate nonce if using implicit flow
  if (payload.nonce) {
    // Compare with stored nonce from initial request
  }

  return {
    sub: payload.sub,
    email: payload.email as string,
    email_verified: payload.email_verified as boolean,
    name: payload.name as string
  };
}
```

Run workflow: detect auth pattern needed, choose flow (OAuth2 code + PKCE for third-party, session cookies for first-party), implement token storage with httpOnly cookies, add CSRF protection, implement refresh rotation with reuse detection, add middleware guards, validate all tokens with asymmetric keys.
