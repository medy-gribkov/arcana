---
name: local-security
description: Developer workstation security covering SSH key management, GPG signing, credential stores, file permissions, agent forwarding, IDE hardening, and browser extension auditing.
---

Treat the developer workstation as a critical supply chain node. A compromised dev machine means compromised code, credentials, and infrastructure access. Follow these workflows to harden each surface.

## SSH Hardening Workflow

1. **Generate** an Ed25519 key per service. One key for GitHub, another for production servers, another for cloud.
2. **Protect** the private key with a passphrase. Load it into `ssh-agent` so you type it once.
3. **Lock permissions** on the `.ssh` directory and all key files.
4. **Configure** `~/.ssh/config` to use ProxyJump instead of agent forwarding.
5. **Rotate** keys annually. Remove old public keys from every authorized service.

```bash
# Step 1: Generate a dedicated key
ssh-keygen -t ed25519 -C "github@workstation" -f ~/.ssh/id_ed25519_github

# Step 2: Add to agent with passphrase caching
ssh-add ~/.ssh/id_ed25519_github

# Step 3: Lock permissions
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_ed25519_*
chmod 644 ~/.ssh/*.pub

# Step 5: Verify fingerprint before trusting a key
ssh-keygen -l -f ~/.ssh/id_ed25519_github.pub
```

**BAD - Single key reused everywhere, no passphrase, open permissions:**
```bash
ssh-keygen -t rsa -b 2048 -N "" -f ~/.ssh/id_rsa
chmod 755 ~/.ssh
# Same key added to GitHub, AWS, production bastion, personal VPS
```

**GOOD - Dedicated Ed25519 key, passphrase, tight permissions:**
```bash
ssh-keygen -t ed25519 -C "github@workstation" -f ~/.ssh/id_ed25519_github
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_ed25519_github
```

**BAD - Agent forwarding to untrusted host:**
```
Host bastion
  HostName bastion.example.com
  ForwardAgent yes
```

**GOOD - ProxyJump through bastion, no agent exposure:**
```
Host bastion
  HostName bastion.example.com

Host production
  HostName 10.0.1.50
  ProxyJump bastion
```

### Windows OpenSSH Agent Setup

```powershell
# Enable and start the agent service (persists across reboots)
Get-Service ssh-agent | Set-Service -StartupType Automatic
Start-Service ssh-agent

# Add key once
ssh-add $HOME\.ssh\id_ed25519_github

# Point Git to Windows OpenSSH instead of bundled ssh
git config --global core.sshCommand "C:/Windows/System32/OpenSSH/ssh.exe"

# Verify
ssh-add -l
```

## GPG Signing Setup

1. **Install** GPG tooling (Gpg4win on Windows, gnupg on Linux/macOS).
2. **Generate** a key with RSA 4096 or Ed25519. Set expiration to 1-2 years.
3. **Configure** Git to sign all commits automatically.
4. **Export** the public key and upload to GitHub/GitLab.
5. **Back up** the private key to an encrypted offline location.

```bash
# Step 2: Generate key
gpg --full-generate-key

# Step 2b: Find your key ID
gpg --list-secret-keys --keyid-format=long
# Output: sec   ed25519/ABC123DEF456 2024-01-01 [SC] [expires: 2026-01-01]

# Step 3: Configure Git
git config --global commit.gpgsign true
git config --global user.signingkey ABC123DEF456

# Step 4: Export public key (pipe to clipboard or file)
gpg --armor --export ABC123DEF456 > gpg-public.asc

# Windows: point Git to Gpg4win binary
git config --global gpg.program "C:/Program Files (x86)/GnuPG/bin/gpg.exe"
```

**BAD - No expiration, no signing configured:**
```bash
gpg --gen-key   # Defaults to no expiration
# Never configure git commit.gpgsign
# Commits show as "Unverified" on GitHub
```

**GOOD - Expiring key, auto-signing enabled:**
```bash
gpg --full-generate-key  # Choose Ed25519, set 2-year expiry
git config --global commit.gpgsign true
git config --global user.signingkey ABC123DEF456
# Commits show "Verified" badge on GitHub
```

## Credential Management

1. **Configure** a Git credential helper for your OS.
2. **Eliminate** plaintext secrets from shell history, dotfiles, and scripts.
3. **Install** gitleaks as a pre-commit hook to catch accidental leaks.
4. **Use** a secrets manager for scripts that need credentials at runtime.

```bash
# Step 1: Git credential helper
git config --global credential.helper manager   # Windows
git config --global credential.helper osxkeychain  # macOS
git config --global credential.helper store      # Linux (plaintext fallback)

# Step 3: Install gitleaks pre-commit
gitleaks detect --source . --verbose

# Step 4: Inject secrets from 1Password CLI (never in env or code)
op read "op://Development/github-token/credential"
```

**BAD - Token hardcoded in script:**
```bash
GITHUB_TOKEN="ghp_abc123secrettoken"
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user
```

**GOOD - Token pulled from credential store at runtime:**
```bash
GITHUB_TOKEN=$(op read "op://Development/github-token/credential")
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user
```

## File Permissions Audit

1. **Scan** home directory for world-readable sensitive files.
2. **Fix** permissions on SSH keys, cloud configs, token files.
3. **Verify** after cloning repos. Git does not preserve full Unix permissions.

```bash
# Step 1: Find sensitive files with bad permissions
find ~ -maxdepth 3 -name ".netrc" -o -name ".npmrc" -o -name "credentials" \
  -o -name ".env" -o -name "*.pem" | xargs ls -la

# Step 2: Lock down sensitive files
chmod 600 ~/.netrc ~/.npmrc ~/.config/gh/hosts.yml
chmod 600 ~/.aws/credentials ~/.config/gcloud/*.json
chmod 700 ~/.gnupg

# Step 3: Verify SSH directory after any change
ls -la ~/.ssh/
```

**BAD - World-readable credentials:**
```
-rw-r--r-- 1 dev dev 256 Jan 1 ~/.netrc
-rwxrwxrwx 1 dev dev 512 Jan 1 ~/.ssh/id_ed25519
drwxr-xr-x 2 dev dev 4096 Jan 1 ~/.aws
```

**GOOD - Owner-only access:**
```
-rw------- 1 dev dev 256 Jan 1 ~/.netrc
-rw------- 1 dev dev 512 Jan 1 ~/.ssh/id_ed25519
drwx------ 2 dev dev 4096 Jan 1 ~/.aws
```

## IDE and Extension Hardening

1. **List** all installed extensions. Remove any unused ones immediately.
2. **Pin** extension versions in team workspace settings.
3. **Check** `.vscode/settings.json` and `.idea/` for leaked tokens or local paths before committing.
4. **Use** remote development (SSH, containers) for sensitive codebases.

```bash
# List VS Code extensions
code --list-extensions

# Check workspace settings for leaked paths or tokens
grep -r "token\|secret\|password\|C:\\\\Users" .vscode/ .idea/ 2>/dev/null
```

## Maintenance Schedule

```
Monthly:   Rotate temp credentials. Review ssh-add -l. Check OS updates.
Quarterly: Audit browser + IDE extensions. Run gitleaks detect on all repos.
Annually:  Rotate SSH and GPG keys. Full permissions audit. Update threat model.
Incident:  Assume compromise. Rotate ALL credentials. Audit access logs.
```

---

**Use this skill**: When setting up a new workstation, onboarding a team member, or after any security incident that may have exposed developer credentials.
