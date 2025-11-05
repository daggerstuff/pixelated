#!/bin/bash
# SHUTDOWN GKE CLUSTER - Complete cluster deletion
# This script will permanently delete your GKE cluster to stop all costs

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ID="pixelated-463209-e5"
CLUSTER_NAME="pixelated-empathy-prod"
LOCATION="us-central1-c"  # Zone (not region) for this cluster

echo -e "${BLUE}GKE CLUSTER SHUTDOWN${NC}"
echo "================================"
echo ""
echo -e "${YELLOW}WARNING: This will permanently delete your GKE cluster${NC}"
echo "   This action cannot be undone!"
echo ""
echo "Cluster Details:"
echo "  - Name: $CLUSTER_NAME"
echo "  - Location: $LOCATION"
echo "  - Project: $PROJECT_ID"
echo ""

# Function to print status
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "OK" ]; then
        echo -e "${GREEN}[OK] $message${NC}"
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}[WARN] $message${NC}"
    else
        echo -e "${RED}[ERROR] $message${NC}"
    fi
}

# Check if gcloud is available
if ! command -v gcloud &> /dev/null; then
    print_status "ERROR" "gcloud CLI not found. Please install it first."
    echo "   Install: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if authenticated
echo "1. Checking authentication..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    print_status "ERROR" "Not authenticated to GCP"
    echo "   Run: gcloud auth login"
    exit 1
fi
print_status "OK" "Authenticated to GCP"

# Set project
echo ""
echo "2. Setting GCP project..."
gcloud config set project "$PROJECT_ID" --quiet
print_status "OK" "Project set to $PROJECT_ID"

# Check if cluster exists (try zone first, then region)
echo ""
echo "3. Checking cluster status..."

# Try zone first (us-central1-c is a zone)
if gcloud container clusters describe "$CLUSTER_NAME" --zone="$LOCATION" --project="$PROJECT_ID" &>/dev/null 2>&1; then
    CLUSTER_LOCATION_TYPE="zone"
    CLUSTER_LOCATION="$LOCATION"
elif gcloud container clusters describe "$CLUSTER_NAME" --region="$LOCATION" --project="$PROJECT_ID" &>/dev/null 2>&1; then
    CLUSTER_LOCATION_TYPE="region"
    CLUSTER_LOCATION="$LOCATION"
else
    print_status "WARN" "Cluster '$CLUSTER_NAME' not found in location '$LOCATION'"
    echo "   The cluster may already be deleted or doesn't exist."
    
    # List all clusters to see what exists
    echo ""
    echo "   Existing clusters in project:"
    gcloud container clusters list --project="$PROJECT_ID" --format="table(name,location,status,currentNodeCount)" || echo "   No clusters found"
    exit 0
fi

# Get cluster info
if [ "$CLUSTER_LOCATION_TYPE" = "zone" ]; then
    CLUSTER_STATUS=$(gcloud container clusters describe "$CLUSTER_NAME" --zone="$CLUSTER_LOCATION" --project="$PROJECT_ID" --format="value(status)" 2>/dev/null || echo "UNKNOWN")
    NODE_COUNT=$(gcloud container clusters describe "$CLUSTER_NAME" --zone="$CLUSTER_LOCATION" --project="$PROJECT_ID" --format="value(currentNodeCount)" 2>/dev/null || echo "0")
else
    CLUSTER_STATUS=$(gcloud container clusters describe "$CLUSTER_NAME" --region="$CLUSTER_LOCATION" --project="$PROJECT_ID" --format="value(status)" 2>/dev/null || echo "UNKNOWN")
    NODE_COUNT=$(gcloud container clusters describe "$CLUSTER_NAME" --region="$CLUSTER_LOCATION" --project="$PROJECT_ID" --format="value(currentNodeCount)" 2>/dev/null || echo "0")
fi

echo "   Status: $CLUSTER_STATUS"
echo "   Nodes: $NODE_COUNT"
print_status "OK" "Cluster found"

# Final confirmation
echo ""
echo ""
echo ""
echo -e "${RED}This will delete:${NC}"
echo "   - All running pods and services"
echo "   - All persistent data and volumes"
echo "   - All cluster configurations"
echo "   - All node pools and compute resources"
echo ""
echo -e "${YELLOW}This action is IRREVERSIBLE!${NC}"
echo ""
read -p "Type 'DELETE' to confirm cluster deletion: " CONFIRM

if [ "$CONFIRM" != "DELETE" ]; then
    print_status "WARN" "Deletion cancelled"
    exit 0
