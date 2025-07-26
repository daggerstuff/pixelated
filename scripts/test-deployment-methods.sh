#!/bin/bash
# Quick test for the alternative deployment approaches
set -e

echo "=== Testing Alternative Deployment Methods ==="

# Test 1: Verify Bicep template can be built
echo "Test 1: Building Bicep template..."
if az bicep build --file infra/main.bicep --outfile infra/main.json; then
    echo "✅ Bicep template builds successfully"
else
    echo "❌ Bicep template failed to build"
    exit 1
fi

# Test 2: Check if we can get access token
echo "Test 2: Testing Azure authentication..."
if ACCESS_TOKEN=$(az account get-access-token --query accessToken --output tsv 2>/dev/null) && [ -n "$ACCESS_TOKEN" ]; then
    echo "✅ Azure authentication working"
else
    echo "❌ Azure authentication failed"
    exit 1
fi

# Test 3: Check subscription access
echo "Test 3: Testing subscription access..."
if SUBSCRIPTION_ID=$(az account show --query id --output tsv 2>/dev/null) && [ -n "$SUBSCRIPTION_ID" ]; then
    echo "✅ Subscription access working: $SUBSCRIPTION_ID"
else
    echo "❌ Subscription access failed"
    exit 1
fi

# Test 4: Check if required tools are available
echo "Test 4: Checking required tools..."
if command -v curl &> /dev/null; then
    echo "✅ curl is available"
else
    echo "❌ curl not found"
fi

if command -v jq &> /dev/null; then
    echo "✅ jq is available"
else
    echo "⚠️  jq not found - will need to install for REST API method"
fi

# Test 5: Validate ARM template structure
echo "Test 5: Validating ARM template structure..."
if jq empty infra/main.json 2>/dev/null; then
    echo "✅ ARM template JSON is valid"
else
    echo "❌ ARM template JSON is invalid"
    exit 1
fi

echo "✅ All tests passed - alternative deployment methods should work"
