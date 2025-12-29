#!/bin/bash

# Manual OAuth setup for Atlassian MCP Server
# This script provides the OAuth URL and manual setup steps

echo "🔧 Manual Atlassian MCP OAuth Setup"
echo "===================================="

# Generate OAuth URL manually
CLIENT_ID="a1I6bPpdTknwTiue"
REDIRECT_URI="http://localhost:5598/oauth/callback"
STATE=$(openssl rand -hex 16 2>/dev/null || date +%s%N | tail -c 16)

OAUTH_URL="https://mcp.atlassian.com/v1/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&state=${STATE}&scope=openid+email+profile"

echo "📋 OAuth Authorization URL:"
echo "${OAUTH_URL}"
echo ""
echo "🌐 Steps to complete setup:"
echo "1. Copy the URL above"
echo "2. Open it in your browser"
echo "3. Log in with your Atlassian credentials"
echo "4. Approve the requested permissions"
echo "5. You'll be redirected back to localhost (may show error - this is expected)"
echo ""
echo "🔧 After completing OAuth:"
echo "1. Run this command to test the connection:"
echo "   npx -y mcp-remote https://mcp.atlassian.com/v1/sse"
echo ""
echo "2. The connection should now work without prompting for OAuth"
echo ""
echo "📝 Note: The OAuth callback may show an error page, but the"
echo "authorization token will still be captured by the mcp-remote process"
echo ""
echo "⚡ Quick start command:"
echo "npx -y mcp-remote https://mcp.atlassian.com/v1/sse &"
echo ""
echo "🔍 To verify the connection is working:"
echo "ps aux | grep mcp-remote"