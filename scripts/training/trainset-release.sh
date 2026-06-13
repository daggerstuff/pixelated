#!/usr/bin/env bash
# =============================================================================
# trainset-release.sh
# Create a dated, versioned trainset release tag and optionally push it.
#
# Naming convention: trainset-<YYYYMMDD>-v<N>
# Example: trainset-20260613-v1
#
# Usage:
#   ./scripts/training/trainset-release.sh [--dry-run] [--message "msg"] [--pr <PR_URL>]
# =============================================================================
set -euo pipefail

DRY_RUN=false
MESSAGE=""
PR_URL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --message)
      MESSAGE="$2"
      shift 2
      ;;
    --pr)
      PR_URL="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Usage: $0 [--dry-run] [--message \"msg\"] [--pr <PR_URL>]"
      exit 1
      ;;
  esac
done

DATE_STAMP=$(date +%Y%m%d)

# Find the latest version for today's date
LATEST_VERSION=$(git tag -l "trainset-${DATE_STAMP}-v*" --sort=-v:refname | head -n1)
if [[ -n "$LATEST_VERSION" ]]; then
  # Extract version number from tag like trainset-20260613-v1
  VERSION_NUM=$(echo "$LATEST_VERSION" | sed 's/.*-v//')
  VERSION_NUM=$((VERSION_NUM + 1))
else
  VERSION_NUM=1
fi

TAG_NAME="trainset-${DATE_STAMP}-v${VERSION_NUM}"

if [[ -z "$MESSAGE" ]]; then
  MESSAGE="Trainset release ${TAG_NAME}"
  if [[ -n "$PR_URL" ]]; then
    MESSAGE="${MESSAGE}

Associated PR: ${PR_URL}"
  fi
fi

if [[ "$DRY_RUN" == true ]]; then
  echo "[DRY RUN] Would create tag: ${TAG_NAME}"
  echo "[DRY RUN] Message: ${MESSAGE}"
  echo "[DRY RUN] Command: git tag -a \"${TAG_NAME}\" -m \"${MESSAGE}\""
  exit 0
fi

echo "Creating trainset release tag: ${TAG_NAME}"
git tag -a "${TAG_NAME}" -m "${MESSAGE}"

echo "Tag created: ${TAG_NAME}"
echo ""
echo "To push the tag to remote:"
echo "  git push origin ${TAG_NAME}"
