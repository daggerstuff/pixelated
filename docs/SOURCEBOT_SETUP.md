# Sourcebot MCP Server Setup

## Overview
Sourcebot provides an MCP (Model Context Protocol) server that enables LLMs to search and analyze your entire codebase. This setup allows Cursor, Windsurf, VS Code, and other MCP clients to have deep context over your project.

## Setup Steps

### 1. Start Sourcebot
The Sourcebot Docker container should be running on port 3001:
```bash
docker run -d -p 3001:3000 -v $(pwd):/data -e CONFIG_PATH=/data/sourcebot-config.json --name sourcebot-pixel ghcr.io/sourcebot-dev/sourcebot:latest
```

### 2. Complete Onboarding
1. Navigate to http://localhost:3001
2. Complete the onboarding flow
3. Create an account with email/password

### 3. Create API Key
1. Login to your Sourcebot instance
2. Navigate to **Settings -> API Keys**
3. Create a new API key
4. Add the API key to your `.env` file as `SOURCEBOT_API_KEY=your-actual-api-key`

### 4. Configure MCP Client

#### For Cursor:
1. Go to: `Settings` -> `Cursor Settings` -> `MCP` -> `Add new global MCP server`
2. Add the configuration from `mcp-sourcebot-config.json`
3. Make sure your `.env` file contains `SOURCEBOT_API_KEY=your-actual-api-key`

#### For Windsurf:
1. Go to: `Windsurf Settings` -> `Cascade` -> `Add Server` -> `Add Custom Server`
2. Add the configuration from `mcp-sourcebot-config.json`
3. Make sure your `.env` file contains `SOURCEBOT_API_KEY=your-actual-api-key`

#### For VS Code:
1. Create `.vscode/mcp.json` in your project root
2. Add the configuration from `mcp-sourcebot-config.json` (adjust format for VS Code)
3. Make sure your `.env` file contains `SOURCEBOT_API_KEY=your-actual-api-key`

### 5. Usage
Once configured, you can prompt your LLM with:
- "use sourcebot to search for authentication code"
- "use sourcebot to find all React components"
- "use sourcebot to analyze the database schema"

## Available Tools
- `search_code`: Search for code patterns using regex
- `list_repos`: List all indexed repositories
- `get_file_source`: Get source code for specific files

## Configuration Files
- `sourcebot-config.json`: Sourcebot repository configuration
- `mcp-sourcebot-config.json`: MCP server configuration template

## Troubleshooting
- Ensure Sourcebot is accessible at http://localhost:3001
- Verify your API key is correct
- Check that the MCP configuration is properly formatted
- Restart your IDE after adding MCP configuration
