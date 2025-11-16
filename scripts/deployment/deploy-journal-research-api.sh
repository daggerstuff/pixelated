#!/bin/bash
# Deployment script for Journal Research API Server
# Usage: ./deploy-journal-research-api.sh [environment]

set -e

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🚀 Deploying Journal Research API Server"
echo "Environment: $ENVIRONMENT"
echo "Project Root: $PROJECT_ROOT"

# Load environment-specific configuration
ENV_FILE="$PROJECT_ROOT/.env.$ENVIRONMENT"
if [ -f "$ENV_FILE" ]; then
  echo "📋 Loading environment configuration from $ENV_FILE"
  # Save GitHub CLI tokens to prevent interference with gh auth
  SAVED_GITHUB_TOKEN="${GITHUB_TOKEN:-}"
  SAVED_GH_TOKEN="${GH_TOKEN:-}"
  
  set -a
  source "$ENV_FILE"
  set +a
  
  # Restore GitHub CLI tokens (don't let env file override them)
  # GitHub CLI should manage its own authentication
  if [ -n "$SAVED_GITHUB_TOKEN" ]; then
    export GITHUB_TOKEN="$SAVED_GITHUB_TOKEN"
  else
    unset GITHUB_TOKEN
  fi
  if [ -n "$SAVED_GH_TOKEN" ]; then
    export GH_TOKEN="$SAVED_GH_TOKEN"
  else
    unset GH_TOKEN
  fi
else
  echo "⚠️  Warning: Environment file $ENV_FILE not found, using defaults"
fi

# Validate required environment variables
REQUIRED_VARS=(
  "JWT_SECRET"
)

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Error: Required environment variable $var is not set"
    exit 1
  fi
done

# Build Docker image
echo "🔨 Building Docker image..."
cd "$PROJECT_ROOT"
docker build \
  -f docker/journal-research-api/Dockerfile \
  -t journal-research-api:latest \
  -t "journal-research-api:${ENVIRONMENT}" \
  .

# Stop existing container if running
if docker ps -a | grep -q journal-research-api; then
  echo "🛑 Stopping existing container..."
  docker stop journal-research-api || true
  docker rm journal-research-api || true
fi

# Run container
echo "▶️  Starting container..."
docker run -d \
  --name journal-research-api \
  --restart unless-stopped \
  -p 8000:8000 \
  -e HOST=0.0.0.0 \
  -e PORT=8000 \
  -e "ENVIRONMENT=${ENVIRONMENT}" \
  -e API_VERSION=1.0.0 \
  -e "DEBUG=${DEBUG:-false}" \
  -e "CORS_ORIGINS=${CORS_ORIGINS:-http://localhost:4321,http://localhost:3000}" \
  -e "AUTH_ENABLED=${AUTH_ENABLED:-true}" \
  -e "JWT_SECRET=${JWT_SECRET}" \
  -e "JWT_ALGORITHM=${JWT_ALGORITHM:-HS256}" \
  -e "JWT_EXPIRATION_MINUTES=${JWT_EXPIRATION_MINUTES:-1440}" \
  -e "RATE_LIMIT_ENABLED=${RATE_LIMIT_ENABLED:-true}" \
  -e "RATE_LIMIT_PER_MINUTE=${RATE_LIMIT_PER_MINUTE:-60}" \
  -e "RATE_LIMIT_PER_HOUR=${RATE_LIMIT_PER_HOUR:-1000}" \
  -e "LOG_LEVEL=${LOG_LEVEL:-INFO}" \
  -e SESSION_STORAGE_PATH=/app/sessions \
  -v journal-research-sessions:/app/sessions \
  "journal-research-api:${ENVIRONMENT}"

# Wait for health check
echo "⏳ Waiting for service to be healthy..."
for i in {1..30}; do
  if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Service is healthy!"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "❌ Service health check failed after 30 attempts"
    docker logs journal-research-api
    exit 1
  fi
  sleep 2
done

echo "✅ Deployment complete!"
echo "📊 API Server: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/api/docs"
echo "📋 Logs: docker logs -f journal-research-api"

