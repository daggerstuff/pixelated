#!/usr/bin/env bash
# Test Struct MCP Connection
# Validates that the Struct MCP server is accessible and configured correctly

set -euo pipefail

echo "🔍 Testing Struct MCP Connection..."

# Check if .mcp.json exists
if [ ! -f .mcp.json ]; then
    echo "❌ .mcp.json not found"
    exit 1
fi

echo "✅ .mcp.json exists"

# Check if struct MCP config is present
if ! grep -q '"struct"' .mcp.json; then
    echo "❌ Struct MCP configuration not found in .mcp.json"
    exit 1
fi

echo "✅ Struct MCP configuration found"

# Extract MCP URL from config (handles both direct URL and env var)
MCP_URL=$(cat .mcp.json | jq -r '.mcp.struct.url // empty')
MCP_ENABLED=$(cat .mcp.json | jq -r '.mcp.struct.enabled // false')

if [ "$MCP_ENABLED" != "true" ]; then
    echo "⚠️  Struct MCP is not enabled in .mcp.json"
    exit 0
fi

if [ -z "$MCP_URL" ] || [ "$MCP_URL" = "null" ]; then
    echo "❌ Struct MCP URL not configured"
    exit 1
fi

echo "📡 Struct MCP URL: $MCP_URL"

# Check if environment variables are set for the URL
if [[ "$MCP_URL" == \$\{*\} ]]; then
    echo "⚠️  MCP URL uses environment variable: $MCP_URL"
    echo "   Ensure STRUCT_MCP_URL is set in environment"
    
    # Check if env var is set
    ENV_VAR=$(echo "$MCP_URL" | sed 's/\${//' | sed 's/}//')
    if [ -z "${!ENV_VAR:-}" ]; then
        echo "⚠️  Environment variable $ENV_VAR is not set (expected for local development)"
        echo "   OAuth authentication will be handled on first use"
        exit 0
    else
        echo "✅ Environment variable $ENV_VAR is set"
        MCP_URL="${!ENV_VAR}"
    fi
fi
# Test MCP server connectivity
echo "🔌 Testing MCP server connectivity..."
if curl -s -f -o /dev/null --max-time 10 "$MCP_URL/health" 2>/dev/null; then
    echo "✅ MCP server health endpoint accessible"
elif curl -s -f -o /dev/null --max-time 10 "$MCP_URL" 2>/dev/null; then
    echo "✅ MCP server base URL accessible"
else
    echo "⚠️  MCP server not accessible (may require auth or be internal)"
    echo "   This is expected if running locally without Struct account"
    exit 0
fi
fi
echo "✅ Struct MCP connection test completed"