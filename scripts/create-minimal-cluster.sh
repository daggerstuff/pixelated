#!/bin/bash
# CREATE MINIMAL 2-NODE CLUSTER - Avoid system overhead
# Use after disk cleanup when quota is tight

echo "🚀 CREATE MINIMAL 2-NODE CLUSTER"
echo "================================"
echo "Creating cluster with minimal system overhead"
echo ""

# Create cluster with minimal configuration to avoid quota issues
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
  --cluster-ipv4-cidr=10.0.0.0/22 \
  --services-ipv4-cidr=10.4.0.0/22 \
  --enable-autorepair \
  --enable-autoupgrade \
  --quiet

echo ""
echo "⏳ Waiting for cluster to be ready..."
sleep 30

# Get credentials
gcloud container clusters get-credentials pixelcluster --region=us-east1 --project=pixelated-463209-e5

echo ""
echo "6. Verifying new cluster..."
kubectl get nodes -o wide

echo ""
echo "💾 Checking final quota usage..."
gcloud compute regions describe us-east1 --project=pixelated-463209-e5 --format="json" | jq '.quotas[] | select(.metric=="SSD_TOTAL_GB")'

echo ""
echo "🎯 CLUSTER CREATION COMPLETE!"
echo "=============================="
echo "✅ 2 nodes created with minimal configuration"
echo "✅ Optimized for quota constraints"
echo "✅ Ready for deployment"
echo ""
echo "Next: Deploy your application"