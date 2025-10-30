# AI Inference Load Balancing Configuration

## Overview

This directory contains Kubernetes configurations for the AI inference service with optimized load balancing, auto-scaling, and high availability to meet the <2s response time SLO.

## Architecture

```
                                    ┌─────────────────┐
                                    │  AWS NLB/ALB    │
                                    │  (Load Balancer)│
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
              ┌─────▼─────┐           ┌─────▼─────┐           ┌─────▼─────┐
              │ AI Pod 1  │           │ AI Pod 2  │           │ AI Pod 3  │
              │ (GPU)     │           │ (GPU)     │           │ (GPU)     │
              └─────┬─────┘           └─────┬─────┘           └─────┬─────┘
                    │                        │                        │
                    └────────────────────────┼────────────────────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
              ┌─────▼─────┐           ┌─────▼─────┐           ┌─────▼─────┐
              │ PostgreSQL│           │   Redis   │           │  MongoDB  │
              └───────────┘           └───────────┘           └───────────┘
```

## Components

### 1. Load Balancer (`load-balancer.yaml`)

**Features**:
- AWS Network Load Balancer (NLB) for low latency
- Cross-zone load balancing for high availability
- SSL/TLS termination
- Health checks every 10 seconds
- Session affinity (1-hour stickiness)
- Connection idle timeout: 5 minutes
- Access logging to S3

**Services**:
- `ai-inference-lb`: External load balancer (ports 80, 443)
- `ai-inference-headless`: Direct pod access
- `ai-inference-internal`: Cluster-internal communication

### 2. Deployment (`deployment.yaml`)

**Configuration**:
- 3 replicas (minimum)
- GPU-enabled nodes (1 GPU per pod)
- Zero-downtime rolling updates
- Pod anti-affinity for high availability
- Zone distribution for fault tolerance

**Resources**:
- CPU: 2-4 cores per pod
- Memory: 8-16 GB per pod
- GPU: 1 per pod

**Health Checks**:
- Liveness: 30s interval
- Readiness: 10s interval
- Startup: Up to 5 minutes for model loading

### 3. Horizontal Pod Autoscaler (`hpa.yaml`)

**Scaling Metrics**:
- CPU utilization: 70% target
- Memory utilization: 75% target
- GPU utilization: 70% target
- Request rate: 50 RPS per pod
- Response time: 1.5s (p95)
- Queue depth: 10 requests

**Scaling Behavior**:
- Min replicas: 3
- Max replicas: 20
- Scale up: Fast (30s stabilization, up to 4 pods at once)
- Scale down: Slow (5min stabilization, max 1 pod at a time)

### 4. Configuration (`configmap.yaml`)

**Settings**:
- Model configuration
- Performance tuning
- Caching settings
- Rate limiting
- Feature flags

**Prometheus Rules**:
- Response time alerts (<2s SLO)
- Error rate monitoring
- GPU utilization tracking
- SLO breach detection

## Deployment

### Prerequisites

1. Kubernetes cluster with GPU nodes
2. NVIDIA GPU operator installed
3. Prometheus operator for monitoring
4. Cert-manager for SSL certificates

### Installation

```bash
# Create namespace
kubectl create namespace pixelated-prod

# Apply configurations in order
kubectl apply -f configmap.yaml
kubectl apply -f deployment.yaml
kubectl apply -f load-balancer.yaml
kubectl apply -f hpa.yaml

# Verify deployment
kubectl get pods -n pixelated-prod -l component=ai-inference
kubectl get svc -n pixelated-prod -l component=ai-inference
kubectl get hpa -n pixelated-prod
```

### Configuration

1. **Update secrets** in `deployment.yaml`:
   - Database credentials
   - Redis password
   - MongoDB URI
   - API keys

2. **Update load balancer annotations** in `load-balancer.yaml`:
   - SSL certificate ARN
   - S3 bucket for access logs
   - IP whitelist ranges

3. **Adjust scaling parameters** in `hpa.yaml`:
   - Min/max replicas
   - Target metrics
   - Scaling behavior

## Performance Optimization

### Response Time (<2s SLO)

**Optimizations**:
1. **Model Caching**: Pre-loaded models in memory
2. **Request Batching**: Batch size up to 8
3. **Connection Pooling**: 100 connections per pod
4. **Redis Caching**: 1-hour TTL for common responses
5. **GPU Acceleration**: 1 GPU per pod

**Monitoring**:
```bash
# Check p95 response time
kubectl exec -n pixelated-prod deploy/ai-inference -- \
  curl localhost:9090/metrics | grep inference_response_time

# View HPA status
kubectl get hpa -n pixelated-prod ai-inference-hpa -w
```

### Load Balancing Strategy

**Session Affinity**:
- Enabled with 1-hour timeout
- Ensures consistent routing for stateful sessions
- Important for progress tracking continuity

**Health Checks**:
- Interval: 10 seconds
- Timeout: 5 seconds
- Healthy threshold: 2 checks
- Unhealthy threshold: 2 checks

**Connection Settings**:
- Idle timeout: 5 minutes (for long inference)
- Draining timeout: 60 seconds (graceful shutdown)

## Monitoring

### Metrics

