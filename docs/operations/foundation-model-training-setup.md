# Foundation Model Training Infrastructure Setup

## Overview

This document describes the enhanced Docker/Kubernetes infrastructure for foundation model training in the Pixelated Empathy platform, implementing the requirements from `.kiro/specs/foundation-model-training/requirements.md`.

## Architecture

### Core Components

1. **Training Service** (`docker/training-service/`)
   - GPU-enabled container with CUDA 12.1 support
   - Lightning.ai integration for distributed training
   - LoRA (Low-Rank Adaptation) fine-tuning capabilities
   - H100 GPU optimization

2. **Kubernetes Deployment** (`k8s/training/`)
   - GPU-aware scheduling and resource management
   - HIPAA-compliant security contexts
   - Persistent storage for training data and models
   - Network policies for secure communication

3. **Monitoring Stack**
   - Grafana dashboard for training metrics
   - Prometheus monitoring with GPU metrics
   - Real-time training progress tracking

4. **Enhanced Helm Charts** (`helm/`)
   - Training-specific configurations
   - Environment-based deployments
   - Automated scaling and resource management

## Quick Start

### Prerequisites

- Kubernetes cluster with GPU nodes (H100 recommended)
- NVIDIA GPU Operator installed
- Helm 3.x
- Docker with BuildKit support
- kubectl configured

### 1. Environment Setup

```bash
# Set required environment variables
export LIGHTNING_PROJECT_ID="your-lightning-project-id"
export WANDB_API_KEY="your-wandb-api-key"
export HF_TOKEN="your-huggingface-token"
```

### 2. Deploy Infrastructure

```bash
# Deploy using the automated script
./scripts/deploy-training-infrastructure.sh

# Or deploy specific components manually
kubectl apply -f k8s/training/
```

### 3. Verify Deployment

```bash
# Check training service status
kubectl get pods -n pixelated-training

# Access training service
kubectl port-forward -n pixelated-training service/training-service 8003:80

# Test health endpoint
curl http://localhost:8003/health
```

## Configuration

### Training Service Configuration

The training service supports the following environment variables:

- `CUDA_VISIBLE_DEVICES`: GPU device selection
- `PYTORCH_CUDA_ALLOC_CONF`: CUDA memory allocation configuration
- `LIGHTNING_CLOUD_PROJECT_ID`: Lightning.ai project identifier
- `WANDB_API_KEY`: Weights & Biases API key for experiment tracking
- `HF_TOKEN`: Hugging Face token for model access

### Resource Requirements

#### GPU Training Node
- **CPU**: 16 cores minimum
- **Memory**: 64GB minimum  
- **GPU**: NVIDIA H100 or A100
- **Storage**: 1TB SSD for fast I/O

#### Storage Requirements
- **Training Data**: 500GB (read-only, shared)
- **Model Output**: 200GB (read-write)
- **Checkpoints**: 100GB (read-write)
- **Cache**: 10GB (ephemeral)

## Security & Compliance

### HIPAA Compliance Features

1. **Pod Security Standards**
   - Non-root container execution
   - Read-only root filesystem
   - Dropped capabilities
   - Seccomp profiles

2. **Network Policies**
   - Restricted ingress/egress traffic
   - Namespace isolation
   - Encrypted communications

3. **Access Control**
   - RBAC with minimal permissions
   - Service account isolation
   - Secrets management

### Security Best Practices

```yaml
# Example security context
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  runAsGroup: 1001
  fsGroup: 1001
  seccompProfile:
    type: RuntimeDefault
```

## Monitoring & Observability

### Grafana Dashboard

Access the foundation model training dashboard:
- **URL**: `http://grafana.your-domain.com/d/training`
- **Metrics**: GPU utilization, training loss, throughput
- **Alerts**: Training stalls, resource exhaustion

### Key Metrics

1. **Training Progress**
   - Current epoch
   - Training/validation loss
   - Model accuracy and perplexity

2. **Resource Utilization**
   - GPU memory and compute usage
   - CPU and system memory
   - Storage I/O performance

3. **Performance Metrics**
   - Batches processed per second
   - Data loading time
   - Training throughput

## Deployment Options

### Option 1: Helm Deployment (Recommended)

```bash
# Install with training configuration
helm install pixelated-training ./helm \
  -f helm/values-training.yaml \
  --namespace pixelated-training \
  --create-namespace
```

### Option 2: kubectl Deployment

```bash
# Deploy individual components
kubectl apply -f k8s/training/namespace.yaml
kubectl apply -f k8s/training/pvc.yaml
kubectl apply -f k8s/security/pod-security-policy.yaml
kubectl apply -f k8s/training/deployment.yaml
```

### Option 3: Docker Compose (Development)

```bash
# Local development with GPU support
docker compose -f docker-compose.training.yml up
```

## Troubleshooting

### Common Issues

1. **GPU Not Detected**
   ```bash
   # Check GPU nodes
   kubectl get nodes -o json | jq '.items[].status.allocatable'
   
   # Verify NVIDIA GPU Operator
   kubectl get pods -n gpu-operator-resources
   ```

2. **Training Service Fails to Start**
   ```bash
   # Check pod logs
   kubectl logs -n pixelated-training deployment/training-service
   
   # Verify secrets
   kubectl get secrets -n pixelated-training
   ```

3. **Storage Issues**
   ```bash
   # Check PVC status
   kubectl get pvc -n pixelated-training
   
   # Verify storage class
   kubectl get storageclass
   ```

### Performance Optimization

1. **GPU Memory Optimization**
   ```python
   # Set CUDA memory allocation
   os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'max_split_size_mb:512'
   ```

2. **Data Loading Optimization**
   ```yaml
   # Shared memory for faster data loading
   volumes:
   - name: shared-memory
     emptyDir:
       medium: Memory
       sizeLimit: 8Gi
   ```

## Integration with Existing Services

### Bias Detection Integration

The training service integrates with the existing bias detection pipeline:

```python
# Connect to bias detection service
bias_detector = BiasDetectionClient(
    endpoint="http://bias-detection.pixelated-prod:8001"
)
```

### Database Connections

Training metadata is stored in PostgreSQL:

```python
# Connection to training database
DATABASE_URL = "postgresql://training_user:password@db:5432/pixelated_training"
```

## Maintenance

### Backup Procedures

1. **Model Checkpoints**
   ```bash
   # Backup model checkpoints
   kubectl exec -n pixelated-training deployment/training-service -- \
     tar -czf /tmp/checkpoints.tar.gz /app/checkpoints
   ```

2. **Training Data**
   ```bash
   # Backup training data
   kubectl cp pixelated-training/training-service:/app/data ./backup/
   ```

### Scaling Operations

```bash
# Scale training replicas (usually 1 for training)
kubectl scale deployment training-service -n pixelated-training --replicas=1

# Update resource limits
kubectl patch deployment training-service -n pixelated-training -p \
  '{"spec":{"template":{"spec":{"containers":[{"name":"training","resources":{"limits":{"nvidia.com/gpu":"2"}}}]}}}}'
```

## Support

For issues related to the foundation model training infrastructure:
1. Check the troubleshooting section above
2. Review pod logs and events
3. Consult the monitoring dashboard
4. Contact the DevOps team with specific error messages

## Related Documentation

- [Foundation Model Training Requirements](.kiro/specs/foundation-model-training/requirements.md)
- [Docker README](docker/README.md)
- [Kubernetes Production Guide](k8s/README.md)
- [Monitoring Setup](monitoring/README.md)