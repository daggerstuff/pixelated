#!/bin/bash

# Health check script for the Bias Detection Service

SERVICE_HOST=${BIAS_SERVICE_HOST:-127.0.0.1}
SERVICE_PORT=${BIAS_SERVICE_PORT:-5001}
HEALTH_ENDPOINT="/health"

HEALTH_URL="http://${SERVICE_HOST}:${SERVICE_PORT}${HEALTH_ENDPOINT}"

# Use curl to check the health endpoint
# -s: Silent mode
# -f: Fail silently on HTTP errors (4xx or 5xx)
# -o /dev/null: Discard output
# -w "%{http_code}": Print HTTP status code
HTTP_CODE=$(curl -s -f -o /dev/null -w "%{http_code}" "${HEALTH_URL}")

if [[ ${HTTP_CODE} -eq 200 ]]; then
	echo "Bias Detection Service is healthy (HTTP 200 OK)"
	exit 0
else
	echo "Bias Detection Service is unhealthy (HTTP ${HTTP_CODE}) or not reachable."
	exit 1
fi
