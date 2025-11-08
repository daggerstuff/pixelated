# NeMo Data Designer Deployment Guide

This guide covers deploying NeMo Data Designer for use with the Pixelated Empathy platform.

## Overview

According to the [official NVIDIA documentation](https://docs.nvidia.com/nemo/microservices/latest/design-synthetic-data-from-scratch-or-seeds/index.html), NeMo Data Designer must be deployed on your infrastructure. It is not available as a cloud API service.

## Deployment Options

### Option 1: Docker Compose (Recommended for Local Development)

**Prerequisites:**
- Docker installed
- Docker Compose installed
- NVIDIA API key

**Steps:**

1. Ensure your NVIDIA API key is set in `.env`:
   ```env
   NVIDIA_API_KEY=your-api-key-here
   ```

2. Deploy using the provided script:
   ```bash
   ./scripts/deploy-nemo-data-designer.sh
   ```

3. Verify the service is running:
   ```bash
   curl http://localhost:8000/health
   ```

4. Update your `.env` file:
   ```env
   NEMO_DATA_DESIGNER_BASE_URL=http://localhost:8000
   ```

**Troubleshooting:**

- Check logs: `docker-compose -f docker-compose.nemo-data-designer.yml logs`
- Check container status: `docker-compose -f docker-compose.nemo-data-designer.yml ps`
- Restart service: `docker-compose -f docker-compose.nemo-data-designer.yml restart`

### Option 2: Kubernetes/Helm (For Production)

**Prerequisites:**
- Kubernetes cluster
- Helm 3.x installed
- NVIDIA API key
- NGC API key for pulling container images

**Steps:**

1. Add the NVIDIA Helm repository:
   ```bash
   helm repo add nvidia https://helm.ngc.nvidia.com/nvidia
   helm repo update
   ```

2. Create a namespace:
   ```bash
   kubectl create namespace nemo
   ```

3. Create a secret for your NVIDIA API key:
   ```bash
   kubectl create secret generic nvidia-api-key \
     --from-literal=api-key=your-api-key-here \
     -n nemo
   ```

4. Install the NeMo Microservices Helm chart:
   ```bash
   helm install nemo-microservices nvidia/nemo-microservices \
     --namespace nemo \
     --set dataDesigner.enabled=true \
     --set global.nvidiaApiKeySecretName=nvidia-api-key
   ```

5. Get the ingress URL:
   ```bash
   kubectl get ingress -n nemo
   ```

6. Update your `.env` file with the ingress URL:
   ```env
   NEMO_DATA_DESIGNER_BASE_URL=http://your-ingress-url
   ```

**For detailed Kubernetes deployment instructions, see:**
- [Official NeMo Data Designer Deployment Guide](https://docs.nvidia.com/nemo/microservices/latest/set-up/deploy-as-microservices/data-designer/parent-chart.html)
- [NeMo Microservices Helm Chart Documentation](https://docs.nvidia.com/nemo/microservices/latest/admin-setup/install-individually/nemo-data-designer/helm-chart.html)

## Verification

After deployment, verify the service is working:

```bash
# Check health endpoint
curl http://localhost:8000/health

# Test with Python
uv run python ai/data_designer/test_setup.py
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NVIDIA_API_KEY` | Your NVIDIA API key | - | Yes |
| `NEMO_DATA_DESIGNER_BASE_URL` | Service URL | `http://localhost:8000` | Yes |
| `NEMO_DATA_DESIGNER_TIMEOUT` | Request timeout (seconds) | `300` | No |
| `NEMO_DATA_DESIGNER_MAX_RETRIES` | Max retry attempts | `3` | No |
| `NEMO_DATA_DESIGNER_BATCH_SIZE` | Batch size for processing | `1000` | No |

### Base URL Configuration

The `NEMO_DATA_DESIGNER_BASE_URL` depends on your deployment:

- **Local Docker Compose**: `http://localhost:8000`
- **Kubernetes (minikube)**: `http://nemo.test` (or your ingress URL)
- **Kubernetes (production)**: Your cluster's ingress URL
- **Custom deployment**: The URL where your service is accessible

## Troubleshooting

### Service Not Accessible

1. **Check if the service is running:**
   ```bash
   # Docker Compose
   docker-compose -f docker-compose.nemo-data-designer.yml ps
   
   # Kubernetes
   kubectl get pods -n nemo
   ```

2. **Check service logs:**
   ```bash
   # Docker Compose
   docker-compose -f docker-compose.nemo-data-designer.yml logs -f
   
   # Kubernetes
   kubectl logs -n nemo -l app=nemo-data-designer
   ```

3. **Verify the base URL is correct:**
   ```bash
   curl -v http://localhost:8000/health
   ```

### 404 Errors

If you're getting 404 errors:
- Verify the service is deployed and running
- Check that the `NEMO_DATA_DESIGNER_BASE_URL` is correct
- Ensure the service is accessible from your application

### Authentication Errors

If you're getting authentication errors:
- Verify your `NVIDIA_API_KEY` is set correctly
- Check that the API key has the necessary permissions
- Ensure the key is valid and not expired

### Connection Timeouts

If requests are timing out:
- Increase `NEMO_DATA_DESIGNER_TIMEOUT` in your `.env` file
- Check network connectivity to the service
- Verify the service has sufficient resources

## Resources

- [Official NeMo Data Designer Documentation](https://docs.nvidia.com/nemo/microservices/latest/design-synthetic-data-from-scratch-or-seeds/index.html)
- [Deployment Guide](https://docs.nvidia.com/nemo/microservices/latest/set-up/deploy-as-microservices/data-designer/parent-chart.html)
- [Docker Compose Deployment](https://docs.nvidia.com/nemo/microservices/latest/design-synthetic-data-from-scratch-or-seeds/deploy-with-docker/index.html)
- [Helm Chart Documentation](https://docs.nvidia.com/nemo/microservices/latest/admin-setup/install-individually/nemo-data-designer/helm-chart.html)

