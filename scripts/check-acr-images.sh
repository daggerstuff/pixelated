#!/bin/bash
set -euo pipefail

ACR_NAME="pixelatedcr"
RESOURCE_GROUP="pixelated-rg"

echo "📦 Checking ACR repositories..."
az acr repository list --name "$ACR_NAME" --output table

echo ""
echo "🏷️  Checking pixelated-web tags..."
az acr repository show-tags --name "$ACR_NAME" --repository "pixelated-web" --output table || echo "No pixelated-web found"

echo ""
echo "🏷️  Checking all repositories and their latest tags..."
for repo in $(az acr repository list --name "$ACR_NAME" --output tsv); do
  echo "Repository: $repo"
  az acr repository show-tags --name "$ACR_NAME" --repository "$repo" --orderby time_desc --top 3 --output table || true
  echo ""
done