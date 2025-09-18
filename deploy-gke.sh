#!/bin/bash
set -e

# GKE Deployment Script for Pixelated Empathy
# Usage: ./deploy-gke.sh [image-tag]

IMAGE_TAG=${1:-latest}
CONTAINER_IMAGE="registry.gitlab.com/pixeldeck/pixelated:${IMAGE_TAG}"

echo "🚀 Deploying Pixelated to GKE..."
echo "Image: $CONTAINER_IMAGE"

# Apply/update deployment
kubectl apply -f k8s-deployment.yaml

# Update image
kubectl set image deployment/pixelated pixelated=$CONTAINER_IMAGE

# Wait for rollout
echo "⏳ Waiting for deployment rollout..."
kubectl rollout status deployment/pixelated --timeout=600s

# Get service info
echo "📊 Deployment Status:"
kubectl get pods -l app=pixelated
kubectl get services pixelated-service

# Health check
echo "🔍 Running health check..."
EXTERNAL_IP=$(kubectl get service pixelated-service -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")

if [ -n "$EXTERNAL_IP" ] && [ "$EXTERNAL_IP" != "<pending>" ]; then
    echo "🌐 Service available at: http://$EXTERNAL_IP"
    
    for i in {1..10}; do
        if curl -f http://$EXTERNAL_IP/ --connect-timeout 10 --max-time 30 > /dev/null 2>&1; then
            echo "✅ Health check passed!"
            exit 0
        fi
        echo "Attempt $i failed, retrying in 10s..."
        sleep 10
    done
    echo "⚠️  Health check failed after 10 attempts"
else
    echo "⚠️  External IP not yet available"
fi

echo "✅ Deployment completed"