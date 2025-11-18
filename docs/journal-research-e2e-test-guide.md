# Journal Research Pipeline - End-to-End Test Guide

## Overview

This guide provides step-by-step instructions for testing the complete Journal Research Pipeline workflow across all three interfaces (Web Frontend, MCP Server, and CLI).

## Prerequisites

1. **All services running**:
   - API Server: `uv run python -m ai.journal_dataset_research.api.server` (port 8000)
   - Frontend: `pnpm dev` (port 4321)
   - MCP Server (optional): `uv run python -m ai.journal_dataset_research.mcp.server` (port 8001)

2. **Environment variables set**:
   - `SESSION_STORAGE_PATH` (optional, defaults to `ai/journal_dataset_research/sessions`)
   - `PUBLIC_JOURNAL_RESEARCH_API_URL` (optional, defaults to `http://localhost:8000/api/journal-research`)

3. **Authentication** (if enabled):
   - Valid JWT token or API key
   - User account with appropriate permissions

## Test Scenario 1: Web Frontend Workflow

### Step 1: Access Dashboard

1. Navigate to `http://localhost:4321/journal-research`
2. Verify:
   - Page loads with DashboardLayout
   - Sidebar shows "Research" section with "Journal Research" expanded
   - Dashboard component displays
   - No console errors

### Step 2: Create Session

1. Click "New Session" or navigate to Sessions page
2. Fill in session form:
   - Target Sources: `["pubmed", "doaj"]`
   - Search Keywords: `{"therapeutic": ["therapy", "counseling"]}`
   - Weekly Targets: `{"sources_identified": 10, "datasets_evaluated": 5}`
3. Click "Create Session"
4. Verify:
   - Session appears in session list
   - Session ID is generated
   - Progress metrics show 0 for all values

### Step 3: Initiate Discovery

1. Navigate to Discovery page or use session detail page
2. Select the created session
3. Click "Start Discovery"
4. Verify:
   - Discovery operation starts
   - Progress updates appear in real-time (WebSocket connection)
   - Sources are discovered and displayed
   - Progress metrics update

### Step 4: Evaluate Sources

1. Navigate to Evaluation page
2. Select sources to evaluate
3. Click "Evaluate Sources"
4. Verify:
   - Evaluation completes
   - Scores displayed (therapeutic relevance, data structure, etc.)
   - Priority tiers assigned (high, medium, low)
   - Progress metrics update

### Step 5: Acquire Datasets

1. Navigate to Acquisition page
2. Select high-priority evaluated sources
3. Click "Acquire Datasets"
4. Verify:
   - Acquisition requests created
   - Download progress tracked (if applicable)
   - Acquired datasets stored
   - Progress metrics update

### Step 6: Create Integration Plans

1. Navigate to Integration page
2. Select acquired datasets
3. Click "Create Integration Plans"
4. Verify:
   - Integration plans generated
   - Complexity estimates shown
   - Preprocessing scripts available
   - Progress metrics update

### Step 7: Generate Report

1. Navigate to Reports page
2. Select session
3. Choose report type and format
4. Click "Generate Report"
5. Verify:
   - Report generated successfully
   - Report content displays correctly
   - Can export/download report

## Test Scenario 2: MCP Server Workflow

### Step 1: Connect MCP Client

1. Configure MCP client to connect to server
2. Verify:
   - Connection established
   - Tools listed correctly
   - Resources accessible
   - Prompts available

### Step 2: Create Session via MCP

1. Call `create_session` tool:
   ```json
   {
     "target_sources": ["pubmed", "doaj"],
     "search_keywords": {"therapeutic": ["therapy", "counseling"]},
     "weekly_targets": {"sources_identified": 10}
   }
   ```
2. Verify:
   - Session created successfully
   - Session ID returned
   - Session appears in web frontend

### Step 3: Discover Sources via MCP

1. Call `discover_sources` tool with session_id
2. Verify:
   - Discovery operation starts
   - Progress updates via resources
   - Sources returned
   - Sources appear in web frontend

### Step 4: Query Progress via MCP Resource

1. Access `progress://metrics/{session_id}` resource
2. Verify:
   - Current progress metrics returned
   - Metrics match web frontend display
   - Updates reflect latest state

## Test Scenario 3: CLI Workflow

### Step 1: Create Session via CLI

```bash
uv run python -m ai.journal_dataset_research.cli.entry_point search \
  --keywords therapy counseling \
  --sources pubmed doaj \
  --session-id test-session-001
```

Verify:
- Session created
- Session file saved to storage path
- Session appears in web frontend and MCP server

### Step 2: Check Status via CLI

```bash
uv run python -m ai.journal_dataset_research.cli.entry_point status \
  --session-id test-session-001
```

Verify:
- Status displays correctly
- Progress metrics shown
- Matches other interfaces

## Test Scenario 4: Cross-Component Access

### Test: Create in Web, Access via MCP

1. Create session via web frontend
2. Query same session via MCP `get_session` tool
3. Verify:
   - Session data matches
   - All fields consistent

### Test: Create in CLI, Access via Web

1. Create session via CLI
2. Refresh web frontend
3. Verify:
   - Session appears in list
   - Can view session details
   - Can perform operations

### Test: Concurrent Operations

1. Start discovery via web frontend
2. Query progress via MCP resource simultaneously
3. Verify:
   - No conflicts
   - Progress updates consistent
   - No data corruption

## Test Scenario 5: Error Handling

### Test: API Server Down

1. Stop API server
2. Attempt operation in web frontend
3. Verify:
   - Graceful error message displayed
   - No application crash
   - Error is user-friendly

### Test: Invalid Session ID

1. Attempt to access non-existent session
2. Verify:
   - 404 error returned
   - Error message clear
   - No stack trace exposed

### Test: Network Interruption

1. Start long-running operation
2. Disconnect network briefly
3. Verify:
   - WebSocket reconnects
   - Operation resumes
   - No data loss

## Verification Checklist

After completing all test scenarios, verify:

- [ ] All three interfaces can create sessions
- [ ] Sessions are shared across all interfaces
- [ ] Progress updates work in real-time
- [ ] WebSocket connections establish and reconnect
- [ ] Error handling is graceful and user-friendly
- [ ] Navigation works from all entry points
- [ ] Theme is consistent across all pages
- [ ] All links are accessible
- [ ] Documentation is accurate and complete

## Troubleshooting

### WebSocket Connection Failed

- Check API server is running on port 8000
- Verify CORS configuration allows frontend origin
- Check browser console for connection errors
- Verify authentication token is valid

### Session Not Found

- Verify session storage path is consistent
- Check file permissions on session directory
- Ensure session ID is correct
- Check logs for errors

### Progress Not Updating

- Verify WebSocket connection is active
- Check backend orchestrator is processing operations
- Verify progress streaming is enabled
- Check browser DevTools Network tab

### MCP Tool Execution Failed

- Verify CommandHandlerService is initialized
- Check session storage path matches
- Verify authentication and permissions
- Check MCP server logs

## Success Criteria

All tests pass when:

1. ✅ Complete workflow executes via web UI
2. ✅ MCP server can access same sessions
3. ✅ CLI can create and query sessions
4. ✅ All interfaces show consistent data
5. ✅ Real-time updates work correctly
6. ✅ Error handling is graceful
7. ✅ Navigation is accessible
8. ✅ Theme is consistent

---

**Last Updated**: January 2025  
**Tested With**: Python 3.11+, Node.js 24+, Astro 5.x, React 19.x

