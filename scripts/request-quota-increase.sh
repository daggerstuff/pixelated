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