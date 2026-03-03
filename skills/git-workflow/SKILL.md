---
name: git-workflow
description: Git workflow automation with conventional commits, merge vs rebase decision trees, worktrees, SSH signing, and monorepo sparse checkout patterns.
---

## Conventional Commit Format

```bash
# BAD: vague, no type
git commit -m "changes"

# GOOD: clear type, scope, imperative mood
git commit -m "feat(auth): add OAuth2 login flow"
git commit -m "fix(api): handle null response in getUserData"
git commit -m "docs(readme): update installation steps"
```

**Format:** `type(scope): description`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

Breaking changes:
```bash
git commit -m "feat(api)!: remove deprecated v1 endpoints"
# Or in body:
git commit -m "feat(api): migrate to v2 endpoints

BREAKING CHANGE: v1 endpoints removed, use v2"
```

### Setup Commit Linting

```bash
# Install commitlint
npm install --save-dev @commitlint/config-conventional @commitlint/cli

# Create config
cat > commitlint.config.js <<'EOF'
module.exports = { extends: ['@commitlint/config-conventional'] };
EOF

# Hook with Husky
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit $1'
```

## Merge vs Rebase Decision Tree

```
Question: Is the branch shared with others?
│
├─ YES → USE MERGE
│   └─ git merge feature-branch
│      (preserves branch history, safer for collaboration)
│
└─ NO → Ask: Do you want linear history?
    │
    ├─ YES → USE REBASE
    │   └─ git rebase main
    │      (clean history, better for bisect)
    │
    └─ NO → USE MERGE
        └─ git merge --no-ff feature-branch
           (preserves feature branch context)
```

**Rebase workflow for feature branches:**

```bash
# Daily sync (before starting work)
git checkout feature-branch
git fetch origin
git rebase origin/main

# Interactive cleanup before PR
git rebase -i origin/main
# Squash "fix typo", "wip" commits

# After PR approval
git checkout main
git merge --ff-only feature-branch  # or squash in GitHub UI
```

**When rebase conflicts occur:**

```bash
# BAD: panic and force push to main
git push --force origin main  # NEVER DO THIS

# GOOD: resolve, test, continue
git rebase main
# Fix conflicts in files
git add resolved-file.js
git rebase --continue
npm test  # Always test after resolving
git push --force-with-lease origin feature-branch
```

**Abort and recover:**

```bash
# Rebase went wrong? Abort it
git rebase --abort

# Already committed a bad rebase? Find previous state
git reflog
# Outputs: abc123 HEAD@{1}: rebase finished
#          def456 HEAD@{2}: checkout: moving from main to feature
git reset --hard def456  # Go back before rebase
```

## Git Worktrees (Multiple Branches Simultaneously)

```bash
# BAD: stashing and switching repeatedly
git stash
git checkout hotfix-branch
# fix bug
git checkout main
git stash pop

# GOOD: use worktrees
git worktree add ../myproject-hotfix hotfix-branch
cd ../myproject-hotfix
# work on hotfix while main branch untouched in ../myproject

# List all worktrees
git worktree list

# Remove when done
git worktree remove ../myproject-hotfix
```

**Use case: review PR while keeping main branch clean:**

```bash
git worktree add ../myproject-pr-review pr/123
cd ../myproject-pr-review
npm install
npm test
# Review done
cd ../myproject
git worktree remove ../myproject-pr-review
```

## SSH Commit Signing Setup

```bash
# Generate signing key (Ed25519)
ssh-keygen -t ed25519 -C "your.email@example.com" -f ~/.ssh/git_signing

# Add public key to GitHub: Settings → SSH and GPG keys → New SSH key
# Paste contents of ~/.ssh/git_signing.pub, select "Signing Key"

# Configure git to use SSH signing
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/git_signing.pub
git config --global commit.gpgsign true
git config --global tag.gpgsign true

# Test it
git commit --allow-empty -m "test: verify SSH signing"
git log --show-signature
# Should show: "Good signature with ED25519 key..."
```

**Per-repository signing:**

```bash
cd my-project
git config user.signingkey ~/.ssh/git_signing_work.pub  # Different key for work
```

## Monorepo with Sparse Checkout

**Problem:** Monorepo with 50 packages, you only work on 2.

```bash
# BAD: clone entire 5GB repo
git clone https://github.com/company/monorepo.git
# Downloads 5GB, slow npm install across all packages

# GOOD: sparse checkout
git clone --filter=blob:none --sparse https://github.com/company/monorepo.git
cd monorepo
git sparse-checkout init --cone
git sparse-checkout set packages/frontend packages/api

# Only these directories are checked out:
# packages/frontend/
# packages/api/
# Root files (package.json, etc.)
```

