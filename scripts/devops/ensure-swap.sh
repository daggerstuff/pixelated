#!/usr/bin/env bash

set -euo pipefail

if swapon --show --noheadings | grep -q .; then
  echo "Swap already enabled"
  swapon --show
  free -h
  exit 0
fi

SUDO=""
if command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
fi

SWAPFILE="${SWAPFILE:-/swapfile}"
SWAPSIZE_GB="${SWAPSIZE_GB:-8}"

echo "Creating ${SWAPSIZE_GB}G swap at ${SWAPFILE}"
if command -v fallocate >/dev/null 2>&1; then
  $SUDO fallocate -l "${SWAPSIZE_GB}G" "${SWAPFILE}"
else
  $SUDO dd if=/dev/zero of="${SWAPFILE}" bs=1M count="$((SWAPSIZE_GB * 1024))" status=progress
fi

$SUDO chmod 600 "${SWAPFILE}"
$SUDO mkswap "${SWAPFILE}"
$SUDO swapon "${SWAPFILE}"

if ! $SUDO grep -qE "^[^#]+\\s+${SWAPFILE//\//\\/}\\s+swap\\s+" /etc/fstab; then
  echo "${SWAPFILE} none swap sw 0 0" | $SUDO tee -a /etc/fstab >/dev/null
fi

swapon --show
free -h
