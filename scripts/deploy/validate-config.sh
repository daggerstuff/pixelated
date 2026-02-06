#!/bin/bash
# validate-config.sh
# Validates that the environment file for the given environment exists and has required keys.

set -euo pipefail

ENVIRONMENT="${1:-staging}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env.${ENVIRONMENT}"
EXAMPLE_FILE="${PROJECT_ROOT}/.env.example"

if [[ ! -f "${ENV_FILE}" ]]; then
    echo "❌ Environment file not found: ${ENV_FILE}"
    exit 1
fi

echo "✅ Environment file ${ENV_FILE} found. Validating..."

# Check for missing keys compared to .env.example
if [[ -f "${EXAMPLE_FILE}" ]]; then
    MISSING_KEYS=0
    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ $line =~ ^[^#[:space:]]+= ]]; then
            KEY=$(echo "$line" | cut -d'=' -f1)
            if ! grep -q "^${KEY}=" "${ENV_FILE}"; then
                echo "⚠️  Missing key in ${ENV_FILE}: ${KEY}"
                MISSING_KEYS=$((MISSING_KEYS + 1))
            fi
        fi
    done < "${EXAMPLE_FILE}"
    
    if [[ $MISSING_KEYS -gt 0 ]]; then
        echo "⚠️  Found ${MISSING_KEYS} missing keys in ${ENV_FILE}."
    else
        echo "✅ All keys from .env.example are present in ${ENV_FILE}."
    fi
fi

exit 0
