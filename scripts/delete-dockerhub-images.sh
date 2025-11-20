#!/usr/bin/env bash
# Script to delete all images from pixelatedempathy/pixelated on Docker Hub
# Requires Docker Hub credentials via environment variables or Docker login

set -euo pipefail

REPO="pixelatedempathy/pixelated"
DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-${DOCKER_USER:-}}"
DOCKERHUB_TOKEN="${DOCKERHUB_TOKEN:-${DOCKER_PAT:-}}"

if [ -z "$DOCKERHUB_USERNAME" ] || [ -z "$DOCKERHUB_TOKEN" ]; then
  echo "❌ Error: Docker Hub credentials required"
  echo "Set DOCKERHUB_USERNAME and DOCKERHUB_TOKEN (or DOCKER_USER and DOCKER_PAT)"
  echo "Alternatively, ensure 'docker login' has been run"
  exit 1
fi

echo "🔍 Fetching all tags from Docker Hub repository: $REPO"

# Get authentication token
AUTH_TOKEN=$(curl -s -H "Content-Type: application/json" \
  -X POST \
  -d "{\"username\": \"$DOCKERHUB_USERNAME\", \"password\": \"$DOCKERHUB_TOKEN\"}" \
  https://hub.docker.com/v2/users/login/ | jq -r .token)

if [ "$AUTH_TOKEN" = "null" ] || [ -z "$AUTH_TOKEN" ]; then
  echo "❌ Error: Failed to authenticate with Docker Hub"
  exit 1
fi

echo "✅ Authenticated with Docker Hub"

# Get all tags (handle pagination)
PAGE=1
PAGE_SIZE=100
TOTAL_TAGS=()

while true; do
  RESPONSE=$(curl -s -H "Authorization: JWT $AUTH_TOKEN" \
    "https://hub.docker.com/v2/repositories/$REPO/tags/?page_size=$PAGE_SIZE&page=$PAGE")
  
  TAGS=$(echo "$RESPONSE" | jq -r '.results[]?.name // empty')
  COUNT=$(echo "$RESPONSE" | jq '.results | length')
  NEXT=$(echo "$RESPONSE" | jq -r '.next // empty')
  
  if [ "$COUNT" -eq 0 ]; then
    break
  fi
  
  while IFS= read -r tag; do
    if [ -n "$tag" ]; then
      TOTAL_TAGS+=("$tag")
    fi
  done <<< "$TAGS"
  
  if [ -z "$NEXT" ] || [ "$NEXT" = "null" ]; then
    break
  fi
  
  PAGE=$((PAGE + 1))
done

TAG_COUNT=${#TOTAL_TAGS[@]}

if [ "$TAG_COUNT" -eq 0 ]; then
  echo "ℹ️  No tags found in repository $REPO"
  exit 0
fi

echo "📋 Found $TAG_COUNT tag(s) to delete:"
for tag in "${TOTAL_TAGS[@]}"; do
  echo "  - $tag"
done

echo ""
read -p "⚠️  Are you sure you want to delete ALL $TAG_COUNT tag(s) from $REPO? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Cancelled by user"
  exit 0
fi

echo ""
echo "🗑️  Deleting tags..."

DELETED=0
FAILED=0

for tag in "${TOTAL_TAGS[@]}"; do
  echo -n "  Deleting $tag... "
  
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE \
    -H "Authorization: JWT $AUTH_TOKEN" \
    "https://hub.docker.com/v2/repositories/$REPO/tags/$tag/")
  
  if [ "$HTTP_CODE" -eq 204 ] || [ "$HTTP_CODE" -eq 200 ]; then
    echo "✅"
    DELETED=$((DELETED + 1))
  else
    echo "❌ (HTTP $HTTP_CODE)"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary:"
echo "   Total tags: $TAG_COUNT"
echo "   Deleted: $DELETED"
echo "   Failed: $FAILED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAILED" -gt 0 ]; then
  echo "⚠️  Some tags failed to delete. Check Docker Hub manually."
  exit 1
fi

echo "✅ All tags deleted successfully!"

