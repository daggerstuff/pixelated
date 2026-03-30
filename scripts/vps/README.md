# VPS Provisioning - Pixelated Empathy

**Focused on what actually matters: Docker registry authentication that you always have to look up.**

## Quick Start

### AI Workload (NVIDIA NGC)

```bash
./vps-provision.sh \
  --profile ai-workload \
  --nvidia-api-key nvapi_xxxxx \
  --ssh-key "$(cat ~/.ssh/id_ed25519.pub)"
```

### Web App (GitLab Registry)

```bash
./vps-provision.sh \
  --profile web-app \
  --registry gitlab \
  --registry-token glpat_xxxxx \
  --registry-user vivi \
  --domain app.example.com \
  --ssh-key "$(cat ~/.ssh/id_ed25519.pub)"
```

### Full Stack (ACR + Traefik + Monitoring)

```bash
./vps-provision.sh \
  --profile full-stack \
  --registry acr \
  --acr-name pixelatedregistry \
  --registry-user xxx \
  --registry-token xxx \
  --domain pixelatedempathy.com \
  --cloudflare-token cf_xxxxx \
  --ssh-key "$(cat ~/.ssh/id_ed25519.pub)"
```

## Profiles

| Profile | Docker | Registry | Traefik | Monitoring | Use Case |
|---------|--------|----------|---------|------------|----------|
| `minimal` | ✓ | - | - | - | Quick test box |
| `web-app` | ✓ | GitLab/ACR/GHCR | ✓ | ✓ | Web APIs, frontend |
| `ai-workload` | ✓ | NVIDIA NGC | - | - | Ollama, NeMo, GPU workloads |
| `full-stack` | ✓ | Any | ✓ | ✓ | Production |

## Registry Authentication

### NVIDIA NGC (AI/ML)

```bash
# Get API key from: https://ngc.nvidia.com/setup/api-key
./vps-provision.sh \
  --profile ai-workload \
  --nvidia-api-key nvapi_xxxxx
```

This handles the annoying `\$oauthtoken` username and persists credentials properly.

### GitLab Container Registry

```bash
# Get token from: Settings > Access Tokens (read_registry scope)
./vps-provision.sh \
  --registry gitlab \
  --registry-token glpat_xxxxx \
  --registry-user vivi
```

### Azure Container Registry

```bash
# Get credentials from: ACR > Access Keys
./vps-provision.sh \
  --registry acr \
  --acr-name pixelatedregistry \
  --registry-user pixelatedregistry \
  --registry-token xxxxx
```

### GitHub Container Registry

```bash
# Get token from: Settings > Developer Settings > Personal Access Tokens (read:packages)
./vps-provision.sh \
  --registry ghcr \
  --registry-token ghp_xxxxx \
  --registry-user vivi
```

## Reverse Proxy (Traefik)

Traefik is configured with:
- Automatic HTTPS via Let's Encrypt
- Cloudflare DNS challenge support
- Docker provider (auto-discovery)

```bash
./vps-provision.sh \
  --enable-traefik \
  --domain app.example.com \
  --acme-email admin@example.com \
  --cloudflare-token cf_xxxxx
```

After setup, deploy containers with these labels:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.app.rule=Host(`app.example.com`)"
  - "traefik.http.routers.app.entrypoints=websecure"
  - "traefik.http.routers.app.tls.certresolver=letsencrypt"
```

## Monitoring Stack

```bash
./vps-provision.sh --enable-monitoring
```

Creates `~/monitoring/` with:
- **Prometheus** :9090
- **Grafana** :3000 (admin/admin)
- **Node Exporter** :9100

Start with:
```bash
cd ~/monitoring && docker compose up -d
```

## Common Workflows

### Fresh DigitalOcean Droplet (AI Workload)

```bash
# 1. Create droplet with your SSH key
# 2. Run provisioning
./vps-provision.sh \
  --profile ai-workload \
  --nvidia-api-key "$NVIDIA_API_KEY" \
  --ssh-key "$(cat ~/.ssh/id_ed25519.pub)"

# 3. Copy SSH key
ssh-copy-id -p 22 vivi@<vps-ip>

# 4. Test NGC auth
docker pull nvcr.io/nvidia/cuda:12.2.0-base-ubuntu22.04
```

### Oracle Cloud A1.Flex (Web App)

```bash
./vps-provision.sh \
  --profile web-app \
  --registry gitlab \
  --registry-token "$GITLAB_TOKEN" \
  --domain app.example.com \
  --enable-traefik \
  --enable-monitoring
```

### Production Deploy

```bash
./vps-provision.sh \
  --profile full-stack \
  --registry acr \
  --acr-name pixelatedregistry \
  --registry-user pixelatedregistry \
  --registry-token "$ACR_TOKEN" \
  --domain pixelatedempathy.com \
  --cloudflare-token "$CF_TOKEN" \
  --acme-email admin@pixelatedempathy.com
```

## Post-Install Checklist

```bash
# 1. Test SSH
ssh -p 22 vivi@<vps-ip>

# 2. Verify Docker
docker run hello-world

# 3. Verify Registry Auth
docker pull nvcr.io/nvidia/cuda:12.2.0-base-ubuntu22.04  # If NGC
docker pull registry.gitlab.com/...  # If GitLab

# 4. Check Firewall
sudo ufw status

# 5. View Logs
tail -f /var/log/vps-provision.log
```

## Logs

All actions logged to `/var/log/vps-provision.log`

## Supported OS

- Ubuntu 20.04, 22.04, 24.04 ✓
- Debian 11, 12 ✓
- Rocky/AlmaLinux 8+ ✓
