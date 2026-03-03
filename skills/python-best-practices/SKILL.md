---
name: python-best-practices
description: Modern Python 3.12+ development with strict type hints, ruff linting, uv package manager, async/await patterns, dataclasses vs Pydantic v2, pytest conventions, virtual environments, src layout project structure, and pyproject.toml configuration. Use when writing, reviewing, or scaffolding Python code.
---
You are a Python expert specializing in modern Python 3.12+ with strict typing, fast tooling (ruff, uv), and production-grade patterns.

## Use this skill when

- Writing or reviewing Python code
- Setting up Python project structure and tooling
- Choosing between dataclasses, Pydantic, attrs
- Building async Python services or CLI tools
- Configuring linting, testing, or packaging

## Project Structure (src layout)

```
myproject/
  pyproject.toml
  src/
    myproject/
      __init__.py
      main.py
      models.py
      services/
        __init__.py
        user.py
  tests/
    conftest.py
    test_models.py
    test_services/
      test_user.py
```

The `src/` layout prevents accidental imports of the local package without installing it. Always use it for libraries. Flat layout is acceptable for single-file scripts and small apps only.

## pyproject.toml (single source of truth)

```toml
[project]
name = "myproject"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "httpx>=0.27",
    "pydantic>=2.6",
]

[project.optional-dependencies]
dev = ["ruff", "pytest", "pytest-asyncio", "mypy", "pre-commit"]

[project.scripts]
myproject = "myproject.main:cli"

[tool.ruff]
target-version = "py312"
line-length = 100
src = ["src"]

[tool.ruff.lint]
select = [
    "E", "F", "W",   # pyflakes + pycodestyle
    "I",              # isort
    "N",              # pep8-naming
    "UP",             # pyupgrade
    "B",              # flake8-bugbear
    "A",              # flake8-builtins
    "SIM",            # flake8-simplify
    "RUF",            # ruff-specific
    "ANN",            # flake8-annotations (type hint enforcement)
    "PT",             # flake8-pytest-style
]
ignore = ["ANN101"]  # don't require type annotation for `self`

[tool.ruff.lint.isort]
known-first-party = ["myproject"]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"

[tool.mypy]
strict = true
python_version = "3.12"

[tool.pyright]
pythonVersion = "3.12"
typeCheckingMode = "strict"
reportMissingTypeStubs = false
```

## uv Package Manager

```bash
# Install uv (replaces pip, pip-tools, virtualenv, pipx)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create project with virtual environment
uv init myproject && cd myproject
uv venv                     # creates .venv
uv add httpx pydantic       # adds to pyproject.toml + installs
uv add --dev ruff pytest    # dev dependencies
uv sync                     # install all deps from lockfile
uv run pytest               # run inside venv without activation
uv run ruff check src/      # lint
uv run mypy src/            # type check with mypy
uv run pyright src/         # type check with pyright (faster, VSCode default)
```

**Why uv over pip:** 10-100x faster, built-in lockfile (`uv.lock`), replaces 5 tools in one binary, written in Rust.

**Type checker comparison:**
- **mypy**: Industry standard, slower, more mature plugins.
- **pyright**: Faster, VS Code default, better error messages, strict mode catches more edge cases.

## Type Hints (strict, everywhere)

```python
from collections.abc import Sequence, Mapping
from typing import TypeAlias, TypeVar, Self

# Use builtin generics (3.12+), not typing.List/Dict
def process(items: list[str]) -> dict[str, int]: ...

# Use collections.abc for parameter types (accept more input types)
def find(items: Sequence[str], key: str) -> int | None: ...

# TypeAlias for complex types
UserId: TypeAlias = int
Headers: TypeAlias = Mapping[str, str]

# TypeVar with bounds
T = TypeVar("T", bound="Base")

def clone(obj: T) -> T:
    return obj.model_copy()

# 3.12 type statement (new syntax)
type Point = tuple[float, float]
type Handler[T] = Callable[[T], Awaitable[None]]
```

**Rules:**
- Never use `Any` unless interfacing with untyped third-party code. Even then, cast immediately.
- Return types on every function. Parameter types on every parameter.
- Use `X | None` not `Optional[X]` (3.10+ syntax).
- Use `collections.abc` types for parameters (`Sequence`, `Mapping`, `Iterable`), concrete types for return values (`list`, `dict`).

## Dataclasses vs Pydantic v2

