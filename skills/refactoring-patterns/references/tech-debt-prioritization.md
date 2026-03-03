# Technical Debt Prioritization

## Scoring Formula

Score = (Frequency x Blast Radius) / Effort

- **Frequency:** How often is this code touched? (1-10)
- **Blast Radius:** How many users/features are affected if it breaks? (1-10)
- **Effort:** How long to fix? (1-10)

## Example Scoring

| Debt Item | Frequency | Blast Radius | Effort | Score |
|-----------|-----------|--------------|--------|-------|
| Refactor auth logic | 8 | 10 | 5 | 16 |
| Remove unused util | 1 | 1 | 1 | 1 |
| Split large class | 5 | 5 | 3 | 8.3 |
| Add input validation | 7 | 8 | 2 | 28 |
| Migrate ORM queries | 3 | 6 | 8 | 2.25 |

Fix highest-score items first.

## Priority Tiers

### P0: Fix Now (Score > 15)
- Security vulnerabilities in auth/payment code
- Data corruption risks
- Race conditions in concurrent writes

### P1: Fix This Sprint (Score 8-15)
- Missing error handling on critical paths
- N+1 queries on high-traffic endpoints
- Hardcoded secrets or config values

### P2: Fix Next Sprint (Score 3-8)
- Large classes that are hard to test
- Duplicate logic across modules
- Missing integration tests for core flows

### P3: Backlog (Score < 3)
- Code style inconsistencies
- Unused imports and dead code
- Missing JSDoc on internal functions

## Refactoring Workflow

1. Write tests if none exist. Refactoring without tests is gambling.
2. Make one change per commit. Small commits are reviewable and revertable.
3. Run tests after every change. Failing tests mean behavior changed.
4. Use IDE refactoring tools. They are less error-prone than manual edits.
5. Review the diff before committing. Automated tools sometimes surprise.
6. Explain intent in pull request descriptions. Clarify why structure changed.

## Tracking Template

```markdown
## Tech Debt Register

| ID | Description | File(s) | Score | Owner | Status |
|----|-------------|---------|-------|-------|--------|
| TD-001 | Auth service has 5 responsibilities | auth.ts | 16 | @dev1 | In Progress |
| TD-002 | No retry logic on payment API | payment.ts | 12 | @dev2 | Scheduled |
| TD-003 | Duplicate validation in 3 controllers | controllers/ | 8.3 | - | Backlog |
```

Review this register at the start of each sprint. Pick 1-2 items per sprint alongside feature work.
