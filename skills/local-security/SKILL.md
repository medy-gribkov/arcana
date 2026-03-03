---
name: local-security
description: Developer workstation security covering SSH key management, GPG signing, credential stores, file permissions, agent forwarding, IDE hardening, and browser extension auditing.
---

## Purpose

Secure the developer workstation as a critical node in the software supply chain. A compromised dev machine means compromised code, credentials, and infrastructure access.

## SSH Key Management

- Generate keys with `ssh-keygen -t ed25519 -C "purpose@host"`. Ed25519 is faster and more secure than RSA.
- Use one key per service or environment. Do not reuse the same key for GitHub, servers, and cloud providers.
- Protect private keys with a strong passphrase. Use `ssh-agent` to avoid retyping it.
- Set permissions: `chmod 700 ~/.ssh`, `chmod 600 ~/.ssh/id_*`, `chmod 644 ~/.ssh/*.pub`.
- Rotate keys annually. Remove old public keys from authorized services after rotation.
- Audit `~/.ssh/authorized_keys` on servers you manage. Remove keys for departed team members immediately.
- Use `ssh-keygen -l -f key.pub` to verify key fingerprints before trusting them.

### Windows OpenSSH Agent Setup

```powershell
# Enable OpenSSH Agent service
Get-Service ssh-agent | Set-Service -StartupType Automatic
Start-Service ssh-agent

# Add key to agent
ssh-add $HOME\.ssh\id_ed25519

# Configure Git to use OpenSSH (not Git's bundled ssh)
git config --global core.sshCommand "C:/Windows/System32/OpenSSH/ssh.exe"

# Verify agent is running and key is loaded
ssh-add -l
```

On Windows, the OpenSSH agent persists keys across reboots. You only need to add keys once after enabling the service.

## GPG Commit Signing

- Generate a GPG key: `gpg --full-generate-key`. Use RSA 4096 or Ed25519.
- Configure Git to sign commits: `git config --global commit.gpgsign true`.
- Set the signing key: `git config --global user.signingkey <KEY_ID>`.
- Upload the public key to GitHub/GitLab. Signed commits get a "Verified" badge.
- Back up the private key securely. Losing it means you cannot prove authorship of past commits.
- Set an expiration date on GPG keys (1-2 years). Extend before expiry rather than creating new keys.
- Use `gpg --list-secret-keys --keyid-format=long` to find your key ID.

### Gpg4win for Windows

```powershell
# Install Gpg4win (includes Kleopatra GUI)
winget install GnuPG.Gpg4win

# Generate key via Kleopatra or CLI
gpg --full-generate-key

# Configure Git to use GPG
git config --global gpg.program "C:\Program Files (x86)\GnuPG\bin\gpg.exe"
git config --global commit.gpgsign true
git config --global user.signingkey <KEY_ID>

# Export public key for GitHub
gpg --armor --export <KEY_ID> | clip
# Paste into GitHub Settings > SSH and GPG keys > New GPG key
```

Kleopatra provides a GUI for key management, making it easier to back up, import, and manage GPG keys on Windows.

## Credential Managers

- Use a dedicated credential manager. Never store secrets in plaintext files or shell history.
- 1Password CLI (`op`): `op read "op://vault/item/field"` injects secrets into scripts without exposing them.
- `pass` (password-store): GPG-encrypted, Git-backed. Good for teams that prefer open-source tooling.
- Git credential helpers: `git config --global credential.helper manager` on Windows, `osxkeychain` on macOS.
- Environment variables from `.env` files: use `.gitignore` to exclude them. Use `direnv` for automatic loading.
- Never commit credentials. Run `gitleaks detect` as a pre-commit hook to catch accidental leaks.

## File Permissions

- Home directory: `chmod 750 ~`. Prevent other users from reading your files.
- Config files with secrets: `chmod 600`. This includes `.netrc`, `.npmrc` with tokens, cloud CLI configs.
- Scripts: `chmod 755` for shared scripts, `chmod 700` for personal scripts with sensitive logic.
- Check for world-readable sensitive files: look for config files with permissions ending in 4 or higher.
- On Windows, use NTFS ACLs. Remove "Everyone" and "Users" from sensitive directories.
- Audit permissions after cloning repositories. Git does not preserve full Unix permissions.

## Agent Forwarding Risks

- `ssh -A` forwards your SSH agent to the remote host. Anyone with root on that host can use your keys.
- Prefer `ProxyJump` (`ssh -J bastion target`) over agent forwarding for bastion host access.
- If agent forwarding is necessary, use `ssh-add -c` to require confirmation for each key use.
- Limit which keys are loaded in the agent. Use `ssh-add -l` to list currently loaded keys.
- Set `AddKeysToAgent yes` in `~/.ssh/config` to auto-load keys only when used.
- Never forward agents to shared or untrusted hosts.

## IDE and Editor Security

- Review installed extensions quarterly. Remove unused ones. Extensions have broad file system access.
- Pin extension versions in team settings to prevent supply chain attacks via auto-updates.
- Disable telemetry in IDE settings if working on sensitive projects.
- Use workspace-scoped settings for project-specific configurations. Do not leak global paths.
- Check that `.vscode/settings.json` and `.idea/` directories do not contain tokens or local paths before committing.
- Enable automatic security updates for the IDE itself.
- Use remote development (SSH, containers) for sensitive codebases to isolate the environment.

## Browser Extension Auditing

- Audit browser extensions every quarter. Remove any you do not actively use.
- Check permissions: extensions requesting "Read and change all your data on all websites" are high risk.
- Developer-relevant extensions to scrutinize: OAuth token managers, API clients, JSON viewers.
- Use separate browser profiles for development and personal browsing.
- Disable extensions in incognito/private mode by default.
- Watch for extension ownership transfers. A trusted extension can become malicious after acquisition.
- Prefer extensions from known publishers with public source code.

## Network Security

- Use a VPN or SSH tunnel when working on public networks. Coffee shop WiFi is not secure.
- Configure firewall rules to block inbound connections. Only open ports you actively need.
- Disable unused network services: file sharing, remote desktop, mDNS.
- Use DNS-over-HTTPS or DNS-over-TLS to prevent DNS snooping.
- Monitor outbound connections with `lsof -i` or `netstat`. Look for unexpected traffic.

## Maintenance Routine

- Monthly: rotate any temporary credentials, review SSH agent keys, check for OS updates.
- Quarterly: audit browser extensions, review IDE extensions, scan for leaked credentials in repos.
- Annually: rotate SSH and GPG keys, review file permissions, update threat model.
- After any incident: assume compromise, rotate all credentials, audit access logs.
- Document your security setup so you can rebuild a clean workstation quickly.
