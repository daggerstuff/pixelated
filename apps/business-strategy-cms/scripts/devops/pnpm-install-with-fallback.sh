#!/usr/bin/env bash
set -euo pipefail

# Smart pnpm install with retry logic and fallback strategies
# Handles lockfile issues gracefully in CI/CD environments

# Configuration with defaults
MAX_ATTEMPTS="${PNPM_INSTALL_MAX_ATTEMPTS:-3}"
BASE_DELAY_SECONDS="${PNPM_INSTALL_RETRY_DELAY_SECONDS:-2}"
PNPM_ARGS="${PNPM_INSTALL_ARGS:-}"

# Logging function
log() {
  echo "[pnpm-install] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Exponential backoff function
backoff() {
  local attempt=$1
  local delay=$((BASE_DELAY_SECONDS * (2 ** (attempt - 1))))
  # Add jitter to prevent thundering herd
  local jitter=$((RANDOM % delay))
  local total_delay=$((delay + jitter))
  echo $total_delay
}

# Main install function with retry logic
install_with_retry() {
  local strategy="$1"
  local args="$2"
  local attempt=0
  local success=0

  log "Attempting pnpm install with strategy: $strategy"

  while [[ $attempt -lt $MAX_ATTEMPTS ]]; do
    attempt=$((attempt + 1))

    if [[ $attempt -gt 1 ]]; then
      local delay=$(backoff $attempt)
      log "Attempt $attempt/$MAX_ATTEMPTS failed, retrying in ${delay}s..."
      sleep $delay
    else
      log "Attempt $attempt/$MAX_ATTEMPTS..."
    fi

    # Try the install command
    if pnpm install $args; then
      log "Successfully installed dependencies with strategy: $strategy"
      success=1
      break
    else
      local exit_code=$?
      log "Attempt $attempt failed with exit code: $exit_code"

      # If this is the last attempt, we'll try the next strategy
      if [[ $attempt -eq $MAX_ATTEMPTS ]]; then
        log "Max attempts reached for strategy: $strategy"
        break
      fi
    fi
  done

  return $success
}

# Main execution
main() {
  local strategies=()

  # Determine which strategies to use based on environment
  if [[ "${PNPM_INSTALL_FORCE_NO_FROZEN_LOCKFILE:-}" == "1" ]]; then
    strategies=("no-frozen-lockfile")
  elif [[ "${PNPM_INSTALL_PREFER_FROZEN_LOCKFILE:-}" == "1" ]]; then
    strategies=("frozen-lockfile" "no-frozen-lockfile")
  else
    # Default strategy: try frozen-lockfile first, then fallback to no-frozen-lockfile
    strategies=("frozen-lockfile" "no-frozen-lockfile")
  fi

  # Add additional strategies if requested
  if [[ "${PNPM_INSTALL_TRY_OFFLINE_FIRST:-}" == "1" ]]; then
    strategies=("offline" "${strategies[@]}")
  fi

  local overall_success=0

  # Try each strategy in order
  for strategy in "${strategies[@]}"; do
    local args=""

    case "$strategy" in
      "offline")
        args="--offline $PNPM_ARGS"
        ;;
      "frozen-lockfile")
        args="--frozen-lockfile $PNPM_ARGS"
        ;;
      "no-frozen-lockfile")
        args="--no-frozen-lockfile $PNPM_ARGS"
        ;;
      *)
        args="$PNPM_ARGS"
        ;;
    esac

    if install_with_retry "$strategy" "$args"; then
      overall_success=1
      break
    fi
  done

  if [[ $overall_success -eq 1 ]]; then
    log "Dependencies installed successfully!"
    exit 0
  else
    log "Failed to install dependencies with all strategies after $MAX_ATTEMPTS attempts each"
    exit 1
  fi
}

# Run main function
main "$@"