#!/bin/bash

# Test script for Slack webhook integration
# Usage: ./test-slack-webhook.sh <webhook_url>

set -e

WEBHOOK_URL="$1"

if [ -z "$WEBHOOK_URL" ]; then
    echo "Usage: $0 <webhook_url>"
    echo "Example: $0 https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
    exit 1
fi

echo "Testing Slack webhook integration..."
echo "Webhook URL: ${WEBHOOK_URL:0:50}..."

# Test basic message
echo "Sending test message..."
RESPONSE=$(curl -s -w "%{http_code}" -X POST -H 'Content-type: application/json' \
    --data '{
        "text": "🧪 Test message from Pixelated Empathy monitoring setup",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "🧪 *Test Message*\n\nThis is a test of the Slack webhook integration for Pixelated Empathy monitoring.\n\n*Status:* Setup verification\n*Time:* '"$(date)"'"
                }
            }
        ]
    }' \
    "$WEBHOOK_URL")

HTTP_CODE="${RESPONSE: -3}"
BODY="${RESPONSE%???}"

echo "HTTP Response Code: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Success! Slack webhook is working correctly."
    echo "You should see a test message in your Slack channel."
    echo ""
    echo "Next steps:"
    echo "1. Add the webhook URL to GitHub secrets as 'SLACK_WEBHOOK'"
    echo "2. The monitoring workflow will now send notifications on failures"
    exit 0
else
    echo "❌ Failed! HTTP $HTTP_CODE"
    echo "Response: $BODY"
    echo ""
    echo "Common issues:"
    echo "- 404: Webhook URL is incorrect or webhook was deleted"
    echo "- 403: Webhook is disabled or invalid"
    echo "- 500: Slack service error (try again later)"
    exit 1
fi
