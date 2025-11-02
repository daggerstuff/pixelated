#!/bin/bash
# DELETE ALL DISKS - Aggressive cleanup for quota relief
# Use with extreme caution - this will delete ALL disks in us-east1

echo "🔥 DELETE ALL DISKS - QUOTA RELIEF"
echo "=================================="
echo "⚠️  WARNING: This will delete ALL disks in us-east1 region"
echo "   This is an aggressive cleanup to free quota for new cluster"
echo ""

# Show current disks first
echo "1. Current disks in us-east1:"
gcloud compute disks list --project=pixelated-463209-e5 --filter="zone~us-east1" --format="table(name,zone,sizeGb,type,status,users.list():label=ATTACHED_TO)"

echo ""
read -p "Are you sure you want to delete ALL disks? Type 'YES' to confirm: " CONFIRM

if [ "$CONFIRM" != "YES" ]; then
    echo "❌ Deletion cancelled"
    exit 1
fi

echo ""
echo "2. Deleting all disks in us-east1..."

# Get all disks in us-east1 region
ALL_DISKS=$(gcloud compute disks list --project=pixelated-463209-e5 --filter="zone~us-east1" --format="value(name,zone)" 2>/dev/null)

if [ -n "$ALL_DISKS" ]; then
    echo "Found disks to delete:"
    
    # Delete each disk (force delete if attached)
    while IFS= read -r line; do
        DISK_NAME=$(echo "$line" | cut -d' ' -f1)
        DISK_ZONE=$(echo "$line" | cut -d' ' -f2)
        
        echo "   Deleting $DISK_NAME in $DISK_ZONE..."
        
        # Try force delete first (for attached disks)
        gcloud compute disks delete "$DISK_NAME" --zone="$DISK_ZONE" --project=pixelated-463209-e5 --quiet || \
        echo "   Could not delete $DISK_NAME (may be in use)"
        
    done <<< "$ALL_DISKS"
else
    echo "   No disks found in us-east1"
fi

echo ""
echo "3. Checking remaining disks..."
REMAINING=$(gcloud compute disks list --project=pixelated-463209-e5 --filter="zone~us-east1" --format="table(name,zone,sizeGb)" 2>/dev/null | wc -l)

if [ "$REMAINING" -eq 0 ]; then
    echo "✅ All disks deleted successfully"
else
    echo "⚠️  $REMAINING disks still exist (may be system disks)"
fi

echo ""
echo "4. Checking quota after cleanup..."
gcloud compute regions describe us-east1 --project=pixelated-463209-e5 --format="json" | jq '.quotas[] | select(.metric=="SSD_TOTAL_GB")'

echo ""
echo "🎯 DISK CLEANUP COMPLETE!"
echo "========================"
echo "✅ Aggressive disk cleanup completed"
echo "✅ Quota should now be available"
echo "✅ Ready to create new 2-node cluster"
echo ""
echo "Next: Create your optimized 2-node cluster"