#!/bin/bash
# FIND QUOTA CONSUMERS - Comprehensive investigation
# Find exactly what's eating your 250GB quota

echo "🔍 FINDING QUOTA CONSUMERS - COMPREHENSIVE SEARCH"
echo "================================================="
echo "Current quota: 300GB used / 250GB limit"
echo "Finding what's consuming quota..."
echo ""

# 1. Check ALL resources in the project
echo "1. ALL COMPUTE RESOURCES:"
echo "========================="
gcloud compute instances list --project=pixelated-463209-e5 --format="table(name,zone,machineType,status,disks[].source,disks[].deviceName,disks[].diskSizeGb)" 2>/dev/null || echo "No instances found"

echo ""
echo "2. ALL DISKS BY ZONE:"
echo "====================="
for zone in us-east1-a us-east1-b us-east1-c us-east1-d; do
    echo "=== ZONE: $zone ==="
    gcloud compute disks list --project=pixelated-463209-e5 --zone="$zone" --format="table(name,sizeGb,type,status,users.list():label=ATTACHED_TO)" 2>/dev/null || echo "No disks in $zone"
done

echo ""
echo "3. SNAPSHOTS (can consume quota):"
echo "================================="
gcloud compute snapshots list --project=pixelated-463209-e5 --format="table(name,diskSizeGb,creationTimestamp,status)" 2>/dev/null || echo "No snapshots found"

echo ""
echo "4. INSTANCE TEMPLATES:"
echo "======================"
gcloud compute instance-templates list --project=pixelated-463209-e5 --format="table(name,properties.disks[].initializeParams.diskSizeGb,properties.disks[].initializeParams.diskType)" 2>/dev/null || echo "No instance templates found"

echo ""
echo "5. REGIONAL RESOURCES:"
echo "======================"
gcloud compute regions describe us-east1 --project=pixelated-463209-e5 --format="json" | jq '.quotas[] | {metric: .metric, limit: .limit, usage: .usage}'

echo ""
echo "6. GKE SPECIFIC RESOURCES:"
echo "=========================="
# Check if there are any GKE-related resources
gcloud container clusters list --project=pixelated-463209-e5 --format="table(name,location,currentNodeCount,currentMasterVersion)" 2>/dev/null || echo "No GKE clusters found"

echo ""
echo "7. DETAILED DISK ANALYSIS:"
echo "=========================="
echo "Total disk usage by zone:"
for zone in us-east1-a us-east1-b us-east1-c us-east1-d; do
    TOTAL=$(gcloud compute disks list --project=pixelated-463209-e5 --zone="$zone" --format="value(sizeGb)" 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
    echo "  $zone: ${TOTAL}GB"
done

echo ""
echo "8. SYSTEM DISKS (often hidden):"
echo "=============================="
# Look for system disks that might not show up in regular listings
for zone in us-east1-a us-east1-b us-east1-c us-east1-d; do
    echo "=== SYSTEM DISKS IN $zone ==="
    gcloud compute disks list --project=pixelated-463209-e5 --zone="$zone" --filter="name~gke" --format="table(name,sizeGb,type,status)" 2>/dev/null || echo "No GKE system disks in $zone"
done

echo ""
echo "9. UNATTACHED DISKS:"
echo "==================="
for zone in us-east1-a us-east1-b us-east1-c us-east1-d; do
    echo "=== UNATTACHED IN $zone ==="
    gcloud compute disks list --project=pixelated-463209-e5 --zone="$zone" --filter="-users:*" --format="table(name,sizeGb,type)" 2>/dev/null || echo "No unattached disks in $zone"
done

echo ""
echo "🔍 QUOTA ANALYSIS COMPLETE!"
echo "============================"
echo "Check the output above to find what's consuming your quota."
echo "Look for:"
echo "- Large disks (especially 100GB+)"
echo "- GKE system disks"
echo "- Unattached disks"
echo "- Instance templates with large disks"
echo ""
echo "Next: Delete the problematic resources, then create your cluster."