# VPS Quick Reference

## Registry Auth Cheatsheet

### NVIDIA NGC
```bash
# The painful part you always forget:
echo "$NVIDIA_API_KEY" | docker login nvcr.io -u '$oauthtoken' --password-stdin

# Or use the script:
./vps-provision.sh --profile ai-workload --nvidia-api-key nvapi_xxx
```

### GitLab Registry
```bash
# Token from Settings > Access Tokens (read_registry)
echo "$GITLAB_TOKEN" | docker login registry.gitlab.com -u vivi --password-stdin

# Or use the script:
./vps-provision.sh --registry gitlab --registry-token glpat_xxx --registry-user vivi
```

### Azure ACR
```bash
# Login server format:
echo "$ACR_PASSWORD" | docker login myregistry.azurecr.io -u myregistry --password-stdin

# Or use the script:
./vps-provision.sh --registry acr --acr-name myregistry --registry-token xxx
```

### GitHub GHCR
```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u vivi --password-stdin
```

## Profiles at a Glance

| Command | What You Get |
|---------|--------------|
| `--profile minimal` | Docker only |
| `--profile ai-workload` | Docker + NVIDIA NGC auth |
| `--profile web-app` | Docker + registry + Traefik + monitoring |
| `--profile full-stack` | Everything |

## Common Commands After Setup

```bash
# Check registry auth
cat ~/.docker/config.json

# Test NVIDIA pull
docker pull nvcr.io/nvidia/cuda:12.2.0-base-ubuntu22.04

# Start monitoring
cd ~/monitoring && docker compose up -d

# Check Traefik logs
docker logs traefik

# View provisioning logs
tail -f /var/log/vps-provision.log
```

## Traefik Labels for Your Compose Files

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.myapp.rule=Host(`app.example.com`)"
  - "traefik.http.routers.myapp.entrypoints=websecure"
  - "traefik.http.routers.myapp.tls.certresolver=letsencrypt"
  - "traefik.http.services.myapp.loadbalancer.server.port=4321"
```

## DigitalOcean Specific

```bash
# Create droplet with 80GB disk (enough for models + datasets)
doctl compute droplet create pixelated-ai \
  --region nyc3 \
  --size s-4vcpu-8gb \
  --image ubuntu-24-04-x64 \
  --ssh-keys your-key-fingerprint \
  --tag-names pixelated
```

## Oracle Cloud Specific

```bash
# A1.Flex with 4 OCPUs, 24GB RAM
# Use Ubuntu 24.04 image
# Boot volume: 100GB minimum
```

## What This Script Actually Does

1. **SSH hardening** - Key-only auth, custom port, no root
2. **Firewall** - UFW with 22, 80, 443 open
3. **Swap** - 2GB (or specified size)
4. **Docker** - Latest with compose plugin
5. **Registry auth** - The main reason this exists
6. **User setup** - Creates user, copies docker config, adds to docker group
7. **Optional**: Traefik with SSL, monitoring stack

## What You Always Forget (That This Handles)

- [ ] NVIDIA NGC uses `$oauthtoken` as username, not your email
- [ ] Docker config needs to be base64 encoded in `~/.docker/config.json`
- [ ] User needs to be in `docker` group AFTER docker is installed
- [ ] Docker config must be copied to user's home, not just root
- [ ] Traefik needs Cloudflare token as environment variable, not in config
- [ ] Swap should be created BEFORE installing heavy services
