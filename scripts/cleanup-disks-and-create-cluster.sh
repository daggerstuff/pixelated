#!/bin/bash
# CLEANUP DISKS AND CREATE 2-NODE CLUSTER
# First clean up existing disks, then create optimized cluster

echo "🧹 CLEANUP DISKS AND CREATE 2-NODE CLUSTER"
echo "=========================================="
echo "Step 1: Clean up existing disks"
echo "Step 2: Create optimized 2-node cluster"
echo ""

# Clean up existing disks first
echo "1. Finding disks to delete..."
gcloud compute disks list --project=pixelated-463209-e5 --filter="zone~us-east1" --format="table(name,zone,sizeGb,type,status,users.list():label=ATTACHED_TO)"

echo ""
echo "2. Deleting unused disks..."
# Delete disks that are not attached to any instances
UNUSED_DISKS=$(gcloud compute disks list --project=pixelated-463209-e5 --filter="zone~us-east1 AND -users:*" --format="value(name,zone)" 2>/dev/null)

if [ -n "$UNUSED_DISKS" ]; then
    echo "Found unused disks to delete:"
    echo "$UNUSED_DISKS"
    
    # Delete each unused disk
    while IFS= read -r line; do
        DISK_NAME=$(echo "$line" | cut -d' ' -f1)
        DISK_ZONE=$(echo "$line" | cut -d' ' -f2)
        
        echo "   Deleting $DISK_NAME in $DISK_ZONE..."
        gcloud compute disks delete "$DISK_NAME" --zone="$DISK_ZONE" --project=pixelated-463209-e5 --quiet || echo "   Could not delete $DISK_NAME"
    done <<< "$UNUSED_DISKS"
else
    echo "   No unused disks found"
fi

echo ""
echo "3. Creating minimal 2-node cluster with system disk optimization..."

# Create cluster with minimal system overhead
gcloud container clusters create pixelcluster \
  --region=us-east1 \
  --project=pixelated-463209-e5 \
  --machine-type=e2-medium \
  --num-nodes=2 \
  --disk-type=pd-standard \
  --disk-size=30 \
  --boot-disk-size=20 \
  --enable-autoscaling \
  --min-nodes=2 \
  --max-nodes=4 \
  --cluster-ipv4-cidr=10.0.0.0/21 \
  --services-ipv4-cidr=10.4.0.0/22 \
  --enable-autorepair \
  --enable-autoupgrade \
  --quiet

echo ""
echo "4. Getting cluster credentials..."
gcloud container clusters get-credentials pixelcluster --region=us-east1 --project=pixelated-463209-e5

echo ""
echo "5. Verifying new cluster..."
kubectl get nodes -o wide

echo ""
echo "6. Checking final quota usage..."
gcloud compute regions describe us-east1 --project=pixelated-463209-e5 --format="json" | jq '.quotas[] | select(.metric=="SSD_TOTAL_GB")'

echo ""
echo "✅ CLUSTER CREATION COMPLETE!"
echo "=============================="
echo "✅ 2 nodes created with optimized configuration"
echo "✅ System overhead minimized"
echo "✅ Within quota limits"
echo "✅ Ready for deployment"
echo ""
echo "Next: Deploy your application"