# NeMo Data Designer - Quick Deployment Guide

## Kubernetes Cluster Deployment

### One-Command Deployment

```bash
./scripts/deploy-nemo-data-designer-k8s.sh
```

### What It Does

1. ✅ Creates Kubernetes deployment for NeMo Data Designer service
2. ✅ Sets up service with proper networking and load balancing
3. ✅ Configures persistent volumes for data storage
4. ✅ Sets up ingress controller for external access
5. ✅ Configures service to be accessible through your cluster's ingress

### Prerequisites

- kubectl configured to access your Kubernetes cluster
- NVIDIA_API_KEY in your local .env file
- Kubernetes cluster with sufficient resources (recommended: 4 vCPU, 8GB RAM)
- Ingress controller configured in your cluster

### After Deployment

Update your local `.env` file with your cluster's ingress URL:

```env
NEMO_DATA_DESIGNER_BASE_URL=https://nemo-data-designer.your-cluster-domain.com
```

Test the connection:

```bash
curl https://nemo-data-designer.your-cluster-domain.com/health
```

### Troubleshooting

**Service not accessible?**
- Check deployment status: `kubectl get deployments nemo-data-designer`
- Check service status: `kubectl get services nemo-data-designer`
- Check ingress status: `kubectl get ingress nemo-data-designer`

**View logs:**
```bash
kubectl logs -l app=nemo-data-designer -f
```

**Restart service:**
```bash
kubectl rollout restart deployment/nemo-data-designer
```

For more details, see [Kubernetes Deployment Guide](./docs/guides/technical-guides/deployment/nemo-data-designer-k8s-deployment.md)
