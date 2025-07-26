#!/bin/bash
# Alternative Azure deployment using REST API to bypass CLI issues
set -e

RESOURCE_GROUP="$1"
LOCATION="$2" 
ENVIRONMENT="$3"

if [ -z "$RESOURCE_GROUP" ] || [ -z "$LOCATION" ] || [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <resource-group> <location> <environment>"
    exit 1
fi

echo "=== Azure REST API Deployment ==="
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "Environment: $ENVIRONMENT"
echo "=================================="

# Get access token
echo "Getting Azure access token..."
ACCESS_TOKEN=$(az account get-access-token --query accessToken --output tsv)

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Failed to get Azure access token"
    exit 1
fi

SUBSCRIPTION_ID=$(az account show --query id --output tsv)
echo "Subscription ID: $SUBSCRIPTION_ID"

# Ensure template is built
if [ ! -f "infra/main.json" ]; then
    echo "Building Bicep template..."
    az bicep build --file infra/main.bicep --outfile infra/main.json
fi

# Create deployment payload
DEPLOYMENT_NAME="api-deploy-$(date +%Y%m%d-%H%M%S)"

cat > /tmp/deployment_payload.json <<EOF
{
    "properties": {
        "template": $(cat infra/main.json),
        "parameters": {
            "location": {
                "value": "$LOCATION"
            },
            "environmentName": {
                "value": "$ENVIRONMENT"
            }
        },
        "mode": "Incremental"
    }
}
EOF

echo "Starting REST API deployment: $DEPLOYMENT_NAME"

# Deploy using REST API
DEPLOY_URL="https://management.azure.com/subscriptions/$SUBSCRIPTION_ID/resourcegroups/$RESOURCE_GROUP/providers/Microsoft.Resources/deployments/$DEPLOYMENT_NAME?api-version=2021-04-01"

RESPONSE=$(curl -s -X PUT \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d @/tmp/deployment_payload.json \
    "$DEPLOY_URL")

if echo "$RESPONSE" | grep -q '"provisioningState":"Succeeded"'; then
    echo "✅ Deployment started successfully via REST API"
else
    echo "❌ Deployment failed. Response:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

# Monitor deployment status
echo "Monitoring deployment progress..."
STATUS_URL="https://management.azure.com/subscriptions/$SUBSCRIPTION_ID/resourcegroups/$RESOURCE_GROUP/providers/Microsoft.Resources/deployments/$DEPLOYMENT_NAME?api-version=2021-04-01"

for i in {1..40}; do
    STATUS_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$STATUS_URL")
    PROVISIONING_STATE=$(echo "$STATUS_RESPONSE" | jq -r '.properties.provisioningState // "Unknown"')
    
    echo "Deployment status: $PROVISIONING_STATE (check $i/40)"
    
    case "$PROVISIONING_STATE" in
        "Succeeded")
            echo "✅ REST API deployment completed successfully!"
            
            # Clean up
            rm -f /tmp/deployment_payload.json
            exit 0
            ;;
        "Failed")
            echo "❌ Deployment failed"
            echo "$STATUS_RESPONSE" | jq '.properties.error // .error // .' 2>/dev/null || echo "No error details available"
            rm -f /tmp/deployment_payload.json
            exit 1
            ;;
        "Running"|"Accepted")
            # Continue waiting
            ;;
        *)
            echo "⚠️  Unknown status: $PROVISIONING_STATE"
            ;;
    esac
    
    sleep 30
done

echo "❌ Deployment timed out after 20 minutes"
rm -f /tmp/deployment_payload.json
exit 1