**Key Metrics**:
- `inference_response_time_seconds`: Response time histogram
- `inference_requests_total`: Total requests
- `inference_errors_total`: Error count
- `gpu_utilization`: GPU usage percentage
- `inference_queue_depth`: Request queue size
- `cache_hit_rate`: Cache effectiveness

**Dashboards**:
```bash
# Access Prometheus
kubectl port-forward -n monitoring svc/prometheus 9090:9090

# Access Grafana
kubectl port-forward -n monitoring svc/grafana 3000:3000
```

### Alerts

**Critical Alerts**:
- Response time > 2s (SLO breach)
- Error rate > 5%
- Pod not ready for 5 minutes
- Model loading failure

**Warning Alerts**:
- GPU utilization > 95%
- Memory usage > 90%
- High request queue depth
- Low cache hit rate

## Troubleshooting

### Slow Response Times

```bash
# Check pod resource usage
kubectl top pods -n pixelated-prod -l component=ai-inference

# Check HPA status
kubectl describe hpa -n pixelated-prod ai-inference-hpa

# Check pod logs
kubectl logs -n pixelated-prod -l component=ai-inference --tail=100

# Check metrics
kubectl exec -n pixelated-prod deploy/ai-inference -- \
  curl localhost:9090/metrics | grep -E "(response_time|queue_depth)"
```

### High Error Rate

```bash
# Check pod status
kubectl get pods -n pixelated-prod -l component=ai-inference

# Check recent errors
kubectl logs -n pixelated-prod -l component=ai-inference --tail=100 | grep ERROR

# Check database connectivity
kubectl exec -n pixelated-prod deploy/ai-inference -- \
  curl localhost:8000/api/v1/health
```

### Scaling Issues

```bash
# Check HPA events
kubectl describe hpa -n pixelated-prod ai-inference-hpa

# Check metrics server
kubectl get apiservice v1beta1.metrics.k8s.io

# Manually scale
kubectl scale deployment -n pixelated-prod ai-inference --replicas=5
```

## Load Testing

### Basic Load Test

```bash
# Install hey (HTTP load generator)
go install github.com/rakyll/hey@latest

# Run load test
hey -n 10000 -c 100 -m POST \
  -H "Content-Type: application/json" \
  -d '{"conversation_context":[],"user_input":"Hello"}' \
  https://your-domain.com/api/v1/inference
```

### Expected Results

**Target Performance**:
- Throughput: 1000+ RPS
- P50 latency: <500ms
- P95 latency: <2s
- P99 latency: <3s
- Error rate: <1%

## Security

### Network Policies

**Ingress**:
- Allow from load balancer
- Allow from web application
- Allow from monitoring

**Egress**:
- Allow to databases (PostgreSQL, Redis, MongoDB)
- Allow DNS resolution
- Allow external API calls (HTTPS)

### Pod Security

**Security Context**:
- Run as non-root user (UID 1001)
- Read-only root filesystem
- No privilege escalation
- Drop all capabilities

### Secrets Management

```bash
# Create secrets
kubectl create secret generic ai-inference-secrets \
  --from-literal=postgres-host=postgres.example.com \
  --from-literal=postgres-db=pixelated \
  --from-literal=postgres-user=ai_inference \
  --from-literal=postgres-password=<password> \
  --from-literal=redis-password=<password> \
  --from-literal=mongodb-uri=<uri> \
  -n pixelated-prod
```

## High Availability

### Fault Tolerance

**Pod Distribution**:
- 3+ replicas across multiple zones
- Pod anti-affinity rules
- Pod disruption budget (min 2 available)

**Zero Downtime Deployments**:
- Rolling update strategy
- Max surge: 1 pod
- Max unavailable: 0 pods
- Readiness probes before traffic

### Disaster Recovery

**Backup**:
- Model storage: Persistent volumes with snapshots
- Progress tracking DB: Regular backups to S3
- Configuration: GitOps with version control

**Recovery**:
```bash
# Restore from backup
kubectl apply -f backup/

# Verify health
kubectl get pods -n pixelated-prod -l component=ai-inference
kubectl exec -n pixelated-prod deploy/ai-inference -- \
  curl localhost:8000/api/v1/health
```

## Cost Optimization

### Resource Efficiency

**Right-sizing**:
- Use VPA recommendations
- Monitor actual usage vs requests
- Adjust based on load patterns

**Spot Instances**:
```yaml
# Add to deployment.yaml
nodeSelector:
  node-lifecycle: spot
tolerations:
- key: "spot"
  operator: "Equal"
  value: "true"
  effect: "NoSchedule"
```

**Scheduled Scaling**:
```bash
# Scale down during off-hours
kubectl scale deployment -n pixelated-prod ai-inference --replicas=3

# Scale up during peak hours
kubectl scale deployment -n pixelated-prod ai-inference --replicas=10
```

## Next Steps

1. **Deploy to staging**: Test configuration in staging environment
2. **Load testing**: Validate performance under load
3. **Monitor metrics**: Ensure SLOs are met
4. **Tune parameters**: Adjust based on actual usage
5. **Document runbooks**: Create operational procedures

## References

- [Kubernetes HPA Documentation](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)
- [NVIDIA GPU Operator](https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/)
- [Prometheus Operator](https://prometheus-operator.dev/)

---

**Status**: Ready for deployment  
**Last Updated**: October 2025  
**Maintainer**: DevOps Team
