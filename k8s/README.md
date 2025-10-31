# GKE Deployment Configuration and Setup Guide

## Overview

This directory contains optimized Kubernetes manifests and configuration for deploying Pixelated Empathy to Google Kubernetes Engine (GKE).

## Prerequisites

### Required GitLab CI/CD Variables

Configure these variables in GitLab Project Settings → CI/CD → Variables:

#### Required Variables (Masked & Protected)
- `GCP_SERVICE_ACCOUNT_KEY` - GCP service account JSON key
- `GCP_PROJECT_ID` - Your GCP project ID

#### Optional Variables (for customization)
- `GKE_CLUSTER_NAME` - Cluster name (default: pixelcluster)
- `GKE_ZONE` - GCP zone (default: us-east1)
- `GKE_NAMESPACE` - Kubernetes namespace (default: pixelated)
- `GKE_REPLICAS` - Number of replicas (default: 3)
- `GKE_ENVIRONMENT_URL` - External URL for health checks

## GCP Setup

### 1. Create GKE Cluster

```bash
# Set variables
export PROJECT_ID="your-project-id"
export CLUSTER_NAME="pixelcluster"
export ZONE="us-east1-b"

# Create cluster with optimized settings
gcloud container clusters create $CLUSTER_NAME \
  --project=$PROJECT_ID \
  --zone=$ZONE \
  --machine-type=e2-standard-4 \
  --num-nodes=3 \
  --enable-autoscaling \
  --min-nodes=3 \
  --max-nodes=10 \
  --enable-autorepair \
  --enable-autoupgrade \
  --enable-network-policy \
  --enable-ip-alias \
  --enable-shielded-nodes \
  --shielded-secure-boot \
  --shielded-integrity-monitoring \
  --disk-type=pd-ssd \
  --disk-size=50GB \
  --image-type=COS_CONTAINERD \
  --enable-stackdriver-kubernetes \
  --logging=SYSTEM,WORKLOAD \
  --monitoring=SYSTEM \
  --maintenance-window-start=2023-01-01T09:00:00Z \
  --maintenance-window-end=2023-01-01T17:00:00Z \
  --maintenance-window-recurrence="FREQ=WEEKLY;BYDAY=SA"
```

### 2. Create Service Account

```bash
# Create service account
gcloud iam service-accounts create gitlab-ci-gke \
  --display-name="GitLab CI GKE Deployer" \
  --description="Service account for GitLab CI/CD GKE deployments"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:gitlab-ci-gke@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/container.developer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:gitlab-ci-gke@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"

# Create and download key
gcloud iam service-accounts keys create gitlab-ci-key.json \
  --iam-account=gitlab-ci-gke@$PROJECT_ID.iam.gserviceaccount.com

# Convert to single line for GitLab CI variable
cat gitlab-ci-key.json | jq -c . | tr -d '\n'
```

### 3. Reserve Static IP (Optional)

```bash
# Reserve global static IP
gcloud compute addresses create pixelated-ip --global

# Get the IP address
gcloud compute addresses describe pixelated-ip --global
```

### 4. Setup Domain and SSL

```bash
# Create managed SSL certificate (will be created by Kubernetes manifest)
# Point your domain to the reserved IP address
```

## Deployment Architecture

### Security Features
- **Non-root containers** with user ID 1001
- **Read-only root filesystem** with writable tmpfs mounts
- **Dropped capabilities** with minimal required capabilities
- **Security contexts** with seccomp profiles
- **Network policies** for traffic control
- **Pod security standards** enforcement

### High Availability
- **3 replica minimum** with anti-affinity rules
- **Horizontal Pod Autoscaler** (3-10 replicas)
- **Pod Disruption Budget** (minimum 2 available)
- **Rolling updates** with zero downtime
- **Health checks** (liveness, readiness, startup)

### Performance Optimization
- **Resource requests/limits** for predictable performance
- **Memory-backed tmpfs** for temporary files
- **Efficient caching** with emptyDir volumes
- **Node affinity** for optimal placement

### Monitoring & Observability
- **Prometheus metrics** endpoint exposure
- **Structured logging** with JSON format
- **Health check endpoints** for monitoring
- **Resource usage tracking**

