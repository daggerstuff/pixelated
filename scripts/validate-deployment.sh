#!/bin/bash
set -euo pipefail

DEPLOYMENT_NAME=$1

echo "🔍 Validating deployment: $DEPLOYMENT_NAME"

# Configuration
VALIDATION_TIMEOUT=${VALIDATION_TIMEOUT:-300}
VALIDATION_INTERVAL=${VALIDATION_INTERVAL:-10}
MAX_RETRIES=$((VALIDATION_TIMEOUT / VALIDATION_INTERVAL))

# Validation functions
check_deployment_status() {
    echo "🔍 Checking deployment status..."
    
    if ! kubectl get deployment $DEPLOYMENT_NAME >/dev/null 2>&1; then
        echo "❌ Deployment $DEPLOYMENT_NAME not found"
        return 1
    fi
    
    # Check if deployment is available
    AVAILABLE=$(kubectl get deployment $DEPLOYMENT_NAME -o json | jq '.status.conditions[] | select(.type == "Available") | .status')
    if [ "$AVAILABLE" != "True" ]; then
        echo "❌ Deployment $DEPLOYMENT_NAME is not available"
        return 1
    fi
    
    # Check if deployment is progressing
    PROGRESSING=$(kubectl get deployment $DEPLOYMENT_NAME -o json | jq '.status.conditions[] | select(.type == "Progressing") | .status')
    if [ "$PROGRESSING" != "True" ]; then
        echo "⚠️ Deployment $DEPLOYMENT_NAME is still progressing"
        return 1
    fi
    
    echo "✅ Deployment $DEPLOYMENT_NAME status is healthy"
    return 0
}

