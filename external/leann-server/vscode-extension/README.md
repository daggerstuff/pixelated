# LEANN MCP VSCode Extension

This extension provides a thin UI bridge between VSCode and the LEANN MCP server, enabling semantic search and RAG Q&A from the editor.

## Features

- Connects to the LEANN MCP server via stdio or TCP
- UI commands for:
  - List available indexes
  - Semantic search
  - Ask questions (RAG)
- Displays results in a VSCode panel

## Usage

1. Ensure the LEANN MCP server is running (`node build/index.js`).
2. Install the extension in VSCode.
3. Use the command palette:
   - "LEANN: List Indexes"
   - "LEANN: Semantic Search"
   - "LEANN: Ask Question"
4. Results will appear in the LEANN panel.

## Development

- Extension source: `external/leann-server/vscode-extension/`
- Scaffold with `yo code` or use the provided template.
- Connect to MCP server using Node.js child_process or TCP socket.

## Example Command Registration

```typescript
vscode.commands.registerCommand('leann.listIndexes', async () => {
  // Call MCP server tool 'leann_list'
});
```

## Next Steps

- Scaffold extension with `yo code`
- Implement MCP client logic
- Add UI panel for results
