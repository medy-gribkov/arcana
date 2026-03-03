# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 3.1.x   | Yes       |
| 3.0.x   | Security fixes only |
| < 3.0   | No        |

## Reporting a Vulnerability

If you find a security issue in Arcana, please report it responsibly.

**Do not open a public issue.** Instead:

1. Use [GitHub Security Advisories](https://github.com/medy-gribkov/arcana/security/advisories/new) to report privately.
2. Or email: medy@sporesec.com

Include:
- Which skill or CLI component is affected
- Steps to reproduce
- Impact assessment (what could go wrong)

We will respond within 48 hours and work with you on a fix before any public disclosure.

## Scope

This policy covers:
- All skills in the `skills/` directory
- The CLI tool (`cli/`)
- CI/CD workflows (`.github/workflows/`)
- Bundled scripts (`skills/*/scripts/`)

## What Counts as a Vulnerability

- Command injection in scripts
- Path traversal in file operations
- Secrets or credentials accidentally committed
- Supply chain issues in dependencies
- Personal path leaks (PII exposure)
- Unsafe eval or shell execution patterns

## Built-in Security

Arcana includes automated security scanning:
- `arcana scan --all` detects path leaks, injection, secrets, and eval patterns
- `arcana verify --all` checks SHA-256 integrity of installed skills
- `arcana lock --ci` validates reproducible installs in CI pipelines
- Pre-install security scan blocks skills with critical findings

## Disclosure Timeline

We target a 90-day disclosure timeline from initial report to public advisory.

## What Does Not Count

- Skills that produce incorrect output (that is a bug, not a security issue)
- Missing input validation in SKILL.md descriptions

## License

This project is licensed under [Apache 2.0](LICENSE), which includes patent and trademark protections. See [NOTICE](NOTICE) for attribution requirements.
