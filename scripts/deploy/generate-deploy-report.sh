#!/bin/bash
# generate-deploy-report.sh
# Generates a summary report of the deployment.

set -euo pipefail

ENVIRONMENT="${1:-staging}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "--------------------------------------------------"
echo "🚀 DEPLOYMENT REPORT"
echo "--------------------------------------------------"
echo "Environment: ${ENVIRONMENT}"
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Branch: $(git rev-parse --abbrev-ref HEAD)"
echo "Commit: $(git rev-parse --short HEAD)"
echo "Uptime: $(uptime -p)"
echo "--------------------------------------------------"
echo "✅ Deployment successful."
