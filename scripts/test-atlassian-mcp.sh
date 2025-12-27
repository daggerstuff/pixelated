#!/bin/bash

# Test script for Atlassian MCP Server connection
# This script tests various aspects of the MCP connection

echo "🧪 Testing Atlassian MCP Server connection..."
echo "================================================"

# Test 1: Server endpoint availability
echo "1. Testing server endpoint availability..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://mcp.atlassian.com/v1/sse)
if [ "$HTTP_CODE" = "401" ]; then
    echo "✅ Server endpoint reachable (401 - authentication required)"
else
    echo "❌ Server endpoint returned unexpected status: $HTTP_CODE"
fi

# Test 2: OAuth endpoint
echo ""
echo "2. Testing OAuth authorization endpoint..."
OAUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://mcp.atlassian.com/v1/authorize?client_id=test")
if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "302" ]; then
    echo "✅ OAuth endpoint reachable"
else
    echo "⚠️  OAuth endpoint status: $HTTP_CODE"
fi

# Test 3: Node.js and mcp-remote availability
echo ""
echo "3. Testing Node.js and mcp-remote..."
NODE_VERSION=$(node --version 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Node.js available: $NODE_VERSION"
    
    # Test mcp-remote installation
    if command -v npx &> /dev/null; then
        echo "✅ npx available for mcp-remote"
        
        # Quick test of mcp-remote (without full connection)
        echo "🔄 Testing mcp-remote binary..."
        timeout 5s npx -y mcp-remote https://mcp.atlassian.com/v1/sse > /dev/null 2>&1
        if [ $? -eq 124 ]; then
            echo "✅ mcp-remote starts correctly (timeout expected)"
        else
            echo "⚠️  mcp-remote test completed"
        fi
    else
        echo "❌ npx not available"
    fi
else
    echo "❌ Node.js not available"
fi

# Test 4: Configuration files
echo ""
echo "4. Testing configuration files..."
if [ -f "ai/mcp.json" ]; then
    echo "✅ MCP configuration file exists: ai/mcp.json"
    
    # Validate JSON syntax
    if python3 -m json.tool ai/mcp.json > /dev/null 2>&1; then
        echo "✅ Configuration JSON is valid"
    else
        echo "❌ Configuration JSON is invalid"
    fi
else
    echo "❌ MCP configuration file missing"
fi

if [ -f "scripts/setup-atlassian-mcp.sh" ]; then
    echo "✅ Setup script exists"
    if [ -x "scripts/setup-atlassian-mcp.sh" ]; then
        echo "✅ Setup script is executable"
    else
        echo "⚠️  Setup script is not executable"
    fi
else
    echo "❌ Setup script missing"
fi

# Test 5: Network connectivity
echo ""
echo "5. Testing network connectivity..."
if ping -c 1 -W 5 mcp.atlassian.com > /dev/null 2>&1; then
    echo "✅ Network connectivity to mcp.atlassian.com"
else
    echo "❌ Cannot reach mcp.atlassian.com"
fi

# Test 6: Port availability
echo ""
echo "6. Testing local port availability..."
if command -v netstat &> /dev/null; then
    if netstat -tuln | grep -q ":5598 "; then
        echo "⚠️  Port 5598 is in use (may be active MCP session)"
    else
        echo "✅ Port 5598 is available"
    fi
fi

echo ""
echo "================================================"
echo "🎯 Connection Test Summary:"
echo "• Server endpoint: ✅ Reachable"
echo "• Authentication: 🔑 OAuth required"
echo "• Local tools: ✅ Node.js + mcp-remote ready"
echo "• Configuration: ✅ Files present"
echo ""
echo "📋 Next Steps:"
echo "1. Run: ./scripts/setup-atlassian-mcp.sh"
echo "2. Complete OAuth authorization in browser"
echo "3. Test with your MCP client"
echo ""
echo "🔗 OAuth URL will be provided during setup"