check_pod_readiness() {
    echo "🔍 Checking pod readiness..."
    
    # Get deployment pods
    PODS=$(kubectl get pods -l app=pixelated -l deployment-tier=${DEPLOYMENT_NAME##*-} -o json | jq -r '.items[].metadata.name')
    
    if [ -z "$PODS" ]; then
        echo "❌ No pods found for deployment $DEPLOYMENT_NAME"
        return 1
    fi
    
    READY_COUNT=0
    TOTAL_COUNT=0
    
    for pod in $PODS; do
        TOTAL_COUNT=$((TOTAL_COUNT + 1))
        
        # Check if pod is ready
        READY=$(kubectl get pod $pod -o json | jq '.status.containerStatuses[]?.ready // false')
        if [ "$READY" = "true" ]; then
            READY_COUNT=$((READY_COUNT + 1))
        fi
    done
    
    echo "📊 Pod readiness: $READY_COUNT/$TOTAL_COUNT pods ready"
    
    if [ $READY_COUNT -eq 0 ]; then
        echo "❌ No pods are ready"
        return 1
    fi
    
    if [ $READY_COUNT -lt $TOTAL_COUNT ]; then
        echo "⚠️ Some pods are not ready"
        return 1
    fi
    
    echo "✅ All pods are ready"
    return 0
}

check_resource_limits() {
    echo "🔍 Checking resource usage..."
    
    # Get deployment pods
    PODS=$(kubectl get pods -l app=pixelated -l deployment-tier=${DEPLOYMENT_NAME##*-} -o json | jq -r '.items[].metadata.name')
    
    if [ -z "$PODS" ]; then
        echo "❌ No pods found for resource check"
        return 1
    fi
    
    # Check resource usage for each pod
    for pod in $PODS; do
        echo "🔍 Checking resources for pod: $pod"
        
        # Get resource usage (if metrics server is available)
        if kubectl top pod $pod >/dev/null 2>&1; then
            CPU_USAGE=$(kubectl top pod $pod --no-headers | awk '{print $2}' | sed 's/m//')
            MEMORY_USAGE=$(kubectl top pod $pod --no-headers | awk '{print $3}' | sed 's/Mi//')
            
            echo "📊 Pod $pod: CPU=${CPU_USAGE}m, Memory=${MEMORY_USAGE}Mi"
            
            # Check if usage is within reasonable limits (80% of limits)
            if [ "${CPU_USAGE:-0}" -gt 1600 ]; then
                echo "⚠️ Pod $pod CPU usage is high: ${CPU_USAGE}m"
            fi
            
            if [ "${MEMORY_USAGE:-0}" -gt 1600 ]; then
                echo "⚠️ Pod $pod Memory usage is high: ${MEMORY_USAGE}Mi"
            fi
        else
            echo "ℹ️ Metrics server not available, skipping resource usage check"
        fi
    done
    
    echo "✅ Resource validation completed"
    return 0
}

check_service_connectivity() {
    echo "🔍 Checking service connectivity..."
    
    # Get service for deployment
    SERVICE_NAME="${DEPLOYMENT_NAME}-service"
    
    if ! kubectl get service $SERVICE_NAME >/dev/null 2>&1; then
        echo "⚠️ Service $SERVICE_NAME not found, skipping connectivity check"
        return 0
    fi
    
    SERVICE_IP=$(kubectl get service $SERVICE_NAME -o json | jq -r '.spec.clusterIP')
    
    if [ -z "$SERVICE_IP" ] || [ "$SERVICE_IP" = "null" ]; then
        echo "❌ Service $SERVICE_NAME has no cluster IP"
        return 1
    fi
    
    # Check if service has endpoints
    ENDPOINTS=$(kubectl get endpoints $SERVICE_NAME -o json | jq '.subsets[]?.addresses | length')
    if [ "$ENDPOINTS" -eq 0 ]; then
        echo "❌ Service $SERVICE_NAME has no healthy endpoints"
        return 1
    fi
    
    echo "✅ Service $SERVICE_NAME has $ENDPOINTS healthy endpoints"
    
    # Test application health endpoint
    if kubectl run health-check-${DEPLOYMENT_NAME##*-} --image=curlimages/curl:latest --rm -i --restart=Never -- \
       curl -f --connect-timeout 10 --max-time 30 "http://$SERVICE_IP:80/api/health" >/dev/null 2>&1; then
        echo "✅ Application health check passed for $DEPLOYMENT_NAME"
        return 0
    else
        echo "❌ Application health check failed for $DEPLOYMENT_NAME"
        return 1
    fi
}

check_log_errors() {
    echo "🔍 Checking for recent errors in logs..."
    
    # Get deployment pods
    PODS=$(kubectl get pods -l app=pixelated -l deployment-tier=${DEPLOYMENT_NAME##*-} -o json | jq -r '.items[].metadata.name')
    
    if [ -z "$PODS" ]; then
        echo "❌ No pods found for log check"
        return 1
    fi
    
    ERROR_COUNT=0
    
    for pod in $PODS; do
        # Check recent logs for errors (last 50 lines)
        RECENT_ERRORS=$(kubectl logs $pod --tail=50 2>/dev/null | grep -i "error\|exception\|fatal" | wc -l)
        
        if [ $RECENT_ERRORS -gt 0 ]; then
            echo "⚠️ Pod $pod has $RECENT_ERRORS recent errors in logs"
            ERROR_COUNT=$((ERROR_COUNT + RECENT_ERRORS))
            
            # Show first few error lines
            kubectl logs $pod --tail=20 2>/dev/null | grep -i "error\|exception\|fatal" | head -3
        fi
    done
    
    if [ $ERROR_COUNT -gt 5 ]; then
        echo "❌ Too many recent errors in logs ($ERROR_COUNT errors)"
        return 1
    fi
    
    echo "✅ Log validation completed (found $ERROR_COUNT errors)"
    return 0
}

# Main validation loop
echo "🔄 Starting deployment validation (timeout: ${VALIDATION_TIMEOUT}s)..."

RETRY_COUNT=0
SUCCESS_COUNT=0
SUCCESS_THRESHOLD=2

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "🔍 Validation attempt $((RETRY_COUNT + 1))/$MAX_RETRIES"
    
    # Run all validation checks
    FAILED_CHECKS=0
    
    check_deployment_status || FAILED_CHECKS=$((FAILED_CHECKS + 1))
    check_pod_readiness || FAILED_CHECKS=$((FAILED_CHECKS + 1))
    check_resource_limits || FAILED_CHECKS=$((FAILED_CHECKS + 1))
    check_service_connectivity || FAILED_CHECKS=$((FAILED_CHECKS + 1))
    check_log_errors || FAILED_CHECKS=$((FAILED_CHECKS + 1))
    
    if [ $FAILED_CHECKS -eq 0 ]; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        echo "✅ All validation checks passed (consecutive successes: $SUCCESS_COUNT/$SUCCESS_THRESHOLD)"
        
        if [ $SUCCESS_COUNT -ge $SUCCESS_THRESHOLD ]; then
            echo "🎉 Deployment validation completed successfully!"
            return 0
        fi
    else
        SUCCESS_COUNT=0
        echo "❌ $FAILED_CHECKS validation checks failed"
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        echo "⏳ Waiting ${VALIDATION_INTERVAL}s before next attempt..."
        sleep $VALIDATION_INTERVAL
    fi
done

echo "❌ Deployment validation failed after $MAX_RETRIES attempts"
echo "📊 Final deployment status:"
kubectl describe deployment $DEPLOYMENT_NAME
kubectl get events --field-selector type=Warning --sort-by=.metadata.creationTimestamp | tail -5

return 1