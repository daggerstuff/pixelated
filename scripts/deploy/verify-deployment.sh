#!/bin/bash
# verify-deployment.sh
# Performs a more detailed health check on the deployed application.

set -euo pipefail

HEALTH_URL="${1:-http://localhost:4321/api/health}"

echo "🔍 Verifying deployment at ${HEALTH_URL}..."

# Wait for service to be reachable
MAX_RETRIES=5
RETRY_COUNT=0
while [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; do
    if curl -f -s "${HEALTH_URL}" > /dev/null; then
        echo "✅ Service is reachable and healthy."
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "⏳ Service not ready yet, retrying ($RETRY_COUNT/$MAX_RETRIES)..."
        sleep 5
    fi
done

if [[ $RETRY_COUNT -eq $MAX_RETRIES ]]; do
    echo "❌ Deployment verification failed: Service unreachable at ${HEALTH_URL}"
    exit 1
fi

# Optional: Add checks for subdomains if needed
# curl -f -s "https://ollama.pixelatedempathy.tech/api/health" || echo "⚠️ Ollama subdomain not reachable"

exit 0
