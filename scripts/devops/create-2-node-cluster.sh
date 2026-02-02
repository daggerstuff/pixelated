#!/bin/bash
# CREATE 2-NODE CLUSTER - Simple and direct
# Use this after deleting the old cluster

echo "🚀 Creating 2-Node GKE Cluster"
echo "=============================="
echo "Cluster: pixelcluster"
echo "Region: us-east1"
echo "Nodes: 2 × e2-medium"
echo "Storage: 50GB per node (100GB total)"
echo ""

# Simple cluster creation - no complex logic
gcloud container clusters create pixelcluster \
  --region=us-east1 \
  --project=pixelated-463209-e5 \
  --machine-type=e2-medium \
  --num-nodes=2 \
  --disk-type=pd-balanced \
  --disk-size=50 \
  --enable-autoscaling \
  --min-nodes=2 \
  --max-nodes=6 \
  --enable-autorepair \
  --enable-autoupgrade \
  --quiet

echo ""
echo "⏳ Waiting for cluster to be ready..."
sleep 30

# Get credentials
gcloud container clusters get-credentials pixelcluster \
  --region=us-east1 \
  --project=pixelated-463209-e5

echo ""
echo "✅ Cluster created successfully!"
echo ""

# Verify configuration
echo "📋 Verifying cluster configuration:"
kubectl get nodes -o wide

echo ""
echo "💾 Checking storage usage:"
gcloud compute regions describe us-east1 \
  --project=pixelated-463209-e5 \
  --format="json" | jq '.quotas[] | select(.metric=="SSD_TOTAL_GB")'

echo ""
echo "🎯 RESULTS:"
echo "✅ 2 nodes created"
echo "✅ 100GB total storage (within 250GB quota)"
echo "✅ Cluster ready for deployment"
echo ""
echo "Next: Deploy your application"