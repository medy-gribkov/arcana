# Security Policy

## Reporting a Vulnerability

If you find a security issue in Arcana, please report it responsibly.

**Do not open a public issue.** Instead:

1. Use [GitHub Security Advisories](https://github.com/medy-gribkov/arcana/security/advisories/new) to report privately.
2. Or email: mahdy@mahdygribkov.com

Include:
- Which skill is affected
- Steps to reproduce
- Impact assessment (what could go wrong)

I will respond within 48 hours and work with you on a fix before any public disclosure.

## Scope

This policy covers:
- All skills in the `skills/` directory
- The CLI tool (`cli/`)
- CI/CD workflows (`.github/workflows/`)

## What Counts as a Vulnerability

- Command injection in scripts
- Path traversal in file operations
- Secrets or credentials accidentally committed
- Supply chain issues in dependencies

## Disclosure Timeline

We target a 90-day disclosure timeline from initial report to public advisory.

## What Does Not Count

- Skills that produce incorrect output (that is a bug, not a security issue)
- Missing input validation in SKILL.md descriptions
