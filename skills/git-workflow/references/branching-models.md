# Branching Models

## Trunk-Based Development (Recommended)

```
main ─────●────●────●────●────●────●────●────
           \  /      \  /      \  /
 feat/a     ●        ●        ●
            (1 day)  (1 day)  (2 days max)
```

**How it works:**
1. All developers work from `main`.
2. Feature branches live 1-2 days max.
3. Merge via squash merge or fast-forward.
4. Feature flags hide incomplete work from users.
5. `main` is always deployable.

**Best for:** Small to medium teams (2-20), continuous deployment, SaaS products.

**Workflow:**
```bash
git checkout -b feat/user-profile
# Work in small increments
git commit -m "feat(profile): add avatar upload"
git fetch origin && git rebase origin/main
gh pr create --title "Add avatar upload"
gh pr merge --squash
```

**Rules:**
- No long-lived branches. If it takes more than 2 days, break it down.
- Rebase daily to stay current with main.
- CI must pass before merge. No exceptions.

## GitHub Flow

```
main ─────●────●─────────●────●────
           \              /
 feat/x     ●────●────●─┘
            (PR + review + CI)
```

**How it works:**
1. Branch from `main`.
2. Open a PR when ready for review.
3. CI runs on every push to the PR.
4. After approval, merge to `main`.
5. Deploy from `main`.

**Best for:** Open source, small teams, projects without release trains.

**Differences from trunk-based:**
- Feature branches can live longer (days to a week).
- PR review is the gating mechanism, not feature flags.
- No develop branch. Everything goes to main.

## Git Flow

```
main    ─────●───────────────────●────
              \                 / \
develop ──●────●────●────●────●   tag v1.2.0
           \  /      \       /
 feat/a     ●        release/1.2.0
                       ●────●
                      (bug fixes)
```

**How it works:**
1. `main` holds production releases only.
2. `develop` is the integration branch.
3. Feature branches merge to `develop`.
4. Release branches cut from `develop`, bug-fixed, then merged to both `main` and `develop`.
5. Hotfix branches cut from `main` for emergency fixes.

**Best for:**
- Multiple versions in production (customer-specific deployments)
- Regulated industries (audit trail, formal release process)
- Large teams (50+) with parallel release tracks

**Workflow:**
```bash
# Feature
git checkout develop
git checkout -b feature/payment-integration
# ... work ...
git checkout develop
git merge --no-ff feature/payment-integration

# Release
git checkout -b release/1.2.0 develop
# Fix bugs in release branch
git checkout main
git merge --no-ff release/1.2.0
git tag -a v1.2.0 -m "Release v1.2.0"
git checkout develop
git merge --no-ff release/1.2.0
```

**Overhead:** High. Only use if your release process genuinely requires it.

## Decision Matrix

| Factor | Trunk-Based | GitHub Flow | Git Flow |
|--------|-------------|-------------|----------|
| Team size | 2-20 | 2-20 | 20-100+ |
| Deploy frequency | Multiple/day | Daily/weekly | Scheduled releases |
| Release process | Automated | Semi-automated | Manual/gated |
| Feature flags needed | Yes | Optional | No |
| Complexity | Low | Low | High |
| Best for | SaaS, startups | Open source, small teams | Enterprise, regulated |
