# Atlassian MCP Server Setup for opencode

This directory contains the setup and configuration for connecting opencode to the Atlassian MCP Server, enabling integration with Jira and Confluence.

## Quick Setup

1. **Run the setup script:**
   ```bash
   ./scripts/setup-atlassian-mcp.sh
   ```

2. **Complete OAuth authorization:**
   - A browser window will open automatically
   - Log in with your Atlassian credentials
   - Approve the required permissions

3. **Verify connection:**
   ```bash
   npx -y mcp-remote https://mcp.atlassian.com/v1/sse
   ```

## Configuration Files

- `ai/mcp.json` - MCP server configuration
- `mcp_config.json` - Alternative configuration location

## Available Tools

Once connected, you'll have access to:
- **Jira Operations:** Search, create, and update issues
- **Confluence Operations:** Create, edit, and summarize pages
- **Content Management:** Bulk processing and automation
- **Search & Discovery:** Find relevant content across Jira and Confluence

## Prerequisites

- Node.js v18+ (✅ v24.12.0 installed)
- Atlassian Cloud site with Jira/Confluence access
- Modern browser for OAuth authorization

## Security

- All traffic encrypted via HTTPS (TLS 1.2+)
- OAuth 2.1 secure authentication
- Respects existing user permissions
- No credentials stored locally

## Troubleshooting

If connection fails:
1. Verify Node.js version: `node --version`
2. Check network connectivity
3. Ensure Atlassian Cloud access
4. Review OAuth permissions

## Support

- [Atlassian MCP Server Documentation](https://github.com/atlassian/atlassian-mcp-server)
- [Atlassian Support Portal](https://support.atlassian.com/)
- [Community Forum](https://community.atlassian.com/)