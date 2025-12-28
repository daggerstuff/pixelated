#!/bin/bash

# resolve-submodule-url.sh
# Dynamically override submodule URL based on deployment environment
# Used in CI/CD pipelines to avoid SSH key issues and support Azure DevOps internal access

set -euo pipefail

SUBMODULE_PATH="ai"
SUBMODULE_URL_GITHUB="https://github.com/pixelatedempathy/ai.git"
SUBMODULE_URL_AZURE="https://dev.azure.com/pixeljump/_git/ai"

# Detect environment: if AZURE_DEVOPS_PIPELINE is set, use Azure URL
if [[ -n "$AZURE_DEVOPS_PIPELINE" ]]; then
  echo "Detected Azure DevOps pipeline environment. Using Azure submodule URL."
  SUBMODULE_URL="$SUBMODULE_URL_AZURE"
else
  echo "Detected external/GitHub environment. Using GitHub submodule URL."
  SUBMODULE_URL="$SUBMODULE_URL_GITHUB"
fi

# Update git config for this repo only to override submodule URL
# This avoids modifying .gitmodules and keeps it clean for developers

git config submodule."$SUBMODULE_PATH".url "$SUBMODULE_URL"

echo "Submodule URL overridden to: $SUBMODULE_URL"

echo "Running: git submodule sync && git submodule update --init --recursive"
git submodule sync
git submodule update --init --recursive
