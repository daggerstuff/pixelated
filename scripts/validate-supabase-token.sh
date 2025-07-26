#!/usr/bin/env bash
# validate-supabase-token.sh
# A script to validate if a Supabase access token is in the correct format

# Usage: ./validate-supabase-token.sh [token]
# If no token is provided, it will check for SUPABASE_ACCESS_TOKEN environment variable

set -euo pipefail

# Get token from argument or environment variable
TOKEN="${1:-${SUPABASE_ACCESS_TOKEN-}}"

if [ -z "${TOKEN}" ]; then
	echo "Error: No token provided. Please provide a token as argument or set SUPABASE_ACCESS_TOKEN environment variable."
	exit 1
fi

# Check if token starts with sbp_
if [[ ! ${TOKEN} =~ ^sbp_ ]]; then
	echo "Error: Invalid Supabase access token format. Token must start with 'sbp_' followed by alphanumeric characters."
	echo "Please ensure you're using a valid Supabase access token obtained from the Supabase dashboard."
	echo "For more information, visit: https://supabase.com/docs/reference/cli/usage#access-token"
	exit 1
fi

# Validate length (should be reasonable for a token)
if [ ${#TOKEN} -lt 20 ]; then
	echo "Warning: Token seems too short for a valid Supabase access token."
	echo "Make sure you're using the complete token without truncation."
	exit 1
fi

echo "✅ Token format appears valid."
echo "Note: This script only validates the format, not if the token is active or authorized."
echo "To test connectivity, try: supabase projects list"
exit 0
