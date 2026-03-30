# VPS Dev Environment Setup - Pixelated Empathy

Complete Ubuntu 22/24 → 25 upgrade + full dev environment setup.

## Quick Start

```bash
# One-liner for fresh Ubuntu 22/24 VPS
curl -fsSL https://raw.githubusercontent.com/pixelatedempathy/pixelated/main/scripts/vps/vps-dev-setup.sh | \
  sudo bash -s -- \
    --ssh-key "$(cat ~/.ssh/id_ed25519.pub)"
```

## What It Does

### 1. Ubuntu Upgrade
- Upgrades Ubuntu 22.04/24.04 → 25 (non-LTS track)
- Configures `/etc/update-manager/release-upgrades` for normal releases
- Installs `update-manager-core`

### 2. System Hardening
- SSH: key-only auth, no root login, agent forwarding enabled
- Firewall: UFW with 22, 80, 443
- Swap: 4G
- Timezone: UTC (configurable)
- **SSH askpass + keychain** for persistent SSH agent

### 3. Docker
- Docker Engine + Compose plugin
- **Credential helpers** (`docker-credential-secretservice`)
- User added to docker group
- Config restored from backup

### 4. Homebrew (Linuxbrew)
- Installed to `/home/linuxbrew/.linuxbrew`
- Auto-added to PATH in `.bashrc`

### 5. Development Tools
- **nvm** + **Node.js** (LTS) + **npm** + **pnpm**
- **Bun**
- **uv** (Python)
- **Oh My Zsh**:
  - `kali-like` theme (FiraCode font)
  - Plugins: git, uv, nvm, docker, brew, bun, autoswitch_virtualenv, azure, 1password, charm
  - Restores `.oh-my-zsh/custom/` from backup
  - Restores `.zshrc` from backup

### 6. Cloud CLIs
All installed and auth configs restored from backup:
- **AWS CLI** (`aws`)
- **Azure CLI** (`az`)
- **Azure Developer CLI** (`azd`)
- **DigitalOcean CLI** (`doctl`)
- **Oracle Cloud CLI** (`acli`)
- **s3cmd**
- **GitHub CLI** (`gh`)
- **GitLab CLI** (`glab`)

### 7. SSH Setup
- Restores SSH keys from backup (`id_ed25519`, `id_rsa`, Azure, steiner, dagger)
- Restores `~/.ssh/config`
- Restores `known_hosts`
- Configures SSH agent with keychain
- Enables ssh-askpass

### 8. Git Config
- Restores `~/.gitconfig` from backup
- Configures credential helper (`store`)
- User: `dagger@pixelated.love`

### 9. rclone
- Installs rclone
- Restores config from backup
- Sets up backup remote

### 10. Repository
- Clones pixelated repo with submodules
- Branch: `main` (configurable)
- Workspace: `/home/vivi/pixelated`

### 11. Restore .gitignore Gaps
Restores from rclone backup:
- `.agent/internal/`
- `.cursor/`, `.continue/`, `.windsurf/`, `.Jules/`, `.claude/`
- `node_modules/`, `.venv/`
- `config/secrets/`

### 12. Coding Agents
All installed and configured with restored auth:
- **Continue** (VSCode extension)
- **Aider** (CLI)
- **OpenHands** (Docker)
- **Goose**
- **Crush**
- **OpenCode** (opencode)
- **Qwen Code**
- **ALCI** (Rovodev + Jira integration)
- **Codex** (OpenAI)
- **Claude Code** (Anthropic)
- **Gemini** (Google)

### 13. Backup System
Two automated backup systems:

**Home Directory Backup** (every 6 hours):
- Backs up `/home/vivi` to `~/.local/share/home_backups`
- Uploads to Google Drive via rclone
- Retains last 2 backups
- systemd timer: `backup-home-vivi.timer`

**Config Backup** (weekly, Sundays 3 AM):
- Creates portable backup of all configs:
  - SSH keys and config
  - Git config
  - rclone config
  - Cloud CLI auth (aws, azure, doctl, oci, gh, glab)
  - Coding agent configs (goose, opencode, crush, continue, cursor, claude, qwen, alci, gemini)
  - oh-my-zsh custom config
  - Docker config
  - systemd units
- Uploads to rclone: `drive:vivi-home-backups/configs/`
- Retains last 3 config backups
- systemd timer: `config-backup.timer`

## Usage

### Full Setup

```bash
./vps-dev-setup.sh \
  --ssh-key "$(cat ~/.ssh/id_ed25519.pub)" \
  --rclone-remote drive \
  --backup-path vivi-home-backups
```

### Skip Ubuntu Upgrade

```bash
./vps-dev-setup.sh \
  --ssh-key "$(cat ~/.ssh/id_ed25519.pub)" \
  --no-upgrade-25
```

