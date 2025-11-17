#!/bin/bash

# Kubernetes Health Monitoring Script
# Monitors pods, events, and health endpoints after readiness probe fixes

set -e

NAMESPACE="pixelated-prod"
DEPLOYMENT_NAME="pixelated-app"

echo "🏥 Kubernetes Health Monitor"
echo "=========================="

# Function to check pod health
check_pod_health() {
    echo "📊 Pod Status:"
    kubectl get pods -n "$NAMESPACE" -l app=pixelated -o wide
    echo ""
    
    echo "🔍 Pod Events (last 10):"
    kubectl get events -n "$NAMESPACE" --field-selector involvedObject.kind=Pod --sort-by='.lastTimestamp' | tail -10
    echo ""
}

# Function to check health endpoints
check_health_endpoints() {
    echo "🌐 Testing Health Endpoints:"
    
    # Get service endpoint
    SERVICE_IP=$(kubectl get svc -n "$NAMESPACE" pixelated-service -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "unknown")
    
    if [ "$SERVICE_IP" != "unknown" ]; then
        echo "Service IP: $SERVICE_IP"
        
        # Test using kubectl port-forward in background
        echo "Testing /api/health endpoint..."
        kubectl port-forward -n "$NAMESPACE" svc/pixelated-service 8080:80 &
        PF_PID=$!
        sleep 2
        
        if curl -s -f http://localhost:8080/api/health > /dev/null 2>&1; then
            echo "✅ /api/health - OK"
        else
            echo "❌ /api/health - FAILED"
        fi
        
        if curl -s -f http://localhost:8080/api/health/simple > /dev/null 2>&1; then
            echo "✅ /api/health/simple - OK"
        else
            echo "❌ /api/health/simple - FAILED"
        fi
        
        # Clean up port-forward
        kill $PF_PID 2>/dev/null || true
    else
        echo "❌ Could not determine service IP"
    fi
    echo ""
}

# Function to show deployment status
check_deployment_status() {
    echo "🚀 Deployment Status:"
    kubectl get deployment -n "$NAMESPACE" "$DEPLOYMENT_NAME" -o wide
    echo ""
    
    echo "📈 Replica Set Status:"
    kubectl get rs -n "$NAMESPACE" -l app=pixelated
    echo ""
}

# Function to show recent events
show_recent_events() {
    echo "📋 Recent Events (last 15):"
    kubectl get events -n "$NAMESPACE" --sort-by='.lastTimestamp' | tail -15
    echo ""
}

# Function to show resource usage
show_resource_usage() {
    echo "💾 Resource Usage:"
    kubectl top pods -n "$NAMESPACE" -l app=pixelated 2>/dev/null || echo "Metrics server not available"
    echo ""
}

# Main monitoring loop
monitor_health() {
    while true; do
        clear
        echo "🏥 Kubernetes Health Monitor - $(date)"
        echo "========================================="
        
        check_deployment_status
        check_pod_health
        show_recent_events
        show_resource_usage
        check_health_endpoints
        
        echo "Press Ctrl+C to exit, or wait 30 seconds for refresh..."
        sleep 30
    done
}

# Check if continuous monitoring is requested
if [ "$1" = "--monitor" ] || [ "$1" = "-m" ]; then
    monitor_health
else
    # Single check
    check_deployment_status
    check_pod_health
    show_recent_events
    show_resource_usage
    check_health_endpoints
    
    echo "💡 Tip: Run with --monitor for continuous monitoring"
fi