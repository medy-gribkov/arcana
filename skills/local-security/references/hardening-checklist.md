# OS Hardening Checklist

## SSH Hardening Config

Place in `~/.ssh/config` or `/etc/ssh/sshd_config` (server-side).

### Client Config (~/.ssh/config)

```
Host *
    IdentitiesOnly yes
    AddKeysToAgent yes
    ServerAliveInterval 60
    ServerAliveCountMax 3

# Per-host config
Host production
    HostName 10.0.1.50
    User deploy
    IdentityFile ~/.ssh/id_ed25519_prod
    ForwardAgent no

# Bastion jump host (preferred over agent forwarding)
Host internal-*
    ProxyJump bastion
    User deploy
    IdentityFile ~/.ssh/id_ed25519_internal

Host bastion
    HostName bastion.example.com
    User jump
    IdentityFile ~/.ssh/id_ed25519_bastion
```

### Server Config (/etc/ssh/sshd_config)

```
# Authentication
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
MaxAuthTries 3

# Restrict access
AllowUsers deploy admin
AllowGroups ssh-users

# Security
X11Forwarding no
AllowTcpForwarding no
AllowAgentForwarding no
PermitEmptyPasswords no

# Timeouts
ClientAliveInterval 300
ClientAliveCountMax 2
LoginGraceTime 30

# Logging
LogLevel VERBOSE
```

After editing: `sudo sshd -t` to test, then `sudo systemctl restart sshd`.

## Firewall Rules

### Linux (ufw)

```bash
# Default deny incoming, allow outgoing
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (change port if non-standard)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS (if running web server)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow from specific IP only
sudo ufw allow from 10.0.1.0/24 to any port 22

# Enable
sudo ufw enable
sudo ufw status verbose
```

### Windows Firewall (PowerShell)

```powershell
# Block all inbound by default
Set-NetFirewallProfile -Profile Domain,Public,Private -DefaultInboundAction Block

# Allow specific ports
New-NetFirewallRule -DisplayName "Allow SSH" -Direction Inbound -Protocol TCP -LocalPort 22 -Action Allow
New-NetFirewallRule -DisplayName "Allow HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow

# List rules
Get-NetFirewallRule | Where-Object { $_.Enabled -eq 'True' -and $_.Direction -eq 'Inbound' }
```

## Audit Logging

### Linux

```bash
# Install auditd
sudo apt install auditd

# Watch sensitive files
sudo auditctl -w /etc/passwd -p wa -k identity
sudo auditctl -w /etc/shadow -p wa -k identity
sudo auditctl -w /etc/ssh/sshd_config -p wa -k sshd
sudo auditctl -w /home/ -p wa -k home_changes

# Watch sudo usage
sudo auditctl -w /usr/bin/sudo -p x -k sudo_usage

# Search audit logs
sudo ausearch -k identity --start today
sudo aureport --auth --summary
```

### Windows Event Logging (PowerShell)

```powershell
# Enable auditing for logon events
auditpol /set /category:"Logon/Logoff" /success:enable /failure:enable

# Check recent failed logins
Get-WinEvent -FilterHashtable @{LogName='Security'; Id=4625} -MaxEvents 20

# Check recent successful logins
Get-WinEvent -FilterHashtable @{LogName='Security'; Id=4624} -MaxEvents 20
```

## Quarterly Hardening Checklist

- [ ] Rotate SSH keys. Remove old public keys from authorized_keys.
- [ ] Rotate GPG keys or extend expiry.
- [ ] Audit ~/.ssh/authorized_keys on all servers.
- [ ] Review firewall rules. Remove stale port allowances.
- [ ] Update OS and all packages.
- [ ] Run `gitleaks detect` on all local repos.
- [ ] Audit browser extensions. Remove unused ones.
- [ ] Audit IDE extensions. Remove unused, pin versions.
- [ ] Review file permissions on sensitive configs (chmod 600).
- [ ] Check for world-readable secrets: `find ~ -perm -004 -name "*.env*" -o -name "*.key"`.
- [ ] Verify credential manager is active and no plaintext secrets in shell history.
- [ ] Test backup and restore of SSH/GPG keys.
