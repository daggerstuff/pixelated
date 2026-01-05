#!/bin/bash

# Script to create Jira issues for Enhanced Auth0 migration
# Usage: ./create-auth0-enhanced-jira-issues.sh [PROJECT_KEY]

set -e

# Set default project key if not provided
PROJECT_KEY=${1:-PIX}

# Get directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Extract Jira variables from .env file
ENV_FILE="$SCRIPT_DIR/../../.env"
if [ ! -f "$ENV_FILE" ]; then
    ENV_FILE="$SCRIPT_DIR/../.env"
fi

if [ -f "$ENV_FILE" ]; then
    echo "Extracting Jira variables from $ENV_FILE"
    # Extract specific variables using grep and cut
    JIRA_URL=$(grep "^JIRA_URL=" "$ENV_FILE" | cut -d'=' -f2-)
    JIRA_USERNAME=$(grep "^JIRA_USERNAME=" "$ENV_FILE" | cut -d'=' -f2-)
    JIRA_API_TOKEN=$(grep "^JIRA_API_TOKEN=" "$ENV_FILE" | cut -d'=' -f2-)

    # Export the variables
    export JIRA_URL
    export JIRA_USERNAME
    export JIRA_API_TOKEN
else
    echo "Warning: .env file not found at $ENV_FILE"
fi

# Check if required environment variables are set
if [ -z "$JIRA_USERNAME" ] || [ -z "$JIRA_API_TOKEN" ]; then
    echo "Error: JIRA_USERNAME and JIRA_API_TOKEN must be set"
    echo "Either set them as environment variables or ensure .env file exists in project root"
    exit 1
fi

echo "Creating Jira issues for Enhanced Auth0 migration..."
echo "Project Key: $PROJECT_KEY"
echo "Jira URL: ${JIRA_URL:-https://metalpixel.atlassian.net}"
echo "Jira Username: $JIRA_USERNAME"

# Run the Node.js script
node "$SCRIPT_DIR/create-auth0-enhanced-jira-issues.js" "$PROJECT_KEY"

echo "Enhanced Jira issues creation completed!"