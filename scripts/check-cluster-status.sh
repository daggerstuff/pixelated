#!/bin/bash
# GKE Cluster Status Check Script
# Run this to get a complete picture of your cluster status

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Project ID from error message
PROJECT_ID="pixelated-463209-e5"
CLUSTER_NAME="pixelcluster"
ZONE="us-east1-d"

echo "🔍 GKE Cluster Status Check"
echo "=========================="
echo "Project: $PROJECT_ID"
echo "Cluster: $CLUSTER_NAME"
echo "Zone: $ZONE"
echo ""

# Function to print status
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "OK" ]; then
        echo -e "${GREEN}✅ $message${NC}"
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠️  $message${NC}"
    else
        echo -e "${RED}❌ $message${NC}"
    fi
}

# 1. Check if gcloud is configured
echo "1. Checking gcloud configuration..."
if ! gcloud config list project | grep -q "$PROJECT_ID"; then
    print_status "ERROR" "gcloud not configured for project $PROJECT_ID"
    echo "Run: gcloud config set project $PROJECT_ID"
    exit 1
fi
print_status "OK" "gcloud configured for $PROJECT_ID"

# 2. Check if cluster exists
echo ""
echo "2. Checking cluster existence..."
if gcloud container clusters describe "$CLUSTER_NAME" --zone="$ZONE" --project="$PROJECT_ID" &>/dev/null; then
    CLUSTER_STATUS=$(gcloud container clusters describe "$CLUSTER_NAME" --zone="$ZONE" --project="$PROJECT_ID" --format="value(status)")
    print_status "OK" "Cluster $CLUSTER_NAME exists in $ZONE"
    echo "   Status: $CLUSTER_STATUS"
else
    print_status "ERROR" "Cluster $CLUSTER_NAME NOT FOUND in $ZONE"
    echo ""
    echo "Available clusters in project:"
    gcloud container clusters list --project="$PROJECT_ID" --format="table(name,zone,status)" || echo "No clusters found"
    exit 1
fi

# 3. Get cluster details
echo ""
echo "3. Cluster details:"
gcloud container clusters describe "$CLUSTER_NAME" --zone="$ZONE" --project="$PROJECT_ID" --format="table(
    name,
    zone,
    status,
    currentNodeCount,
    currentMasterVersion,
    endpoint,
    network,
    subnetwork
)"

# 4. Check node pools
echo ""
echo "4. Node pools:"
if gcloud container node-pools list --cluster="$CLUSTER_NAME" --zone="$ZONE" --project="$PROJECT_ID" &>/dev/null; then
    gcloud container node-pools list --cluster="$CLUSTER_NAME" --zone="$ZONE" --project="$PROJECT_ID" --format="table(
        name,
        config.machineType,
        config.diskSizeGb,
        config.diskType,
        initialNodeCount,
        autoscaling.enabled,
        autoscaling.minNodeCount,
        autoscaling.maxNodeCount
    )"
else
    print_status "WARN" "No node pools found"
fi

# 5. Check quota usage
echo ""
echo "5. Quota usage in us-east1:"
SSD_QUOTA=$(gcloud compute regions describe us-east1 --project="$PROJECT_ID" --format="json" | jq -r '.quotas[] | select(.metric=="SSD_TOTAL_GB") | "\(.usage)/\(.limit)"')
CPU_QUOTA=$(gcloud compute regions describe us-east1 --project="$PROJECT_ID" --format="json" | jq -r '.quotas[] | select(.metric=="CPUS_ALL_REGIONS") | "\(.usage)/\(.limit)"')
IP_QUOTA=$(gcloud compute regions describe us-east1 --project="$PROJECT_ID" --format="json" | jq -r '.quotas[] | select(.metric=="IN_USE_ADDRESSES") | "\(.usage)/\(.limit)"')

echo "   SSD Storage: $SSD_QUOTA GB"
echo "   CPU Cores: $CPU_QUOTA"
echo "   External IPs: $IP_QUOTA"

# Check if quotas are exceeded
SSD_USAGE=$(gcloud compute regions describe us-east1 --project="$PROJECT_ID" --format="json" | jq -r '.quotas[] | select(.metric=="SSD_TOTAL_GB") | .usage')
SSD_LIMIT=$(gcloud compute regions describe us-east1 --project="$PROJECT_ID" --format="json" | jq -r '.quotas[] | select(.metric=="SSD_TOTAL_GB") | .limit')

if [ "$SSD_USAGE" -ge "$SSD_LIMIT" ]; then
    print_status "ERROR" "SSD quota EXCEEDED: $SSD_USAGE/$SSD_LIMIT GB"
