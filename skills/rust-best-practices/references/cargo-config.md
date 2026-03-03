# Cargo Configuration Patterns

Production Cargo.toml patterns, Clippy configuration, workspace setup, release profiles, and cross-compilation targets.

## Single Crate: Full Cargo.toml

```toml
[package]
name = "myapp"
version = "0.1.0"
edition = "2024"
rust-version = "1.82"           # MSRV - minimum supported Rust version
description = "A production service"
license = "MIT"
repository = "https://github.com/user/myapp"

[dependencies]
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
axum = "0.8"
sqlx = { version = "0.8", features = ["runtime-tokio", "postgres", "migrate"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }
thiserror = "2"
anyhow = "1"
clap = { version = "4", features = ["derive", "env"] }
config = "0.14"

[dev-dependencies]
tokio-test = "0.4"
wiremock = "0.6"
assert_cmd = "2"               # CLI integration tests
predicates = "3"               # assertion helpers
tempfile = "3"
fake = { version = "3", features = ["derive"] }

[lints.clippy]
pedantic = { level = "warn", priority = -1 }
unwrap_used = "deny"
expect_used = "warn"
dbg_macro = "deny"
todo = "warn"
print_stdout = "warn"          # use tracing instead
print_stderr = "warn"
large_enum_variant = "warn"
needless_pass_by_value = "warn"
implicit_clone = "warn"
redundant_closure_for_method_calls = "warn"
```

## Workspace: Root Cargo.toml

```toml
[workspace]
members = ["crates/*"]
resolver = "2"

[workspace.package]
version = "0.1.0"
edition = "2024"
rust-version = "1.82"
license = "MIT"

[workspace.dependencies]
# Async runtime
tokio = { version = "1", features = ["full"] }
# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"
# Error handling
thiserror = "2"
anyhow = "1"
# Logging
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
# Internal crates
myapp-core = { path = "crates/core" }
myapp-db = { path = "crates/db" }
myapp-api = { path = "crates/api" }

[workspace.lints.clippy]
pedantic = { level = "warn", priority = -1 }
unwrap_used = "deny"
dbg_macro = "deny"
```

## Member Crate Template

```toml
# crates/core/Cargo.toml
[package]
name = "myapp-core"
version.workspace = true
edition.workspace = true
rust-version.workspace = true

[dependencies]
serde.workspace = true
thiserror.workspace = true

[lints]
workspace = true
```

## Clippy Config File

```toml
# clippy.toml (project root)
avoid-breaking-exported-api = false
cognitive-complexity-threshold = 15
too-many-arguments-threshold = 7
type-complexity-threshold = 250
single-char-binding-names-threshold = 4
```

## Release Profiles

```toml
# Cargo.toml
[profile.dev]
opt-level = 0
debug = true
incremental = true

[profile.release]
opt-level = 3
lto = "thin"                   # link-time optimization
codegen-units = 1              # slower compile, faster binary
strip = true                   # strip debug symbols
panic = "abort"                # smaller binary, no unwinding

[profile.release-debug]        # custom profile: release speed + debug info
inherits = "release"
debug = true
strip = false
```

## Cross-Compilation Targets

```toml
# .cargo/config.toml

# Default target for local development
# [build]
# target = "x86_64-unknown-linux-gnu"

# Linux (musl for static binaries)
[target.x86_64-unknown-linux-musl]
linker = "x86_64-linux-musl-gcc"

# macOS (Apple Silicon)
[target.aarch64-apple-darwin]
rustflags = ["-C", "target-cpu=native"]

# Windows (MSVC)
[target.x86_64-pc-windows-msvc]
rustflags = ["-C", "target-feature=+crt-static"]
```

```bash
# Install targets
rustup target add x86_64-unknown-linux-musl
rustup target add aarch64-apple-darwin
rustup target add x86_64-pc-windows-msvc

# Build for specific target
cargo build --release --target x86_64-unknown-linux-musl

# Cross-compile with cross (Docker-based, handles toolchains)
cargo install cross
cross build --release --target aarch64-unknown-linux-gnu
```

## CI Build Matrix

```yaml
# .github/workflows/ci.yml (excerpt)
strategy:
  matrix:
    include:
      - target: x86_64-unknown-linux-gnu
        os: ubuntu-latest
      - target: x86_64-apple-darwin
        os: macos-latest
      - target: x86_64-pc-windows-msvc
        os: windows-latest
```

## Useful Cargo Commands

```bash
cargo clippy --all-targets --all-features -- -D warnings
cargo test --workspace                # test all crates
cargo doc --no-deps --open            # generate and open docs
cargo audit                           # check for vulnerable deps
cargo deny check                      # license and advisory checks
cargo bloat --release                 # analyze binary size
cargo tree -d                         # find duplicate dependencies
cargo update --dry-run                # check available updates
```
