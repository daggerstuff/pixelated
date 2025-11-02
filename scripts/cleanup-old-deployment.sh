#!/bin/bash
set -e

echo "🧹 Cleaning up old deployment resources"
echo "========================================"
echo ""
echo "This will delete the old 'pixelated-app' deployment and update the service"
echo ""

read -p "Are you sure you want to delete the old deployment? (y/N): " confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "Deleting old deployment..."
kubectl delete deployment pixelated-app -n pixelated || echo "Deployment already deleted"

echo ""
echo "Deleting old service (Flux will recreate the correct one)..."
kubectl delete service pixelated-service -n pixelated || echo "Service already deleted"

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Flux will now apply the correct configuration from the repo."
echo "Monitor with: kubectl get all -n pixelated -w"