elif [ "$SSD_USAGE" -ge $(($SSD_LIMIT * 80 / 100)) ]; then
    print_status "WARN" "SSD quota high: $SSD_USAGE/$SSD_LIMIT GB (80%+)"
else
    print_status "OK" "SSD quota healthy: $SSD_USAGE/$SSD_LIMIT GB"
fi

# 6. Check disks
echo ""
echo "6. Disks in $ZONE:"
DISK_COUNT=$(gcloud compute disks list --project="$PROJECT_ID" --filter="zone=$ZONE" --format="value(name)" | wc -l)
echo "   Total disks: $DISK_COUNT"

if [ "$DISK_COUNT" -gt 0 ]; then
    echo "   Disk details:"
    gcloud compute disks list --project="$PROJECT_ID" --filter="zone=$ZONE" --format="table(
        name,
        sizeGb,
        type,
        status,
        users.list():label=ATTACHED_TO
    )" | head -10
fi

# 7. Check instance templates
echo ""
echo "7. Instance templates:"
TEMPLATE_COUNT=$(gcloud compute instance-templates list --project="$PROJECT_ID" --filter="name~gke-$CLUSTER_NAME" --format="value(name)" | wc -l)
echo "   GKE-related templates: $TEMPLATE_COUNT"

if [ "$TEMPLATE_COUNT" -gt 0 ]; then
    gcloud compute instance-templates list --project="$PROJECT_ID" --filter="name~gke-$CLUSTER_NAME" --format="table(
        name,
        properties.machineType,
        properties.disks[].initializeParams.diskSizeGb,
        properties.disks[].initializeParams.diskType
    )"
else
    print_status "WARN" "No GKE instance templates found"
fi

# 8. Try to connect to cluster
echo ""
echo "8. Cluster connectivity:"
if gcloud container clusters get-credentials "$CLUSTER_NAME" --zone="$ZONE" --project="$PROJECT_ID" &>/dev/null; then
    print_status "OK" "Successfully obtained cluster credentials"
    
    # Check cluster info
    if kubectl cluster-info &>/dev/null; then
        print_status "OK" "Cluster is accessible via kubectl"
        
        # Check node status
        echo ""
        echo "   Node status:"
        kubectl get nodes -o wide || print_status "WARN" "Could not get node status"
        
        # Check system pods
        echo ""
        echo "   System pods:"
        kubectl get pods -n kube-system | grep -E "(kube-dns|metrics-server|heapster)" || echo "   No system pods found"
        
    else
        print_status "ERROR" "Cannot connect to cluster with kubectl"
    fi
else
    print_status "ERROR" "Cannot obtain cluster credentials"
fi

# 9. Summary and recommendations
echo ""
echo "📋 SUMMARY:"
echo "=========="

# Calculate total SSD usage from disks
TOTAL_DISK_GB=$(gcloud compute disks list --project="$PROJECT_ID" --filter="zone=$ZONE" --format="value(sizeGb)" | awk '{sum+=$1} END {print sum+0}')
echo "   Total disk storage in $ZONE: ${TOTAL_DISK_GB}GB"

# Check if we need quota increase
if [ "$SSD_USAGE" -ge "$SSD_LIMIT" ]; then
    echo ""
    echo "🚨 IMMEDIATE ACTION REQUIRED:"
    echo "   1. Request SSD quota increase to 500GB minimum"
    echo "   2. Optimize disk usage by removing unused disks"
    echo "   3. Consider using pd-balanced instead of pd-ssd"
    echo ""
    echo "   Command to request quota increase:"
    echo "   gcloud compute regions set-quota us-east1 --project=$PROJECT_ID --update=SSD_TOTAL_GB=500"
fi

# Check cluster health
if [ "$CLUSTER_STATUS" = "RUNNING" ]; then
    print_status "OK" "Cluster is operational"
else
    print_status "ERROR" "Cluster status: $CLUSTER_STATUS"
fi

echo ""
echo "🔧 NEXT STEPS:"
echo "   1. Run the quota increase command if needed"
echo "   2. Clean up unused disks: gcloud compute disks list --project=$PROJECT_ID --filter='-users:*'"
echo "   3. Optimize node pool configuration"
echo "   4. Set up monitoring alerts for quota usage"
echo ""
echo "✅ Status check complete!"
```

To use this script:

1. **Save it**: Save the script as `check-cluster-status.sh`
2. **Make it executable**: `chmod +x check-cluster-status.sh`
3. **Run it**: `./check-cluster-status.sh`

The script will:
- ✅ Check if your cluster exists and its status
- ✅ Show quota usage (especially SSD storage)
- ✅ List all disks and their sizes
- ✅ Check instance templates
- ✅ Test cluster connectivity
- ✅ Provide specific recommendations based on findings

Run this script and share the output so I can help you understand exactly what's happening with your cluster.