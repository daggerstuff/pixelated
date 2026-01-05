#!/bin/bash

# Script to migrate users from MongoDB to Auth0
# Usage: ./migrate-users-to-auth0.sh

set -e

# Get directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Extract MongoDB variables from .env file
ENV_FILE="$SCRIPT_DIR/../../.env"
if [ ! -f "$ENV_FILE" ]; then
    ENV_FILE="$SCRIPT_DIR/../.env"
fi

if [ -f "$ENV_FILE" ]; then
    echo "Extracting MongoDB variables from $ENV_FILE"
    # Extract specific variables using grep and cut
    export MONGODB_URI=$(grep "^MONGODB_URI=" "$ENV_FILE" | cut -d'=' -f2-)
    export MONGODB_DB_NAME=$(grep "^MONGODB_DB_NAME=" "$ENV_FILE" | cut -d'=' -f2-)

    # If MONGODB_URI is not set, try to build it from components
    if [ -z "$MONGODB_URI" ]; then
        MONGODB_USERNAME=$(grep "^MONGODB_USERNAME=" "$ENV_FILE" | cut -d'=' -f2-)
        MONGODB_PASSWORD=$(grep "^MONGODB_PASSWORD=" "$ENV_FILE" | cut -d'=' -f2-)
        MONGODB_CLUSTER=$(grep "^MONGODB_CLUSTER=" "$ENV_FILE" | cut -d'=' -f2-)

        if [ -n "$MONGODB_USERNAME" ] && [ -n "$MONGODB_PASSWORD" ] && [ -n "$MONGODB_CLUSTER" ]; then
            export MONGODB_URI="mongodb+srv://${MONGODB_USERNAME}:${MONGODB_PASSWORD}@${MONGODB_CLUSTER}/?retryWrites=true&w=majority"
        fi
    fi
else
    echo "Warning: .env file not found at $ENV_FILE"
fi

# Check if required environment variables are set
if [ -z "$MONGODB_DB_NAME" ]; then
    echo "Setting default database name"
    export MONGODB_DB_NAME="pixelated_empathy"
fi

echo "MongoDB Database: $MONGODB_DB_NAME"
echo "MongoDB URI: ${MONGODB_URI:-using default localhost connection}"

# Run the Node.js script
echo "Starting user migration..."
node "$SCRIPT_DIR/migrate-users-to-auth0.js"

echo "User migration completed!"