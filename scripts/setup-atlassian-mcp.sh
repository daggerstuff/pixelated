#!/bin/bash

# Atlassian MCP Server Setup Script for opencode
# This script sets up the Atlassian MCP connection for opencode

echo "🔧 Setting up Atlassian MCP Server connection for opencode..."

# Check Node.js version
NODE_VERSION=$(node --version 2>/dev/null)
if [ $? -ne 0 ]; then
    echo "❌ Node.js is not installed. Please install Node.js v18+ first."
    exit 1
fi

echo "✅ Node.js version: $NODE_VERSION"

# Initialize MCP connection (this will open browser for OAuth)
echo "🌐 Initializing Atlassian MCP connection..."
echo "📝 A browser window will open for Atlassian authorization."
echo "🔑 Please complete the OAuth flow to authorize access."

# Start mcp-remote proxy
npx -y mcp-remote https://mcp.atlassian.com/v1/sse &
MCP_PID=$!

echo "🔄 MCP proxy started with PID: $MCP_PID"
echo "⏳ Waiting for authorization completion..."

# Wait a bit for user to complete authorization
sleep 10

# Check if MCP process is still running
if kill -0 $MCP_PID 2>/dev/null; then
    echo "✅ MCP connection established successfully!"
    echo "📋 Configuration saved to ai/mcp.json"
    echo ""
    echo "🎯 Next steps:"
    echo "1. Complete OAuth authorization in browser if not already done"
    echo "2. Test the connection with your MCP client"
    echo "3. Use Jira and Confluence tools through the MCP interface"
    echo ""
    echo "🔧 Available tools will include:"
    echo "  • Jira issue search and management"
    echo "  • Confluence page operations"
    echo "  • Content summarization and creation"
    echo ""
    echo "📖 For more information, visit:"
    echo "  https://github.com/atlassian/atlassian-mcp-server"
else
    echo "⚠️  MCP connection process ended. Please check the authorization."
fi

# Cleanup
kill $MCP_PID 2>/dev/null

echo "✅ Setup complete!"