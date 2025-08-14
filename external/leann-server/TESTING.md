# LEANN MCP Server Testing Guide

## 1. Build the MCP Server

```bash
cd external/leann-server
pnpm install
pnpm run build
```

## 2. Run the MCP Server

```bash
node build/index.js
```
Or, for MCP Inspector debugging:
```bash
npm run inspector
```

## 3. Test MCP Tools

You can use the MCP Inspector (browser UI) or any MCP client to call these tools:

- **List indexes**
  ```
  Tool: leann_list
  Input: {}
  ```

- **Semantic search**
  ```
  Tool: leann_search
  Input: { "indexId": "default", "query": "your search query" }
  ```

- **Ask (RAG Q&A)**
  ```
  Tool: leann_ask
  Input: { "indexId": "default", "question": "your question" }
  ```

## 4. Example CLI Test

```bash
leann list
leann search default "example query"
leann ask default "example question"
```

## 5. Troubleshooting

- Ensure the `leann` CLI is globally available (`uv tool install leann`).
- Use `npm run inspector` for interactive debugging.
- Check logs for errors and ensure indexes exist in `~/.leann/indexes/`.
