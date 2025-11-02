#!/bin/bash
set -euo pipefail

echo "🔄 Initiating deployment rollback..."

# Configuration
ROLLBACK_TIMEOUT=${ROLLBACK_TIMEOUT:-300}
ROLLBACK_REVISION=${ROLLBACK_REVISION:-}
NOTIFICATION_ENABLED=${NOTIFICATION_ENABLED:-true}

# Get current deployment info
CURRENT_REVISION=$(kubectl rollout history deployment/$GKE_DEPLOYMENT_NAME | tail -2 | head -1 | awk '{print $1}')
echo "📋 Current deployment revision: $CURRENT_REVISION"

# Determine rollback target
if [ -n "$ROLLBACK_REVISION" ]; then
    echo "🎯 Rolling back to specific revision: $ROLLBACK_REVISION"
    ROLLBACK_TARGET=$ROLLBACK_REVISION
else
    echo "🎯 Rolling back to previous revision"
    ROLLBACK_TARGET="previous"
fi

# Perform rollback
echo "🔄 Executing rollback..."
if kubectl rollout undo deployment/$GKE_DEPLOYMENT_NAME --to-revision=$ROLLBACK_TARGET; then
    echo "✅ Rollback command executed successfully"
else
    echo "❌ Rollback command failed"
    exit 1
fi

# Wait for rollback to complete
echo "⏳ Waiting for rollback to complete (timeout: ${ROLLBACK_TIMEOUT}s)..."
if kubectl rollout status deployment/$GKE_DEPLOYMENT_NAME --timeout=${ROLLBACK_TIMEOUT}s; then
    echo "✅ Rollback completed successfully"
    
    # Verify rollback
    NEW_REVISION=$(kubectl rollout history deployment/$GKE_DEPLOYMENT_NAME | tail -2 | head -1 | awk '{print $1}')
    echo "📋 New deployment revision: $NEW_REVISION"
    
    # Run health checks after rollback
    echo "🔍 Running post-rollback health checks..."
    if . ./scripts/health-check-comprehensive.sh; then
        echo "✅ Post-rollback health checks passed"
        
        # Send rollback notification
        if [ "$NOTIFICATION_ENABLED" = "true" ] && [ -n "$SLACK_WEBHOOK_URL" ]; then
            . ./scripts/notify-rollback.sh
        fi
        
        return 0
    else
        echo "❌ Post-rollback health checks failed"
        echo "🚨 Manual intervention required"
        return 1
    fi
else
    echo "❌ Rollback timed out or failed"
    echo "📊 Rollback status:"
    kubectl describe deployment $GKE_DEPLOYMENT_NAME
    kubectl get events --sort-by=.metadata.creationTimestamp | tail -10
    
    # Emergency rollback to known good state
    echo "🚨 Attempting emergency rollback..."
    if [ "$ROLLBACK_TARGET" != "1" ]; then
        echo "🔄 Rolling back to revision 1 (emergency)"
        if kubectl rollout undo deployment/$GKE_DEPLOYMENT_NAME --to-revision=1; then
            kubectl rollout status deployment/$GKE_DEPLOYMENT_NAME --timeout=180s
            echo "✅ Emergency rollback completed"
            return 0
        fi
    fi
    
    return 1
fi