#!/bin/bash
# Script to suppress Node.js deprecation warnings, specifically the child process with shell option warning

export NODE_OPTIONS="--no-deprecation --no-warnings"
export NODE_NO_WARNINGS=1

# Also suppress the specific DEP0190 warning
export NODE_PENDING_DEPRECATION=0

echo "Deprecation warnings suppressed."
echo "NODE_OPTIONS set to: $NODE_OPTIONS"
echo "NODE_NO_WARNINGS set to: $NODE_NO_WARNINGS"
echo "NODE_PENDING_DEPRECATION set to: $NODE_PENDING_DEPRECATION"