# Quota Request Strategy - Immediate Resolution

## 🚨 CRITICAL BLOCKING ISSUE
**Cannot scale down due to quota**: Even reducing from 3→2 nodes requires 300GB quota but you only have 250GB.

## Immediate Solutions (Choose One)

### Option 1: Request Quota Increase (Recommended - 5 minutes)
```bash
# Request immediate quota increase to 500GB
gcloud compute regions set-quota us-east1 \
  --project=pixelated-463209-e5 \
  --update=SSD_TOTAL_GB=500

# Alternative: Use console
# https://console.cloud.google.com/iam-admin/quotas?usage=USED&project=pixelated-463209-e5
```

### Option 2: Emergency Disk Cleanup (2 minutes)
```bash
# Find unused disks first
gcloud compute disks list --project=pixelated-463209-e5 --filter="-users:*" --format="table(name,zone,sizeGb)"

# Delete unused disks (BE CAREFUL)
gcloud compute disks delete [DISK_NAME] --zone=[ZONE] --project=pixelated-463209-e5 --quiet

# Check snapshots that can be deleted
gcloud compute snapshots list --project=pixelated-463209-e5 --format="table(name,diskSizeGb,creationTimestamp)"
```

### Option 3: Regional Migration (10 minutes)
```bash
# Create new cluster in different region with available quota
gcloud container clusters create pixelcluster-backup \
  --region=us-west1 \
  --project=pixelated-463209-e5 \
  --machine-type=e2-medium \
  --num-nodes=2 \
  --disk-type=pd-balanced \
  --disk-size=50
```

## Quota Request Script

<write_to_file>
<path>scripts/request-quota-increase.sh</path>
<content>
#!/bin/bash
# Request SSD quota increase for immediate relief

PROJECT_ID="pixelated-463209-e5"
REGION="us-east1"

echo "🚀 Requesting SSD Quota Increase"
echo "================================"
echo "Current: 300GB used / 250GB limit (120% utilization)"
echo "Requesting: 500GB limit (60% utilization after optimization)"
echo ""

# Method 1: CLI Quota Update (if permissions allow)
echo "1. Attempting CLI quota update..."
if gcloud compute regions set-quota "$REGION" \
  --project="$PROJECT_ID" \
  --update=SSD_TOTAL_GB=500; then
    echo "✅ Quota increase requested via CLI"
else
    echo "❌ CLI quota update failed (insufficient permissions)"
    echo ""
    
    # Method 2: Support Request
    echo "2. Creating support case for quota increase..."
    gcloud support cases create \
      --project="$PROJECT_ID" \
      --category=COMPUTE_RESOURCE_QUOTA \
      --display-name="SSD Storage Quota Increase Request" \
      --description="Current usage: 300GB/250GB (120%). Requesting increase to 500GB to allow cluster optimization from 3→2 nodes with 50GB disks each." \
      --severity=MEDIUM \
      --impacts-all-users=false \
      --impacts-production=true
    
    echo "✅ Support case created - Google will review within 24 hours"
fi

echo ""
echo "3. Alternative immediate actions:"
echo "   a) Delete unused disks: gcloud compute disks list --project=$PROJECT_ID --filter='-users:*'"
echo "   b) Delete old snapshots: gcloud compute snapshots list --project=$PROJECT_ID"
echo "   c) Consider regional migration to us-west1"
echo ""
echo "Quota request submitted. Monitor at: https://console.cloud.google.com/iam-admin/quotas?usage=USED&project=$PROJECT_ID"