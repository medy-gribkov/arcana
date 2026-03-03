---
name: spec-driven-dev
description: Specification-driven development with structured requirements, planning workflows, task breakdown, and quality gates. Covers product briefs, PRDs, technical specs, and implementation plans.
user-invokable: true
argument-hint: "[feature or project name]"
---

# Specification-Driven Development

You are a specification architect. Convert vague ideas into precise, testable requirements. Plan before coding. Break work into parallelizable tasks with clear dependencies.

## Core Principles

1. **Specifications drive code, not the reverse.** Write the spec first. Code implements the spec.
2. **Ambiguity is a bug.** Every unclear requirement gets a `[NEEDS CLARIFICATION]` marker.
3. **Research before design.** Investigate unknowns before committing to architecture.
4. **Test-first ordering.** Contracts, then tests, then implementation.
5. **Parallel by default.** Mark independent tasks with `[P]` for concurrent execution.

## Requirements Specification

**BAD** - Vague requirements:

```markdown
## Feature: User Authentication
- Users should be able to log in
- Add social login
- Make it secure
```

**GOOD** - Structured spec with acceptance criteria:

```markdown
## Feature: User Authentication

### User Stories
- As a new user, I can register with email/password so I have an account
- As a returning user, I can log in with email/password so I access my data
- As a user, I can log in with Google OAuth so I skip manual registration

### Acceptance Criteria
1. Registration validates: email format, password >= 12 chars, no reuse of last 5
2. Login rate-limits to 5 attempts per 15 minutes per IP
3. Sessions expire after 24h idle, 7d absolute maximum
4. OAuth callback validates state parameter against CSRF
5. All auth endpoints return consistent error shape: `{ error: string, code: string }`

### Out of Scope
- Apple Sign-In (deferred to v2)
- MFA/2FA (separate spec)

### Open Questions
- [NEEDS CLARIFICATION] Session storage: Redis vs DB-backed?
- [NEEDS CLARIFICATION] Password reset flow: email link vs code?
```

## Planning Workflow

**BAD** - Jump straight to code:

```
User: "Add a dashboard"
Dev: *starts writing React components*
# 3 days later: wrong data model, missing API endpoints, no error states
```

**GOOD** - Structured planning phases:

```markdown
## Phase 0: Research (1-2 hours)
- [ ] Audit existing auth system for session format
- [ ] Benchmark Redis vs Postgres for session storage
- [ ] Review competitor dashboards for UX patterns
- [ ] Check existing component library for reusable widgets

## Phase 1: Technical Spec (2-4 hours)
- [ ] Data model: tables, relations, indexes
- [ ] API contracts: endpoints, request/response shapes, status codes
- [ ] Architecture decision records (ADRs) for key choices
- [ ] Security review: auth flows, input validation, rate limiting

## Phase 2: Task Breakdown (1 hour)
- [ ] Break into 2-4 hour tasks
- [ ] Mark parallel tasks with [P]
- [ ] Identify blocking dependencies
- [ ] Estimate total effort

## Phase 3: Implementation (test-first)
- [ ] Write contract tests for API endpoints
- [ ] Implement data layer + migrations
- [ ] Build API endpoints (verify contract tests pass)
- [ ] Build UI components
- [ ] Integration tests
```

## Task Breakdown

**BAD** - Monolithic task list:

```markdown
## Tasks
1. Build the dashboard
2. Add the API
3. Write tests
4. Deploy
```

**GOOD** - Parallelizable tasks with dependencies:

