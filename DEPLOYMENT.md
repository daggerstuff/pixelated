# Pixelated Empathy - Deployment Guide

This guide covers deploying Pixelated Empathy to your VPS using Docker, replacing Azure Container Web App functionality.

## 🚀 Deployment Options

### Option 1: Forgejo Actions (Recommended)

Automated CI/CD pipeline that builds and deploys on every push.

#### Setup:

1. **Enable Forgejo Actions** in your Forgejo instance
2. **Add secrets** to your repository (Settings → Secrets):
   - `VPS_HOST`: Your VPS IP address (e.g., `208.117.84.253`)
   - `VPS_USER`: SSH username (e.g., `root`)
   - `VPS_SSH_KEY`: Your private SSH key content
   - `VPS_PORT`: SSH port (usually `22`)

3. **Push to trigger deployment**:
   ```bash
   git add .
   git commit -m "Deploy to production"
   git push origin main
   ```

The workflow will:
- ✅ Build Docker image with caching
- ✅ Transfer only the compressed image to VPS
- ✅ Deploy with health checks
- ✅ Clean up old containers/images
- ✅ Verify deployment success

### Option 2: Manual Deployment Script

Use the provided script for manual deployments.

#### Setup:

1. **Configure environment variables**:
   ```bash
   export VPS_HOST="208.117.84.253"
   export VPS_USER="root"
   export VPS_PORT="22"
   export SSH_KEY="~/.ssh/planet"
   ```

2. **Run deployment**:
   ```bash
   ./scripts/deploy-docker.sh
   ```

### Option 3: Docker Compose (Local Development)

For local development with all services:

```bash
# Development with hot reload
docker-compose up --build

# Production simulation
docker-compose -f docker-compose.prod.yml up --build
```

## 🏗️ Architecture

```
Internet → VPS:80 → Docker Container:4321 → Astro App
```

### Container Details:
- **Image**: Built from Dockerfile with Node.js 22
- **Port**: 4321 (internal) → 80 (external)
- **Health Check**: `/api/health/simple`
- **Restart Policy**: `unless-stopped`
- **User**: Non-root (`astro:1001`)

## 🔧 Configuration

### Environment Variables:
- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT=4321`

### Health Check:
- **Endpoint**: `http://localhost:4321/api/health/simple`
- **Interval**: 30s
- **Timeout**: 10s
- **Start Period**: 30s
- **Retries**: 3

## 📊 Monitoring

### Check deployment status:
```bash
# SSH to VPS
ssh root@208.117.84.253

# Check container status
docker ps | grep pixelated-empathy

# Check health status
docker inspect --format='{{.State.Health.Status}}' pixelated-empathy

# View logs
docker logs pixelated-empathy -f

# Test health endpoint
curl http://localhost/api/health/simple
```

## 🔄 Updates

### Automatic (Forgejo Actions):
Just push to your main branch - the workflow handles everything.

### Manual:
```bash
./scripts/deploy-docker.sh
```

## 🛠️ Troubleshooting

### Container won't start:
```bash
docker logs pixelated-empathy
```

### Health check failing:
```bash
# Check if app is responding
docker exec pixelated-empathy curl -f http://localhost:4321/api/health/simple

# Check container resources
docker stats pixelated-empathy
```

### Port conflicts:
```bash
# Check what's using port 80
sudo netstat -tulpn | grep :80

# Stop conflicting services
sudo systemctl stop apache2  # or nginx, etc.
```

### Disk space issues:
```bash
# Clean up Docker
docker system prune -a

# Check disk usage
df -h
```

## 🔒 Security Notes

- Container runs as non-root user (`astro`)
- Only necessary ports exposed
- Health checks ensure service availability
- Automatic restart on failure
- Regular cleanup of old images

## 🌐 Domain Setup

To use a custom domain:

1. **Point DNS** to your VPS IP
2. **Update nginx config** (if using reverse proxy)
3. **Add SSL certificate** (recommended: Let's Encrypt)

## 📈 Scaling

For high traffic:
- Use nginx reverse proxy with load balancing
- Add multiple container instances
- Implement container orchestration (Docker Swarm/Kubernetes)
- Add monitoring (Prometheus/Grafana)

## 🆘 Support

If deployment fails:
1. Check the GitHub Actions logs
2. SSH to VPS and check Docker logs
3. Verify all secrets are set correctly
4. Ensure VPS has enough disk space and memory