## Manual Deployment

If you need to deploy manually:

```bash
# Get cluster credentials
gcloud container clusters get-credentials pixelcluster --zone us-east1-b

# Apply manifests
kubectl apply -f k8s/manifests.yaml

# Check deployment status
kubectl get all -n pixelated

# Check pod logs
kubectl logs -f deployment/pixelated -n pixelated

# Port forward for testing
kubectl port-forward service/pixelated-service 8080:80 -n pixelated
```

## Monitoring Commands

```bash
# Check deployment status
kubectl get deployment pixelated -n pixelated -o wide

# Check pod health
kubectl get pods -l app=pixelated -n pixelated -o wide

# Check HPA status
kubectl get hpa pixelated-hpa -n pixelated

# Check ingress status
kubectl get ingress pixelated-ingress -n pixelated

# View events
kubectl get events -n pixelated --sort-by=.metadata.creationTimestamp

# Check resource usage
kubectl top pods -n pixelated
kubectl top nodes
```

## Troubleshooting

### Common Issues

#### 1. Image Pull Errors
```bash
# Check image pull secrets
kubectl get secret gitlab-registry -n pixelated -o yaml

# Recreate registry secret
kubectl create secret docker-registry gitlab-registry \
  --docker-server=docker.io \
  --docker-username=$CI_REGISTRY_USER \
  --docker-password=$CI_REGISTRY_PASSWORD \
  --namespace=pixelated
```

#### 2. Pod Startup Issues
```bash
# Check pod events
kubectl describe pod <pod-name> -n pixelated

# Check logs
kubectl logs <pod-name> -n pixelated

# Check resource constraints
kubectl describe node <node-name>
```

#### 3. Service Connectivity Issues
```bash
# Test service connectivity
kubectl run test-pod --image=busybox --rm -it --restart=Never -- \
  wget -qO- http://pixelated-service.pixelated.svc.cluster.local/api/health

# Check endpoints
kubectl get endpoints pixelated-service -n pixelated
```

#### 4. Ingress Issues
```bash
# Check ingress status
kubectl describe ingress pixelated-ingress -n pixelated

# Check managed certificate status
kubectl describe managedcertificate pixelated-ssl-cert -n pixelated

# Check global IP
gcloud compute addresses describe pixelated-ip --global
```

## Scaling

### Manual Scaling
```bash
# Scale deployment
kubectl scale deployment pixelated --replicas=5 -n pixelated

# Update HPA
kubectl patch hpa pixelated-hpa -n pixelated -p '{"spec":{"maxReplicas":15}}'
```

### Cluster Scaling
```bash
# Scale cluster nodes
gcloud container clusters resize pixelcluster --num-nodes=5 --zone=us-east1-b
```

## Backup and Disaster Recovery

### Configuration Backup
```bash
# Backup all resources
kubectl get all,configmap,secret,ingress,hpa,pdb,networkpolicy -n pixelated -o yaml > pixelated-backup.yaml
```

### Disaster Recovery
```bash
# Restore from backup
kubectl apply -f pixelated-backup.yaml
```

## Cost Optimization

### Resource Optimization
- Monitor resource usage with `kubectl top`
- Adjust resource requests/limits based on actual usage
- Use preemptible nodes for non-critical workloads
- Implement cluster autoscaling

### Monitoring Costs
```bash
# Check resource usage
gcloud logging read "resource.type=k8s_container AND resource.labels.project_id=$PROJECT_ID" --limit=50 --format=json

# Use GCP Cost Management tools
gcloud billing budgets list
```

## Security Best Practices

### Regular Updates
- Keep GKE cluster updated
- Update container images regularly
- Monitor security advisories

### Access Control
- Use least privilege principle
- Implement RBAC policies
- Regular access reviews

### Network Security
- Use network policies
- Implement service mesh (optional)
- Monitor network traffic

## Performance Tuning

### Application Performance
- Monitor response times
- Optimize resource allocation
- Use caching strategies

### Cluster Performance
- Monitor node utilization
- Optimize pod placement
- Use appropriate machine types

This configuration provides a production-ready, secure, and scalable deployment for Pixelated Empathy on GKE.
