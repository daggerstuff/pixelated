# GKE Cluster Status Check Commands

## Essential Commands to Check Your Cluster Status

### 1. List All GKE Clusters
```bash
# List all clusters in your project
gcloud container clusters list --project=pixelated-463209-e5

# List clusters with more details
gcloud container clusters list --project=pixelated-463209-e5 --format="table(name,zone,currentMasterVersion,currentNodeCount,status)"

# List clusters in specific region
gcloud container clusters list --project=pixelated-463209-e5 --filter="zone:us-east1*"
```

### 2. Check Specific Cluster Status
```bash
# Describe the pixelcluster (if it exists)
gcloud container clusters describe pixelcluster --zone=us-east1-d --project=pixelated-463209-e5

# Check cluster status and details
gcloud container clusters describe pixelcluster --zone=us-east1-d --project=pixelated-463209-e5 --format="yaml" | grep -E "status|currentNodeCount|currentMasterVersion"

# Check node pools
gcloud container node-pools list --cluster=pixelcluster --zone=us-east1-d --project=pixelated-463209-e5
```

### 3. Check Node Status
```bash
# Get cluster credentials first
gcloud container clusters get-credentials pixelcluster --zone=us-east1-d --project=pixelated-463209-e5

# List all nodes
kubectl get nodes

# Check node details
kubectl get nodes -o wide

# Check node resources
kubectl top nodes

# Describe specific node issues
kubectl describe node <node-name>
```

### 4. Check Quota Usage
```bash
# Check project quotas
gcloud compute project-info describe --project=pixelated-463209-e5 | grep -A 20 "quotas"

# Check specific quota metrics
gcloud compute regions describe us-east1 --project=pixelated-463209-e5 --format="table(quotas.metric,quotas.limit,quotas.usage)"

# Check SSD storage quota specifically
gcloud compute regions describe us-east1 --project=pixelated-463209-e5 --format="json" | jq '.quotas[] | select(.metric=="SSD_TOTAL_GB")'
```

### 5. Check Disk Usage
```bash
# List all disks in the project
gcloud compute disks list --project=pixelated-463209-e5

# List disks in us-east1 region
gcloud compute disks list --project=pixelated-463209-e5 --filter="zone:us-east1-d"

# Check disk sizes and types
gcloud compute disks list --project=pixelated-463209-e5 --format="table(name,sizeGb,type,status,zone)" --filter="zone:us-east1-d"
```

### 6. Check Instance Templates
```bash
# List instance templates (the missing ones from error)
gcloud compute instance-templates list --project=pixelated-463209-e5

# Check for the specific missing templates
gcloud compute instance-templates describe gke-pixelcluster-pixelcluster-node-po-13b93e96 --project=pixelated-463209-e5 || echo "Template not found"
gcloud compute instance-templates describe gke-pixelcluster-pixelcluster-node-po-d68d951c --project=pixelated-463209-e5 || echo "Template not found"
```

### 7. Check Pod Status (if cluster is accessible)
```bash
# Check if cluster is accessible
kubectl cluster-info

# List all pods
kubectl get pods --all-namespaces

# Check system pods
kubectl get pods -n kube-system

# Check your application pods
kubectl get pods -n pixelated-prod  # or whatever namespace you use
```

### 8. Check Recent Events
```bash
# Check cluster events
kubectl get events --all-namespaces --sort-by='.lastTimestamp'

# Check specific error events
kubectl get events --all-namespaces --field-selector type=Warning --sort-by='.lastTimestamp'

# Check events in your namespace
kubectl get events -n pixelated-prod --sort-by='.lastTimestamp'
```

## Quick Status Check Script

Create this script to run all checks at once:

```bash
#!/bin/bash
# save as: check-cluster-status.sh

echo "=== GKE Cluster Status Check ==="
echo "Project: pixelated-463209-e5"
echo ""

# Check clusters
echo "1. Listing all clusters:"
gcloud container clusters list --project=pixelated-463209-e5
echo ""

# Check if pixelcluster exists
if gcloud container clusters describe pixelcluster --zone=us-east1-d --project=pixelated-463209-e5 &>/dev/null; then
    echo "2. Pixelcluster status:"
    gcloud container clusters describe pixelcluster --zone=us-east1-d --project=pixelated-463209-e5 --format="table(name,zone,status,currentNodeCount,currentMasterVersion)"
    echo ""
    
    echo "3. Node pools:"
    gcloud container node-pools list --cluster=pixelcluster --zone=us-east1-d --project=pixelated-463209-e5
    echo ""
else
    echo "2. Pixelcluster not found in us-east1-d"
    echo ""
fi

# Check quotas
echo "4. Quota status for us-east1:"
gcloud compute regions describe us-east1 --project=pixelated-463209-e5 --format="table(quotas.metric,quotas.limit,quotas.usage)" --filter="quotas.metric=SSD_TOTAL_GB"
echo ""

# Check disks
echo "5. Disks in us-east1-d:"
gcloud compute disks list --project=pixelated-463209-e5 --filter="zone:us-east1-d" --format="table(name,sizeGb,type,status)"
echo ""

# Check instance templates
echo "6. Instance templates:"
gcloud compute instance-templates list --project=pixelated-463209-e5 --filter="name~gke-pixelcluster" || echo "No GKE instance templates found"
echo ""

echo "=== Status Check Complete ==="
```

## What to Look For

### Healthy Cluster Indicators:
- ✅ Cluster status: "RUNNING"
- ✅ Node count: matches expected (2-4 nodes)
- ✅ SSD usage: < 80% of quota
- ✅ All pods: "Running" status
- ✅ No recent error events

### Problem Indicators:
- ❌ Cluster status: "ERROR" or "RECONCILING"
- ❌ SSD usage: > 90% of 250GB quota
- ❌ Missing instance templates
- ❌ Nodes: "NotReady" status
- ❌ Pods: "Pending" or "Failed" status

## Next Steps Based on Findings

### If Cluster is Down:
1. Check quota and request increase
2. Optimize storage usage
3. Consider regional migration

### If Cluster is Running but Overloaded:
1. Scale down unnecessary resources
2. Implement resource limits
3. Set up monitoring alerts

### If Cluster is Healthy:
1. Set up proper monitoring
2. Implement backup strategy
3. Plan for future scaling

Run these commands and share the output to get a clear picture of your actual cluster status.