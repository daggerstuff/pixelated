#!/usr/bin/env bash
# ==============================================================================
# deploy-cloudrun.sh
#
# Deploys a containerized service to Google Cloud Run with strict cost guardrails.
#
# Guardrails:
#   - min-instances: 0 (Scale to zero when idle = $0 idle cost)
#   - max-instances: 2 (Prevents accidental traffic spikes from burning credits)
#   - memory: 512Mi (Lean footprint)
#   - cpu: 1
#   - region: us-central1 (co-located with GCE VM 'herm' and MongoDB Atlas)
# ==============================================================================

set -euo pipefail

SERVICE_NAME="${1:-}"
IMAGE_TAG="${2:-latest}"

if [ -z "${SERVICE_NAME}" ]; then
    echo "Usage: $0 <service-name> [image-tag]"
    echo "Example: $0 reprioritizer latest"
    exit 1
fi

PROJECT_ID="${GCP_PROJECT_ID:-one-moon-505501-u3}"
REGION="${GCP_REGION:-us-central1}"
REPO_NAME="pixelated-services"
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:${IMAGE_TAG}"

echo "=== Deploying ${SERVICE_NAME} to Google Cloud Run ==="
echo "Project:   ${PROJECT_ID}"
echo "Region:    ${REGION}"
echo "Image:     ${IMAGE_URI}"
echo "Policy:    min-instances=0 (Zero idle cost), max-instances=2"

gcloud run deploy "${SERVICE_NAME}" \
    --image="${IMAGE_URI}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --platform=managed \
    --min-instances=0 \
    --max-instances=2 \
    --memory=512Mi \
    --cpu=1 \
    --timeout=60 \
    --concurrency=80 \
    --allow-unauthenticated \
    --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID},GCP_REGION=${REGION}" \
    --quiet

echo "Deployment completed successfully for ${SERVICE_NAME}."
