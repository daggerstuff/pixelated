# NeMo Data Designer Remote Server Deployment

This guide covers deploying NeMo Data Designer on a remote server for use with the Pixelated Empathy platform.

## Prerequisites

### On Your Local Machine
- SSH access to the remote server
- SSH key configured (or password authentication enabled)
- `.env` file with `NVIDIA_API_KEY` set

### On Remote Server (212.2.244.60)
- Docker installed
- Docker Compose installed
- At least 8GB RAM
- At least 20GB free disk space
- Internet connectivity for downloading images

## Quick Deployment

### Option 1: Automated Deployment Script

Run the deployment script from your local machine:

```bash
./scripts/deploy-nemo-data-designer-remote.sh
```

The script will:
1. Test SSH connection to the remote server
2. Verify Docker and Docker Compose are installed
3. Copy deployment scripts to the remote server
4. Download and set up NeMo Microservices
5. Start the Data Designer service

### Option 2: Manual Deployment

1. **SSH into the remote server:**
   ```bash
   ssh vivi@212.2.244.60
   ```

2. **Install Docker (if not installed):**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   ```

3. **Install Docker Compose (if not installed):**
   ```bash
   # For Docker Compose V2 (recommended)
   sudo apt-get update
   sudo apt-get install docker-compose-plugin
   
   # Or for Docker Compose V1
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

4. **Download NeMo Microservices Quickstart:**
   ```bash
   mkdir -p ~/nemo-microservices
   cd ~/nemo-microservices
   
   # Download from NGC (requires NGC account)
   # Visit: https://catalog.ngc.nvidia.com/orgs/nvidia/teams/nemo/resources/nemo-microservices-quickstart
   # Or use the deployment script which handles this automatically
   ```

5. **Set environment variables:**
   ```bash
   export NEMO_MICROSERVICES_IMAGE_REGISTRY="nvcr.io/nvidia/nemo-microservices"
   export NEMO_MICROSERVICES_IMAGE_TAG="25.10"
   export NIM_API_KEY="your-nvidia-api-key-here"
   ```

6. **Authenticate with NGC:**
   ```bash
   echo $NIM_API_KEY | docker login nvcr.io -u '$oauthtoken' --password-stdin
   ```

7. **Start the service:**
   ```bash
   cd nemo-microservices-quickstart_v25.10
   docker compose --profile data-designer up -d
   ```

## Configuration

### Update Local .env File

After deployment, update your local `.env` file:

```env
NEMO_DATA_DESIGNER_BASE_URL=http://212.2.244.60:8080
```

### Firewall Configuration

Ensure the port is open on the remote server:

```bash
# For UFW (Ubuntu)
sudo ufw allow 8080/tcp

# For firewalld (CentOS/RHEL)
sudo firewall-cmd --add-port=8080/tcp --permanent
sudo firewall-cmd --reload
```

## Verification

### Check Service Status

```bash
ssh vivi@212.2.244.60 'cd ~/nemo-microservices/nemo-microservices-quickstart_* && docker compose ps'
```

### Test Health Endpoint

```bash
curl http://212.2.244.60:8080/health
```

### View Logs

```bash
ssh vivi@212.2.244.60 'cd ~/nemo-microservices/nemo-microservices-quickstart_* && docker compose logs -f'
```

## Management Commands

### Start Service
```bash
ssh vivi@212.2.244.60 'cd ~/nemo-microservices/nemo-microservices-quickstart_* && docker compose --profile data-designer up -d'
```

### Stop Service
```bash
ssh vivi@212.2.244.60 'cd ~/nemo-microservices/nemo-microservices-quickstart_* && docker compose --profile data-designer down'
```

### Restart Service
```bash
ssh vivi@212.2.244.60 'cd ~/nemo-microservices/nemo-microservices-quickstart_* && docker compose --profile data-designer restart'
```

### View Logs
```bash
ssh vivi@212.2.244.60 'cd ~/nemo-microservices/nemo-microservices-quickstart_* && docker compose logs -f'
```

### Update Service
```bash
ssh vivi@212.2.244.60 'cd ~/nemo-microservices/nemo-microservices-quickstart_* && docker compose --profile data-designer pull && docker compose --profile data-designer up -d'
```

## Troubleshooting

### Service Not Starting

1. **Check Docker logs:**
   ```bash
   ssh vivi@212.2.244.60 'cd ~/nemo-microservices/nemo-microservices-quickstart_* && docker compose logs'
   ```

2. **Check system resources:**
   ```bash
   ssh vivi@212.2.244.60 'free -h && df -h'
   ```

3. **Verify Docker is running:**
   ```bash
   ssh vivi@212.2.244.60 'sudo systemctl status docker'
   ```

### Cannot Connect to Service

1. **Check if port is listening:**
   ```bash
   ssh vivi@212.2.244.60 'netstat -tlnp | grep 8080'
   ```

2. **Check firewall rules:**
   ```bash
   ssh vivi@212.2.244.60 'sudo ufw status'
   ```

3. **Test from server itself:**
   ```bash
   ssh vivi@212.2.244.60 'curl http://localhost:8080/health'
   ```

### Authentication Errors

1. **Verify API key is correct:**
   ```bash
   ssh vivi@212.2.244.60 'echo $NIM_API_KEY'
   ```

2. **Re-authenticate with NGC:**
   ```bash
   ssh vivi@212.2.244.60 'echo $NIM_API_KEY | docker login nvcr.io -u '\''$oauthtoken'\'' --password-stdin'
   ```

### Image Pull Errors

If you get errors pulling images:

1. **Check NGC authentication:**
   ```bash
   ssh vivi@212.2.244.60 'docker login nvcr.io'
   ```

2. **Verify API key has access:**
   - Visit https://catalog.ngc.nvidia.com
   - Ensure your API key has access to NeMo Microservices

## Security Considerations

1. **Use SSH keys instead of passwords**
2. **Restrict firewall access** to only necessary IPs
3. **Use HTTPS** if exposing publicly (set up reverse proxy)
4. **Keep API keys secure** - never commit them to git
5. **Regular updates** - keep Docker images updated

## Next Steps

After successful deployment:

1. Update your local `.env` file with the remote URL
2. Test the connection:
   ```bash
   uv run python ai/data_designer/test_setup.py
   ```
3. Run example scripts:
   ```bash
   uv run python ai/data_designer/examples.py
   ```

## Resources

- [Official NeMo Data Designer Documentation](https://docs.nvidia.com/nemo/microservices/latest/design-synthetic-data-from-scratch-or-seeds/index.html)
- [Deployment Guide](https://docs.nvidia.com/nemo/microservices/latest/set-up/deploy-as-microservices/data-designer/parent-chart.html)
- [NGC Catalog](https://catalog.ngc.nvidia.com/orgs/nvidia/teams/nemo/resources/nemo-microservices-quickstart)