**Add more packages later:**

```bash
git sparse-checkout add packages/shared-ui
```

**Full monorepo strategy:**

```bash
# 1. Initialize sparse checkout
git clone --filter=blob:none --sparse https://github.com/company/monorepo.git
cd monorepo

# 2. Set up workspace
git sparse-checkout set packages/my-app libs/shared-utils

# 3. Install dependencies (only for checked out packages)
npm install  # or pnpm/yarn

# 4. Configure CODEOWNERS (in repo root)
cat > .github/CODEOWNERS <<'EOF'
/packages/frontend/ @frontend-team
/packages/api/ @backend-team
/libs/shared-utils/ @platform-team
EOF

# 5. Tag releases per package
git tag @company/frontend@1.2.0
git tag @company/api@2.1.5
git push origin --tags
```

## Merge Conflict Resolution

```bash
# List conflicted files
git diff --name-only --diff-filter=U

# BAD: manually edit without understanding
vim conflicted.js  # Hope for the best

# GOOD: use strategy for simple conflicts
git checkout --theirs package-lock.json  # Take their version
git checkout --ours config/local.json    # Keep our version
git add package-lock.json config/local.json

# For complex conflicts, use mergetool
git mergetool --tool=vimdiff  # or meld, kdiff3, vscode
```

**Test after every conflict resolution:**

```bash
git rebase --continue
npm test || (git rebase --abort && echo "Tests failed, fix conflicts")
```

## Git Hooks with Lefthook

```bash
# Install lefthook (faster, polyglot alternative to Husky)
go install github.com/evilmartians/lefthook@latest
# Or: npm install lefthook --save-dev

# Create lefthook.yml
cat > lefthook.yml <<'EOF'
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{js,ts}"
      run: eslint --fix {staged_files}
    format:
      glob: "*.{js,ts,json,md}"
      run: prettier --write {staged_files}
    types:
      glob: "*.{ts,tsx}"
      run: tsc --noEmit

commit-msg:
  commands:
    commitlint:
      run: npx commitlint --edit {1}

pre-push:
  commands:
    test:
      run: npm test
    check-secrets:
      run: gitleaks detect --no-git --verbose
EOF

# Install hooks
lefthook install
```

## Branch Strategies

### Trunk-Based Development (Recommended)

```bash
# 1. Create short-lived feature branch
git checkout -b feat/user-profile

# 2. Work in small increments (1-2 days max)
git commit -m "feat(profile): add avatar upload"
git commit -m "test(profile): add avatar validation tests"

# 3. Rebase daily
git fetch origin
git rebase origin/main

# 4. Open PR when ready (same day or next day)
gh pr create --title "Add user profile avatar upload"

# 5. Squash merge to main
gh pr merge --squash
```

### Git Flow (Complex Release Cycles)

```bash
# Long-lived branches: main, develop
# Supporting: feature/*, release/*, hotfix/*

# Start feature
git checkout develop
git checkout -b feature/payment-integration

# Finish feature
git checkout develop
git merge --no-ff feature/payment-integration
git branch -d feature/payment-integration

# Create release branch
git checkout -b release/1.2.0 develop
# Fix bugs in release/1.2.0

# Merge to main and develop
git checkout main
git merge --no-ff release/1.2.0
git tag -a v1.2.0 -m "Release v1.2.0"
git checkout develop
git merge --no-ff release/1.2.0
git branch -d release/1.2.0
```

**Only use Git Flow if:**
- Multiple versions in production (e.g., SaaS with customer-specific deployments)
- Regulated industry requiring formal release process
- Large team (50+) with parallel release tracks

## Troubleshooting

```bash
# Lost commits after reset
git reflog
git cherry-pick abc123  # Restore lost commit

# Committed to wrong branch
git log  # Copy commit hash
git checkout correct-branch
git cherry-pick abc123
git checkout wrong-branch
git reset --hard HEAD~1  # Remove from wrong branch

# Remove file from history (leaked secret)
git filter-repo --path secrets.env --invert-paths
# Note: force push required, coordinate with team

# Undo last commit (keep changes staged)
git reset --soft HEAD~1

# Undo last commit (keep changes unstaged)
git reset HEAD~1

# Undo last commit (discard changes - CAREFUL)
git reset --hard HEAD~1
```
