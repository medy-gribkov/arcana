---
name: rust-best-practices
description: Idiomatic Rust development with ownership, borrowing, lifetimes, error handling (thiserror/anyhow), async Tokio patterns, traits, generics, Clippy linting, cargo workspaces, and production patterns for web services (axum/actix-web), CLI tools (clap), and systems programming. Use when writing, reviewing, or debugging Rust code.
---
You are a Rust expert specializing in safe, performant, idiomatic Rust for production systems, web services, and CLI tooling.

## Use this skill when

- Writing or reviewing Rust code
- Designing ownership/borrowing/lifetime strategies
- Building async services with Tokio
- Structuring cargo workspaces or crate architecture
- Debugging borrow checker or lifetime errors

## Ownership, Borrowing, and Lifetimes

**The three rules that prevent 90% of borrow checker fights:**
1. Each value has exactly one owner. When the owner goes out of scope, the value is dropped.
2. You can have either ONE mutable reference OR any number of immutable references (not both).
3. References must always be valid (no dangling pointers).

```rust
// BAD: moving out of a vector element
let names = vec!["alice".to_string(), "bob".to_string()];
let first = names[0]; // ERROR: cannot move out of index

// GOOD: borrow or clone
let first = &names[0];       // borrow
let first = names[0].clone(); // clone if you need ownership
```

**Lifetime annotations** - only needed when the compiler can't infer:
```rust
// The compiler needs to know: does the return value live as long as `a` or `b`?
fn longest<'a>(a: &'a str, b: &'a str) -> &'a str {
    if a.len() > b.len() { a } else { b }
}

// Struct holding a reference MUST declare the lifetime
struct Config<'a> {
    name: &'a str,
}
```

**Lifetime scopes visualized:**
```
┌─────────────────────────────────────────┐
│ fn example() {                          │
│   let owner = String::from("data");    │ ← 'owner lives here
│   ├─────────────────────────┐           │
│   │ let borrowed = &owner;  │           │ ← 'borrowed valid
│   │ println!("{borrowed}"); │           │   while owner alive
│   └─────────────────────────┘           │
│ } ← owner dropped, borrowed invalid     │
└─────────────────────────────────────────┘

Multiple borrows:
┌─────────────────────────────────────────┐
│ fn multi() {                            │
│   let mut data = vec![1, 2, 3];        │
│   ├───────────────────┐                 │
│   │ let r1 = &data;   │                 │ ← immutable borrows OK
│   │ let r2 = &data;   │                 │
│   │ println!("{r1}"); │                 │
│   └───────────────────┘                 │
│   ├───────────────────┐                 │
│   │ let r3 = &mut data; │               │ ← mutable borrow alone
│   │ r3.push(4);       │                 │
│   └───────────────────┘                 │
│ }                                       │
└─────────────────────────────────────────┘
```

**Common pitfall** - returning references to local data:
```rust
// BAD: returns reference to local String
fn bad() -> &str {
    let s = String::from("hello");
    &s // ERROR: `s` dropped here
}

// GOOD: return owned data
fn good() -> String {
    String::from("hello")
}
```

## Error Handling

Use `thiserror` for library crates (typed errors), `anyhow` for application crates (ergonomic propagation).

```rust
// Library crate: thiserror
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("database error: {0}")]
    Db(#[from] sqlx::Error),
    #[error("not found: {entity} with id {id}")]
    NotFound { entity: &'static str, id: i64 },
    #[error("validation failed: {0}")]
    Validation(String),
}

// Application crate: anyhow
use anyhow::{Context, Result};

async fn load_config(path: &str) -> Result<Config> {
    let contents = tokio::fs::read_to_string(path)
        .await
        .context("failed to read config file")?;
    let config: Config = toml::from_str(&contents)
        .context("failed to parse config TOML")?;
    Ok(config)
}
```

**Never use `.unwrap()` in production code.** Use `.expect("reason")` only for truly impossible cases. Prefer `?` propagation everywhere else.

## Async with Tokio

```rust
// Cargo.toml: tokio = { version = "1", features = ["full"] }

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Spawn concurrent tasks
    let (users, orders) = tokio::try_join!(
        fetch_users(),
        fetch_orders(),
    )?;

    // CPU-heavy work: use spawn_blocking, never block the async runtime
    let hash = tokio::task::spawn_blocking(move || {
        argon2::hash_password(&password)
    }).await??;

    Ok(())
}
```

