# Python Linting & Tooling Configs

Ready-to-copy configurations for ruff, mypy, pytest, and pre-commit. These complement the pyproject.toml in SKILL.md with deeper options.

## Ruff: Full Production Config

```toml
[tool.ruff]
target-version = "py312"
line-length = 100
src = ["src"]
fix = true                    # Auto-fix safe violations
unsafe-fixes = false          # Never auto-fix unsafe ones

[tool.ruff.lint]
select = [
    "E", "F", "W",           # pyflakes + pycodestyle
    "I",                      # isort
    "N",                      # pep8-naming
    "UP",                     # pyupgrade (modernize syntax)
    "B",                      # flake8-bugbear
    "A",                      # flake8-builtins
    "SIM",                    # flake8-simplify
    "RUF",                    # ruff-specific
    "ANN",                    # type hint enforcement
    "PT",                     # pytest style
    "S",                      # flake8-bandit (security)
    "C4",                     # flake8-comprehensions
    "DTZ",                    # flake8-datetimez (naive datetime traps)
    "T20",                    # flake8-print (no print statements)
    "ARG",                    # flake8-unused-arguments
    "ERA",                    # eradicate (commented-out code)
    "PL",                     # pylint rules subset
    "PERF",                   # perflint (performance anti-patterns)
    "FURB",                   # refurb (modern Python idioms)
]
ignore = [
    "ANN101",                 # no type annotation for self
    "ANN102",                 # no type annotation for cls
    "S101",                   # allow assert in tests
    "PLR0913",                # too many arguments (handle case-by-case)
]

[tool.ruff.lint.per-file-ignores]
"tests/**/*.py" = [
    "S101",                   # assert is fine in tests
    "ANN",                    # skip type annotations in tests
    "ARG",                    # unused fixtures are fine
    "T20",                    # print OK in tests
]
"scripts/**/*.py" = ["T20"]   # print OK in scripts
"**/conftest.py" = ["ANN"]

[tool.ruff.lint.isort]
known-first-party = ["myproject"]
force-single-line = false
lines-after-imports = 2

[tool.ruff.lint.pydocstyle]
convention = "google"

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
docstring-code-format = true
```

## Mypy: Strict Config

```toml
[tool.mypy]
python_version = "3.12"
strict = true
warn_return_any = true
warn_unused_configs = true
warn_unreachable = true
show_error_codes = true
pretty = true

# Per-module overrides for untyped third-party libs
[[tool.mypy.overrides]]
module = ["httpx.*", "uvicorn.*"]
ignore_missing_imports = true

[[tool.mypy.overrides]]
module = "tests.*"
disallow_untyped_defs = false
disallow_untyped_decorators = false
```

## Pytest: Full Config

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
addopts = [
    "--strict-markers",       # fail on unknown markers
    "--strict-config",        # fail on config errors
    "-ra",                    # show summary of all non-passing
    "--tb=short",             # shorter tracebacks
    "--cov=src",              # coverage for src/
    "--cov-report=term-missing",
    "--cov-fail-under=80",    # minimum coverage threshold
]
markers = [
    "slow: marks tests as slow (deselect with '-m \"not slow\"')",
    "integration: requires external services",
]
filterwarnings = [
    "error",                  # treat all warnings as errors
    "ignore::DeprecationWarning:third_party.*",
]
```

## Pre-commit Config

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.13.0
    hooks:
      - id: mypy
        additional_dependencies: [pydantic>=2.6, httpx>=0.27]
        args: [--strict]

  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-toml
      - id: check-added-large-files
        args: [--maxkb=500]
      - id: debug-statements
```

## Coverage Config

```toml
[tool.coverage.run]
source = ["src"]
branch = true
omit = ["*/tests/*", "*/conftest.py"]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
    "if __name__ == .__main__.:",
    "@overload",
    "raise NotImplementedError",
]
show_missing = true
fail_under = 80
```

## Quick Commands

```bash
uv run ruff check src/ --fix     # lint + auto-fix
uv run ruff format src/ tests/   # format
uv run mypy src/                 # type check
uv run pytest                    # test with coverage
uv run pytest -m "not slow"      # skip slow tests
uv run pytest -k "test_user"     # run matching tests
uv run pytest --lf               # rerun last failures
```
