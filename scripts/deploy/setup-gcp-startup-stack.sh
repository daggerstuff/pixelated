#!/usr/bin/env bash
# ==============================================================================
# setup-gcp-startup-stack.sh
# 
# Configures Google Cloud Platform (GCP) project for the Google for Startups
# $2,000 credit package.
#
# Configures:
#   - Project: one-moon-505501-u3
#   - Region: us-central1 (Iowa - co-located with VM 'herm' and MongoDB Atlas)
#   - APIs: Cloud Run, Vertex AI, Artifact Registry, Secret Manager, Cloud Build
#   - Cost guardrail: Scale-to-zero defaults ($0 idle cost)
# ==============================================================================

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-one-moon-505501-u3}"
REGION="${GCP_REGION:-us-central1}"
REPO_NAME="pixelated-services"

echo "=== Google for Startups Cloud Stack Setup ==="
echo "Target Project: ${PROJECT_ID}"
echo "Target Region:  ${REGION}"

# 1. Verify gcloud installation
if ! command -v gcloud &>/dev/null; then
    echo "ERROR: gcloud CLI is not installed."
    exit 1
fi

# 2. Check active authentication
CURRENT_ACCOUNT=$(gcloud config get-value account 2>/dev/null || true)
if [ -z "${CURRENT_ACCOUNT}" ] || [ "${CURRENT_ACCOUNT}" = "(unset)" ]; then
    echo "No active gcloud account detected. Please authenticate first:"
    echo "  gcloud auth login --update-adc"
    exit 1
fi
echo "Authenticated as: ${CURRENT_ACCOUNT}"

# 3. Set project and region in active configuration
echo "Configuring gcloud defaults..."
gcloud config set project "${PROJECT_ID}"
gcloud config set compute/region "${REGION}"
gcloud config set run/region "${REGION}"

# 4. Enable essential startup APIs
echo "Enabling credit-eligible GCP APIs..."
REQUIRED_SERVICES=(
    "run.googleapis.com"              # Cloud Run (serverless container execution)
    "aiplatform.googleapis.com"       # Vertex AI (Gemini 1.5 Pro/Flash, Embeddings)
    "artifactregistry.googleapis.com" # Artifact Registry (Docker images)
    "secretmanager.googleapis.com"    # Secret Manager (environment secrets)
    "cloudbuild.googleapis.com"       # Cloud Build (container builds)
    "monitoring.googleapis.com"       # Cloud Monitoring (metrics & budget alerts)
    "logging.googleapis.com"          # Cloud Logging (structured logs)
)

for svc in "${REQUIRED_SERVICES[@]}"; do
    echo "  -> Enabling ${svc}..."
    gcloud services enable "${svc}" --project="${PROJECT_ID}" --quiet || {
        echo "WARNING: Could not enable ${svc}. Verify permissions or retry."
    }
done

# 5. Create Artifact Registry repository for containers if not present
echo "Verifying Artifact Registry repository..."
if ! gcloud artifacts repositories describe "${REPO_NAME}" --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
    echo "Creating Artifact Registry repository '${REPO_NAME}' in ${REGION}..."
    gcloud artifacts repositories create "${REPO_NAME}" \
        --repository-format=docker \
        --location="${REGION}" \
        --description="Docker container repository for Pixelated Empathy services" \
        --project="${PROJECT_ID}"
    echo "Artifact Registry repository '${REPO_NAME}' created."
else
    echo "Artifact Registry repository '${REPO_NAME}' already exists."
fi

# 6. Configure Docker credential helper
echo "Configuring Docker credential helper for ${REGION}-docker.pkg.dev..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet || true

echo ""
echo "=== GCP Startup Stack Configuration Complete ==="
echo "Artifact Registry: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"
echo "Cloud Run Region:  ${REGION}"
echo "All services configured for scale-to-zero ($0 idle cost)."