**Async pitfalls:**
- Never call `std::thread::sleep` in async code. Use `tokio::time::sleep`.
- Never hold a `MutexGuard` (std or tokio) across an `.await` point.
- Use `tokio::sync::Mutex` only when you need to hold it across `.await`. Otherwise `std::sync::Mutex` is faster.
- `Send + Sync` bounds: if a future isn't `Send`, it can't be spawned with `tokio::spawn`. Common fix: drop non-Send types before `.await`.

## Traits and Generics

```rust
// Define behavior with traits
trait Repository: Send + Sync {
    async fn find_by_id(&self, id: i64) -> Result<Option<User>>;
    async fn save(&self, user: &User) -> Result<()>;
}

// Use impl Trait for simple cases
fn process(items: &[impl AsRef<str>]) { /* ... */ }

// Use trait objects for dynamic dispatch (runtime polymorphism)
fn get_repo(config: &Config) -> Box<dyn Repository> {
    match config.db_type {
        DbType::Postgres => Box::new(PgRepo::new()),
        DbType::Sqlite => Box::new(SqliteRepo::new()),
    }
}

// Prefer generics (static dispatch) when performance matters
fn serialize<T: Serialize>(value: &T) -> Result<Vec<u8>> { /* ... */ }
```

**Extension traits** - add methods to foreign types:
```rust
trait StringExt {
    fn truncate_ellipsis(&self, max_len: usize) -> String;
}
impl StringExt for str {
    fn truncate_ellipsis(&self, max_len: usize) -> String {
        if self.len() <= max_len { return self.to_string(); }
        format!("{}...", &self[..max_len.saturating_sub(3)])
    }
}
```

## Axum Web Service Pattern

```rust
use axum::{Router, Json, extract::{State, Path}, http::StatusCode};

#[derive(Clone)]
struct AppState {
    db: sqlx::PgPool,
}

async fn get_user(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<User>, AppError> {
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound { entity: "user", id })?;
    Ok(Json(user))
}

fn app(state: AppState) -> Router {
    Router::new()
        .route("/users/{id}", axum::routing::get(get_user))
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .layer(tower_http::cors::CorsLayer::permissive())
        .with_state(state)
}
```

## CLI with Clap

```rust
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "mytool", version, about = "A production CLI")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
    #[arg(short, long, global = true, action = clap::ArgAction::Count)]
    verbose: u8,
}

#[derive(Subcommand)]
enum Commands {
    /// Run the migration
    Migrate {
        #[arg(short, long, default_value = "postgres://localhost/mydb")]
        database_url: String,
    },
    /// Check system health
    Health,
}
```

## Clippy and Linting

```toml
# clippy.toml or .clippy.toml
avoid-breaking-exported-api = false

# Cargo.toml — deny warnings in CI
[lints.clippy]
pedantic = { level = "warn", priority = -1 }
unwrap_used = "deny"
expect_used = "warn"
dbg_macro = "deny"
todo = "warn"
```

Run: `cargo clippy --all-targets --all-features -- -D warnings`

**Key Clippy lints to always enable:** `unwrap_used`, `dbg_macro`, `print_stdout` (for libraries), `large_enum_variant` (box variants >200 bytes), `needless_pass_by_value`.

## Cargo Workspace Pattern

```toml
# Root Cargo.toml
[workspace]
members = ["crates/*"]
resolver = "2"

[workspace.package]
version = "0.1.0"
edition = "2024"

[workspace.dependencies]
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
anyhow = "1"
```

```toml
# crates/api/Cargo.toml
[package]
name = "myapp-api"
version.workspace = true
edition.workspace = true

[dependencies]
tokio.workspace = true
myapp-core = { path = "../core" }
```

Workspace layout: `crates/core` (domain logic, no IO), `crates/api` (HTTP layer), `crates/cli` (binary), `crates/db` (persistence). Core depends on nothing. API and CLI depend on core.

## Common Pitfalls

1. **String types**: Use `&str` for parameters, `String` for owned data. Never `&String`.
2. **Cloning to satisfy the borrow checker**: Usually means your architecture needs rethinking. Try restructuring to avoid the need.
3. **`Arc<Mutex<T>>`**: Fine for shared mutable state, but consider channels or `dashmap` for concurrent maps.
4. **`.collect::<Vec<_>>()` then iterate again**: Chain iterators instead. Collect only at boundaries.
5. **Not using `#[must_use]`**: Add it to functions whose return value should never be ignored (especially `Result`).
6. **Large structs on the stack**: If a struct is >1KB, `Box` it. Check with `std::mem::size_of`.