### Minimal (No Agents)

```bash
./vps-dev-setup.sh \
  --ssh-key "$(cat ~/.ssh/id_ed25519.pub)" \
  --no-agents
```

### Custom Branch/Workspace

```bash
./vps-dev-setup.sh \
  --ssh-key "$(cat ~/.ssh/id_ed25519.pub)" \
  --branch staging \
  --workspace /home/vivi/workspace
```

## Options

```
--ssh-key KEY            SSH public key (required)
-p, --port PORT          SSH port (default: 22)
--github-token TOKEN     GitHub token for private repos
--gitlab-token TOKEN     GitLab token
--rclone-remote NAME     rclone remote (default: drive)
--backup-path PATH       Backup path in remote
--repo URL               Repository URL (default: pixelated)
--branch NAME            Git branch (default: main)
--workspace DIR          Workspace dir (default: ~/pixelated)
--no-ohmyzsh             Skip Oh My Zsh
--no-agents              Skip all coding agents
--no-continue            Skip Continue
--no-aider               Skip Aider
--enable-openhands       Enable OpenHands
--no-upgrade-25          Skip Ubuntu upgrade
--timezone TZ            Timezone (default: UTC)
--swap-size SIZE         Swap size (default: 4G)
-h, --help               Show this help
```

## After Setup

### 1. SSH In

```bash
ssh -p 22 vivi@<vps-ip>
```

### 2. Complete Ubuntu Upgrade (if needed)

```bash
# If script detected Ubuntu 22/24
sudo do-release-upgrade
```

### 3. Authenticate Cloud CLIs

```bash
# AWS
aws configure

# Azure
az login
azd auth login

# DigitalOcean
doctl auth init

# Oracle
acli setup

# GitHub
gh auth login

# GitLab
glab auth login
```

### 4. Configure rclone (if not restored)

```bash
rclone config
```

### 5. Restore Missing Files

```bash
cd ~/pixelated
rclone copy drive:vivi-home-backups/pixelated/ . \
  --include '.agent/**' \
  --include '.cursor/**' \
  --include '.continue/**'
```

### 6. Verify Tools

```bash
node -v
pnpm -v
bun --version
uv --version
brew --version
aider --version
gh --version
doctl version
aws --version
az version
```

### 7. Check Backup Status

```bash
# View backup timers
systemctl list-timers | grep backup

# View last backup logs
journalctl -u backup-home-vivi.service -n 20
journalctl -u config-backup.service -n 20

# View backup directory
ls -la ~/.local/share/home_backups/
```

### 8. Start Coding

```bash
cd ~/pixelated

# Continue: Install VSCode extension
# Aider: aider --model ollama/llama3.1:8b
# Goose: goose session
# Crush: crush
# OpenCode: opencode
# Claude: claude
# etc.
```

## SSH Agent Setup

The script configures `keychain` for persistent SSH agent:

```bash
# After SSHing in, run:
eval "$(keychain --eval --agents ssh id_ed25519)"

# Or add to ~/.bashrc (already done by script):
eval "$(keychain --eval --agents ssh id_ed25519 2>/dev/null)"
```

## Docker Credential Helper

Docker is configured to use `secretservice` for credential storage:

```bash
# Login once, credentials persist
docker login registry.gitlab.com
docker login nvcr.io --username '$oauthtoken' --password <NGC_KEY>
```

## Backup System Details

### Home Backup (6-hourly)

```bash
# Manual trigger
/home/vivi/pixelated/scripts/backup/backup-home-vivi.sh

# View logs
tail -f ~/.local/share/home_backups/backup.log

# systemd status
systemctl status backup-home-vivi.timer
```

### Config Backup (Weekly)

```bash
# Manual trigger
/home/vivi/pixelated/scripts/backup/create-config-backup.sh \
  --rclone-remote drive \
  --rclone-path vivi-home-backups/configs

# View logs
tail -f /tmp/create-config-backup.log

# systemd status
systemctl status config-backup.timer
```

### Restore from Config Backup

```bash
# Download and extract
rclone copy drive:vivi-home-backups/configs/pixelated-config-YYYYMMDD.tar.gz .
tar -xzf pixelated-config-*.tar.gz

# Restore scripts will run automatically on next vps-dev-setup.sh run
```

## Logs

```bash
tail -f /var/log/vps-dev-setup.log
```

## State

```bash
cat /var/lib/vps-dev-setup/state.json
```

## Supported OS

- Ubuntu 22.04 LTS → 25.04 ✓
- Ubuntu 24.04 LTS → 25.04 ✓
- Ubuntu 25.04/25.10 (skip upgrade) ✓

## User

Always `vivi` with:
- Home: `/home/vivi`
- Sudo: passwordless
- Groups: `sudo`, `docker`
