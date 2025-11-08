# NeMo Data Designer - Quick Deployment Guide

## Remote Server Deployment (212.2.244.60)

### One-Command Deployment

```bash
./scripts/deploy-nemo-data-designer-remote.sh
```

### What It Does

1. ✅ Tests SSH connection to remote server
2. ✅ Verifies Docker and Docker Compose are installed
3. ✅ Downloads NeMo Microservices quickstart package
4. ✅ Sets up and starts Data Designer service
5. ✅ Configures service to be accessible at http://212.2.244.60:8080

### Prerequisites

- SSH access to vivi@212.2.244.60
- NVIDIA_API_KEY in your local .env file
- Docker and Docker Compose on remote server

### After Deployment

Update your local `.env` file:

```env
NEMO_DATA_DESIGNER_BASE_URL=http://212.2.244.60:8080
```

Test the connection:

```bash
curl http://212.2.244.60:8080/health
```

### Troubleshooting

**Service not accessible?**
- Check firewall: `ssh vivi@212.2.244.60 'sudo ufw allow 8080/tcp'`
- Check service status: `ssh vivi@212.2.244.60 'cd ~/nemo-microservices/nemo-microservices-quickstart_* && docker compose ps'`

**View logs:**
```bash
ssh vivi@212.2.244.60 'cd ~/nemo-microservices/nemo-microservices-quickstart_* && docker compose logs -f'
```

**Stop service:**
```bash
ssh vivi@212.2.244.60 'cd ~/nemo-microservices/nemo-microservices-quickstart_* && docker compose --profile data-designer down'
```

For more details, see [Remote Deployment Guide](./docs/nemo-data-designer-remote-deployment.md)
