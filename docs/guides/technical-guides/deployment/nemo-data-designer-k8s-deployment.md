# NeMo Data Designer Kubernetes Deployment Guide

## Overview

This guide explains how to deploy NVIDIA NeMo Data Designer on a Kubernetes cluster using the provided deployment script and manifests.

## Prerequisites

Before deploying NeMo Data Designer to Kubernetes, ensure you have:

1. **Kubernetes Cluster** - A functioning Kubernetes cluster (v1.20+)
2. **kubectl** - Kubernetes command-line tool configured to access your cluster
3. **Helm** - Helm v3.0+ installed locally
4. **NVIDIA API Key** - From [NVIDIA Build](https://build.nvidia.com/nemo/data-designer)
5. **Ingress Controller** - Configured in your cluster (nginx-ingress, traefik, etc.)
6. **Persistent Storage** - Available storage class for data persistence

## Deployment Options

### Option 1: Automated Deployment Script (Recommended)

The simplest way to deploy NeMo Data Designer is using the provided deployment script:

```bash
./scripts/infrastructure/deploy-nemo-data-designer-k8s.sh
```

This script will:

1. Create the `nemo` namespace
2. Add the NVIDIA Helm repository
3. Create a Kubernetes secret with your NVIDIA API key
4. Deploy NeMo Data Designer using Helm charts
5. Configure ingress for external access

### Option 2: Manual Helm Deployment

If you prefer to deploy manually with Helm:

```bash
# Add NVIDIA Helm repository
helm repo add nemo-microservices https://nvidia.github.io/nemo-microservices-helm-charts
helm repo update

# Create namespace
kubectl create namespace nemo

# Create secret for NVIDIA API key
kubectl create secret generic nemo-api-key \
    --from-literal=api-key="YOUR_NVIDIA_API_KEY" \
    --namespace=nemo

# Deploy using Helm
helm upgrade --install nemo-data-designer nemo-data-designer \
    --repo https://nvidia.github.io/nemo-microservices-helm-charts \
    --namespace nemo \
    --set nemoMicroservices.image.registry="nvcr.io/nvidia/nemo-microservices" \
    --set nemoMicroservices.apiKeySecret.name="nemo-api-key" \
    --set nemoMicroservices.apiKeySecret.key="api-key" \
    --set service.type="ClusterIP" \
    --set ingress.enabled=true \
    --set ingress.hosts[0].host="nemo-data-designer.your-cluster-domain.com" \
    --set ingress.hosts[0].paths[0].path="/" \
    --set ingress.hosts[0].paths[0].pathType="Prefix"
```

### Option 3: Kubernetes Manifest

Deploy using the provided Kubernetes manifest:

```bash
kubectl apply -f ai/nemo-data-designer-k8s.yaml
```

Then manually update the secret with your API key:

```bash
kubectl create secret generic nemo-api-key \
    --from-literal=api-key="YOUR_NVIDIA_API_KEY" \
    --namespace=nemo \
    --dry-run=client -o yaml | kubectl apply -f -
```

## Configuration

### Environment Variables

Update your `.env` file with your cluster's ingress URL:

```env
# NVIDIA NeMo Data Designer Configuration
NVIDIA_API_KEY=your-api-key-here
NEMO_DATA_DESIGNER_BASE_URL=https://nemo-data-designer.your-cluster-domain.com
NEMO_DATA_DESIGNER_TIMEOUT=300
NEMO_DATA_DESIGNER_MAX_RETRIES=3
NEMO_DATA_DESIGNER_BATCH_SIZE=1000
```

### Customizing the Deployment

You can customize the deployment by modifying the script parameters:

```bash
# Set custom namespace
NAMESPACE=my-nemo ./scripts/infrastructure/deploy-nemo-data-designer-k8s.sh

# Set custom release name
RELEASE_NAME=data-designer-prod ./scripts/infrastructure/deploy-nemo-data-designer-k8s.sh

# Set custom ingress host
INGRESS_HOST=nemo.internal.company.com ./scripts/infrastructure/deploy-nemo-data-designer-k8s.sh
```

## Verification

After deployment, verify that the service is running:

```bash
# Check pods
kubectl get pods -n nemo

# Check services
kubectl get services -n nemo

# Check ingress
kubectl get ingress -n nemo

# Check logs
kubectl logs -l app=nemo-data-designer -n nemo -f

# Test health endpoint
curl https://nemo-data-designer.your-cluster-domain.com/health
```

You should see a response like:
```json
{
  "status": "healthy",
  "version": "25.10",
  "timestamp": "2025-12-16T10:30:45Z"
}
```

## Troubleshooting

### Pod Not Starting

Check pod status and logs:

```bash
kubectl get pods -n nemo
kubectl describe pod -l app=nemo-data-designer -n nemo
kubectl logs -l app=nemo-data-designer -n nemo
```

### Ingress Not Working

Verify ingress configuration:

```bash
kubectl get ingress -n nemo
kubectl describe ingress nemo-data-designer -n nemo
```

Ensure your DNS is pointing to the correct ingress controller IP.

### Authentication Issues

Verify the API key secret:

```bash
kubectl get secret nemo-api-key -n nemo -o yaml
```

Recreate the secret if needed:

```bash
kubectl delete secret nemo-api-key -n nemo
kubectl create secret generic nemo-api-key \
    --from-literal=api-key="YOUR_NVIDIA_API_KEY" \
    --namespace=nemo
```

### Resource Constraints

If the pod is being evicted due to resource constraints, adjust the resource limits in the deployment:

```bash
kubectl edit deployment nemo-data-designer -n nemo
```

## Scaling

To scale the deployment:

```bash
# Scale to 3 replicas
kubectl scale deployment nemo-data-designer --replicas=3 -n nemo
```

## Updates

To update the deployment:

```bash
# Re-run the deployment script
./scripts/infrastructure/deploy-nemo-data-designer-k8s.sh

# Or manually upgrade with Helm
helm upgrade nemo-data-designer nemo-data-designer \
    --repo https://nvidia.github.io/nemo-microservices-helm-charts \
    --namespace nemo
```

## Cleanup

To remove the deployment:

```bash
# Using Helm
helm uninstall nemo-data-designer -n nemo

# Or delete the namespace (removes everything)
kubectl delete namespace nemo
```

## Monitoring

Monitor the service with:

```bash
# Check resource usage
kubectl top pods -n nemo

# View logs continuously
kubectl logs -l app=nemo-data-designer -n nemo -f

# Port forward for direct access
kubectl port-forward svc/nemo-data-designer 8000:8000 -n nemo
```

## Security Considerations

1. **API Key Security**: The NVIDIA API key is stored as a Kubernetes secret
2. **Network Policies**: Consider implementing network policies to restrict access
3. **TLS Encryption**: Ensure your ingress controller terminates TLS
4. **RBAC**: Use appropriate RBAC rules for the service account

## Best Practices

1. **Resource Limits**: Set appropriate CPU and memory limits
2. **Health Checks**: Configure readiness and liveness probes
3. **Persistent Storage**: Use persistent volumes for data that needs to persist
4. **Monitoring**: Implement monitoring and alerting for the service
5. **Backups**: Regularly backup configuration and generated datasets
6. **Updates**: Keep the deployment updated with the latest NeMo versions

## Support

For issues with the Kubernetes deployment:

1. Check the [troubleshooting section](#troubleshooting) above
2. Review Kubernetes logs and events
3. Ensure all prerequisites are met
4. Check the [NVIDIA NeMo Documentation](https://docs.nvidia.com/nemo/microservices/latest/set-up/deploy-as-microservices/data-designer/parent-chart.html)

For issues with NVIDIA NeMo Data Designer itself:

1. Visit [NVIDIA NeMo Documentation](https://docs.nvidia.com/nemo/)
2. Check [NVIDIA Developer Forums](https://forums.developer.nvidia.com/)