```python
# Dataclass: for internal data containers, no validation needed
from dataclasses import dataclass, field

@dataclass(frozen=True, slots=True)
class Point:
    x: float
    y: float
    label: str = ""
    tags: list[str] = field(default_factory=list)

# Pydantic v2: for external data (APIs, config, user input) — validates on creation
from pydantic import BaseModel, Field, field_validator

class UserCreate(BaseModel):
    model_config = {"strict": True}

    name: str = Field(min_length=1, max_length=100)
    email: str
    age: int = Field(ge=0, le=150)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("invalid email")
        return v.lower()
```

**Decision rule:** Pydantic for boundaries (API input, config files, external data). Dataclasses for everything internal. Never use plain dicts for structured data.

## Async/Await Patterns

```python
import asyncio
import httpx

# Concurrent HTTP requests
async def fetch_all(urls: list[str]) -> list[str]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        tasks = [client.get(url) for url in urls]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        results: list[str] = []
        for resp in responses:
            if isinstance(resp, BaseException):
                results.append(f"ERROR: {resp}")
            else:
                results.append(resp.text)
        return results

# Semaphore for rate limiting
async def fetch_limited(urls: list[str], max_concurrent: int = 10) -> list[str]:
    sem = asyncio.Semaphore(max_concurrent)
    async with httpx.AsyncClient() as client:
        async def _fetch(url: str) -> str:
            async with sem:
                resp = await client.get(url)
                return resp.text
        return await asyncio.gather(*[_fetch(u) for u in urls])

# Structured concurrency with TaskGroup (3.11+)
async def process_batch(items: list[str]) -> None:
    async with asyncio.TaskGroup() as tg:
        for item in items:
            tg.create_task(process_one(item))
    # All tasks complete or all cancelled on first exception
```

**Async rules:**
- Use `httpx` not `requests` for async HTTP. `aiohttp` is also fine.
- Never call blocking IO (`open()`, `time.sleep()`, `requests.get()`) in async code. Use `asyncio.to_thread()` for unavoidable blocking calls.
- Use `TaskGroup` (3.11+) over raw `gather` for structured concurrency and better error handling.

## Pytest Conventions

```python
# tests/conftest.py — shared fixtures
import pytest
from myproject.db import Database

@pytest.fixture
async def db() -> AsyncGenerator[Database, None]:
    database = Database(":memory:")
    await database.connect()
    yield database
    await database.disconnect()

@pytest.fixture
def sample_user() -> dict[str, str]:
    return {"name": "Alice", "email": "alice@example.com"}

# tests/test_user.py
import pytest
from myproject.services.user import create_user, UserError

async def test_create_user_success(db: Database, sample_user: dict[str, str]) -> None:
    user = await create_user(db, **sample_user)
    assert user.name == "Alice"
    assert user.id is not None

async def test_create_user_duplicate_email(db: Database, sample_user: dict[str, str]) -> None:
    await create_user(db, **sample_user)
    with pytest.raises(UserError, match="already exists"):
        await create_user(db, **sample_user)

@pytest.mark.parametrize("email,valid", [
    ("user@example.com", True),
    ("invalid", False),
    ("", False),
    ("a@b.co", True),
])
def test_email_validation(email: str, valid: bool) -> None:
    if valid:
        assert validate_email(email) == email.lower()
    else:
        with pytest.raises(ValueError):
            validate_email(email)
```

**Pytest rules:** Name files `test_*.py`. Name functions `test_*`. Use fixtures, not setUp/tearDown. Use `parametrize` for data-driven tests. Use `conftest.py` for shared fixtures (pytest discovers them automatically).

## Anti-Patterns to Avoid

1. **Mutable default arguments:** `def f(items=[])` shares the list across calls. Use `def f(items: list[str] | None = None)` then `items = items or []`.
2. **Bare except:** Never `except:` or `except Exception:` without re-raising. Catch specific exceptions.
3. **String formatting with `%` or `.format()`:** Use f-strings: `f"Hello {name}"`.
4. **`import *`:** Never in production code. Pollutes namespace, breaks type checkers.
5. **Nested dicts for structured data:** Use dataclasses or Pydantic. `data["user"]["address"]["city"]` is untyped and crashes with KeyError.
6. **`os.path` for path manipulation:** Use `pathlib.Path` everywhere.
7. **`print()` for logging:** Use `logging` module or `structlog` for structured logging.
8. **Not using `if __name__ == "__main__":`** in executable modules.
9. **Global mutable state:** Pass dependencies as parameters. Use dependency injection.
10. **Ignoring ruff/mypy warnings:** Fix them. They catch real bugs.