```markdown
## Tasks: Dashboard Feature

### Track A: Data Layer [P]
- A1. Write migration: `dashboard_widgets` table (2h)
- A2. Write migration: `user_preferences` table (1h)
- A3. Seed development data (1h)

### Track B: API [P] (depends: A1, A2)
- B1. `GET /api/dashboard` - aggregated widget data (3h)
- B2. `PATCH /api/dashboard/layout` - save layout (2h)
- B3. Contract tests for B1, B2 (2h)

### Track C: UI [P] (depends: B1 contract)
- C1. `<DashboardGrid />` with drag-and-drop (4h)
- C2. `<WidgetCard />` component family (3h)
- C3. `<DashboardSkeleton />` loading state (1h)

### Track D: Integration (depends: B1, C1, C2)
- D1. Wire API to UI with React Query (2h)
- D2. E2E test: load dashboard, rearrange, save (2h)
- D3. Error boundary + empty state (1h)

### Dependency Graph
A1,A2 --> B1,B2 --> D1
              |         |
              +--> C1,C2 -> D2,D3
A3 (parallel, no deps)
```

## Technical Spec Template

```markdown
# Technical Spec: [Feature Name]

## Overview
One paragraph. What problem does this solve? Who benefits?

## Data Model
| Table | Column | Type | Notes |
|-------|--------|------|-------|
| users | id | uuid | PK |
| users | email | varchar(255) | unique, indexed |

## API Contracts
### POST /api/auth/register
Request:
  { "email": "string", "password": "string" }
Response 201:
  { "user": { "id": "uuid", "email": "string" }, "token": "string" }
Response 400:
  { "error": "string", "code": "VALIDATION_ERROR" }
Response 409:
  { "error": "Email already registered", "code": "DUPLICATE" }

## Architecture Decisions
### ADR-001: Session Storage
**Decision:** Redis with 24h TTL
**Alternatives:** Postgres sessions, JWT-only
**Rationale:** Sub-ms reads, automatic expiry, horizontal scaling

## Security Considerations
- Rate limiting: 5 req/15min per IP on auth endpoints
- Password hashing: argon2id with default parameters
- CSRF: Double-submit cookie pattern

## Open Questions
- [NEEDS CLARIFICATION] Email verification required before first login?
```

## Quality Gates

Run these checks before moving between phases:

### Spec Review Checklist
- [ ] Every feature has acceptance criteria with concrete numbers
- [ ] No `[NEEDS CLARIFICATION]` markers remain unresolved
- [ ] Out-of-scope items documented (prevents scope creep)
- [ ] Edge cases listed: empty states, error states, concurrent access
- [ ] Performance requirements stated: response time, throughput, data volume

### Plan Review Checklist
- [ ] Data model supports all acceptance criteria
- [ ] API contracts cover all user stories
- [ ] No circular dependencies in task graph
- [ ] Each task is 2-4 hours (larger tasks need splitting)
- [ ] Critical path identified and total estimate calculated

### Pre-Implementation Checklist
- [ ] Contract tests written and failing (test-first)
- [ ] Migration scripts reviewed (up AND down)
- [ ] Environment variables documented
- [ ] Rollback plan documented

## Agent Roles

When planning, shift your perspective based on the phase:

| Phase | Think As | Focus |
|-------|----------|-------|
| Requirements | Product Manager | User value, acceptance criteria, scope |
| Research | Analyst | Unknowns, benchmarks, prior art, risks |
| Architecture | Architect | Data model, API contracts, trade-offs |
| Task Breakdown | Scrum Master | Parallelism, dependencies, estimates |
| Implementation | Developer | Test-first, clean code, error handling |
| Review | QA Engineer | Edge cases, security, performance |

## Procedural Workflow

1. **Gather requirements.** Write user stories with acceptance criteria. Mark unknowns.
2. **Resolve unknowns.** Research each `[NEEDS CLARIFICATION]`. Make decisions. Document ADRs.
3. **Write technical spec.** Data model, API contracts, security considerations.
4. **Break into tasks.** 2-4h chunks. Mark parallel tracks with `[P]`. Draw dependency graph.
5. **Run quality gates.** Spec checklist, plan checklist, pre-implementation checklist.
6. **Implement test-first.** Contract tests fail, then implement until they pass.
7. **Review against spec.** Every acceptance criterion maps to a passing test.

Never start coding before the spec is complete. Every `[NEEDS CLARIFICATION]` must be resolved. Tasks without dependency graphs will block parallel execution.
