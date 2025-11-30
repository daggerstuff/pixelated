#!/bin/bash
# Wrapper script to suppress kubectl informational messages
# Filters out "no symbol section" and other informational TLS messages

set -euo pipefail

# Suppress kubectl informational messages via environment
export KUBECTL_VERBOSITY=0

# Create a kubectl wrapper function that filters informational messages
kubectl_quiet() {
    kubectl "$@" 2>&1 | \
        grep -v "no symbol section" | \
        grep -v "tls.go" | \
        grep -v "^I[0-9]" || true
}

# If script is sourced, export the function
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
    export -f kubectl_quiet
    echo "✅ kubectl_quiet function exported. Use 'kubectl_quiet' instead of 'kubectl' to suppress informational messages."
else
    # If script is executed directly, run kubectl with filtering
    kubectl "$@" 2>&1 | \
        grep -v "no symbol section" | \
        grep -v "tls.go" | \
        grep -v "^I[0-9]" || true
fi

