# Authentication Patterns

## JWT Authentication Flow

```typescript
// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }

  // Create access token (15 min) and refresh token (7 days)
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.REFRESH_SECRET!,
    { expiresIn: '7d' }
  );

  // Store refresh token hash in database
  await db.refreshToken.create({
    data: {
      userId: user.id,
      token: await bcrypt.hash(refreshToken, 10),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.json({ accessToken, refreshToken });
});

// Auth middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    throw new AppError(401, 'No token provided', 'NO_TOKEN');
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      email: string;
    };
    req.user = payload;
    next();
  } catch (error) {
    throw new AppError(401, 'Invalid token', 'INVALID_TOKEN');
  }
}

// Protected route
app.get('/api/profile', requireAuth, async (req, res) => {
  const user = await db.user.findUnique({ where: { id: req.user.userId } });
  res.json(user);
});

// Token refresh
app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  const payload = jwt.verify(refreshToken, process.env.REFRESH_SECRET!) as { userId: string };

  const stored = await db.refreshToken.findFirst({
    where: { userId: payload.userId, expiresAt: { gt: new Date() } },
  });

  if (!stored || !(await bcrypt.compare(refreshToken, stored.token))) {
    throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH');
  }

  const accessToken = jwt.sign(
    { userId: payload.userId },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );

  res.json({ accessToken });
});
```