fi

print_status "OK" "Deletion confirmed"

# Delete the cluster
echo ""
echo "4. Deleting cluster..."
echo "   This will take 5-15 minutes..."
echo ""

# Delete cluster using appropriate location flag
if [ "$CLUSTER_LOCATION_TYPE" = "zone" ]; then
    DELETE_CMD="gcloud container clusters delete \"$CLUSTER_NAME\" --zone=\"$CLUSTER_LOCATION\" --project=\"$PROJECT_ID\" --quiet"
else
    DELETE_CMD="gcloud container clusters delete \"$CLUSTER_NAME\" --region=\"$CLUSTER_LOCATION\" --project=\"$PROJECT_ID\" --quiet"
fi

if eval "$DELETE_CMD"; then
    print_status "OK" "Cluster deletion initiated"
else
    print_status "ERROR" "Failed to delete cluster"
    echo ""
    echo "   Troubleshooting:"
    echo "   1. Check if you have the necessary permissions"
    echo "   2. Verify cluster name and region are correct"
    echo "   3. Try manual deletion:"
    if [ "$CLUSTER_LOCATION_TYPE" = "zone" ]; then
        echo "      gcloud container clusters delete $CLUSTER_NAME --zone=$CLUSTER_LOCATION --project=$PROJECT_ID"
    else
        echo "      gcloud container clusters delete $CLUSTER_NAME --region=$CLUSTER_LOCATION --project=$PROJECT_ID"
    fi
    exit 1
fi

# Wait for deletion to complete
echo ""
echo "5. Waiting for deletion to complete..."
MAX_WAIT=900  # 15 minutes
ELAPSED=0
POLL_INTERVAL=30

while [ "$ELAPSED" -lt "$MAX_WAIT" ]; do
    if [ "$CLUSTER_LOCATION_TYPE" = "zone" ]; then
        CHECK_CMD="gcloud container clusters describe \"$CLUSTER_NAME\" --zone=\"$CLUSTER_LOCATION\" --project=\"$PROJECT_ID\""
    else
        CHECK_CMD="gcloud container clusters describe \"$CLUSTER_NAME\" --region=\"$CLUSTER_LOCATION\" --project=\"$PROJECT_ID\""
    fi
    
    if [ "$CLUSTER_LOCATION_TYPE" = "zone" ]; then
        if ! gcloud container clusters describe "$CLUSTER_NAME" --zone="$CLUSTER_LOCATION" --project="$PROJECT_ID" &>/dev/null 2>&1; then
            print_status "OK" "Cluster successfully deleted"
            break
        fi
    else
        if ! gcloud container clusters describe "$CLUSTER_NAME" --region="$CLUSTER_LOCATION" --project="$PROJECT_ID" &>/dev/null 2>&1; then
            print_status "OK" "Cluster successfully deleted"
            break
        fi
    fi
    echo "   Still deleting... ${ELAPSED}s / ${MAX_WAIT}s"
    sleep "$POLL_INTERVAL"
    ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    print_status "WARN" "Deletion may still be in progress - timeout reached"
    echo "   Check status manually:"
    echo "   gcloud container clusters list --project=$PROJECT_ID"
else
    print_status "OK" "Cluster deletion completed"
fi

# Clean up associated resources
echo ""
echo "6. Checking for orphaned resources..."

# List remaining disks
echo "   Checking for orphaned disks..."
ORPHANED_DISKS=$(gcloud compute disks list --project="$PROJECT_ID" --filter="name~gke-$CLUSTER_NAME OR name~$CLUSTER_NAME" --format="value(name,zone)" 2>/dev/null || echo "")

if [ -n "$ORPHANED_DISKS" ]; then
    print_status "WARN" "Found orphaned disks - these should be cleaned up automatically"
    echo "$ORPHANED_DISKS" | while read -r disk_info; do
        echo "     - $disk_info"
    done
    echo "   Note: GKE disks are usually auto-deleted, but check your billing if needed"
else
    print_status "OK" "No orphaned disks found"
fi

# Summary
echo ""
print_status "OK" "Shutdown complete - billing will stop"
echo ""
print_status "OK" "Shutdown complete"
echo ""
echo "Next Steps:"
echo "   1. Disable GitHub Actions workflow to prevent re-deployment"
echo "   2. Verify billing has stopped - check GCP Console"
echo "   3. Monitor for any orphaned resources"
echo ""
echo "To disable GitHub Actions:"
echo "   Edit .github/workflows/gke-deploy.yml and disable the deploy-gke job"

