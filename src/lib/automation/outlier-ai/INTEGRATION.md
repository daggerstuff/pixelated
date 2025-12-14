# Browser Use MCP Integration Guide

## Overview

The Outlier AI automation system uses Browser Use MCP tools for browser automation. These tools are available through Cursor's MCP interface.

## Available MCP Tools

The system uses the following Browser Use MCP tools:

1. **mcp_cursor-ide-browser_browser_navigate** - Navigate to URLs
2. **mcp_cursor-ide-browser_browser_snapshot** - Get page content/accessibility tree
3. **mcp_cursor-ide-browser_browser_click** - Click elements
4. **mcp_cursor-ide-browser_browser_type** - Type text into fields
5. **mcp_cursor-ide-browser_browser_wait_for** - Wait for text/elements
6. **mcp_cursor-ide-browser_browser_hover** - Hover over elements
7. **mcp_cursor-ide-browser_browser_select_option** - Select dropdown options
8. **mcp_cursor-ide-browser_browser_press_key** - Press keyboard keys

## How It Works

### Current Implementation

The `BrowserManager` class currently has placeholder implementations that log what would be done. To make it fully functional, you need to:

1. **Call MCP tools directly** when running the orchestrator
2. **Use Cursor's MCP interface** to invoke the tools
3. **Parse snapshot results** to extract page content and find elements

### Integration Steps

#### Option 1: Direct MCP Calls (Recommended)

When running the orchestrator, you can call MCP tools directly:

```typescript
// In OutlierOrchestrator or a wrapper
import { mcp_cursor-ide-browser_browser_navigate } from '@mcp/browser-use'

// Navigate
await mcp_cursor-ide-browser_browser_navigate({ url: 'https://outlier.ai/login' })

// Get snapshot
const snapshot = await mcp_cursor-ide-browser_browser_snapshot()

// Click element
await mcp_cursor-ide-browser_browser_click({
  element: 'Login button',
  ref: 'button[type="submit"]'
})
```

#### Option 2: Update BrowserManager

Update `BrowserManager` methods to actually call MCP tools:

```typescript
async navigate(url: string): Promise<void> {
  // Call MCP tool
  await this.callMCPTool('browser_navigate', { url })
}

private async callMCPTool(tool: string, params: any): Promise<any> {
  // Implementation depends on how MCP is accessed in your environment
  // This might be through a global object, import, or API call
}
```

## Element Selection

Browser Use MCP uses accessibility snapshots, so element selection works differently:

- **By text content**: "Login button", "Submit form"
- **By ref**: Element references from snapshots
- **By role**: "button", "textbox", "link"

### Finding Elements

1. Take a snapshot to get the page structure
2. Parse the snapshot to find elements
3. Use element refs or descriptions for interactions

Example snapshot structure:
```
button "Login" [ref: abc123]
  textbox "Email" [ref: def456]
  textbox "Password" [ref: ghi789]
```

## Human-like Behavior

The system includes delays and human-like behavior:

- Random delays between actions (500-2000ms)
- Typing speed simulation (50-150ms per character)
- Natural pauses before form submission
- Mouse movement simulation (hover before click)

## Error Handling

Handle common issues:

1. **Element not found**: Retry with different selectors
2. **Page not loaded**: Wait longer or check network requests
3. **Login failed**: Verify credentials and page structure
4. **Rate limiting**: Add longer delays between actions

## Testing

Test the integration:

1. Start with simple navigation
2. Test form filling
3. Test element clicking
4. Test task completion flow
5. Monitor for errors

## Debugging

Enable verbose logging:

```typescript
// In BrowserManager
private verbose = true

async navigate(url: string): Promise<void> {
  if (this.verbose) {
    console.log('🧭 Navigating to:', url)
    console.log('📸 Taking snapshot before navigation...')
  }
  // ... implementation
}
```

## Next Steps

1. **Set up Browser Use MCP** in Cursor (if not already done)
2. **Test MCP tools** individually to ensure they work
3. **Update BrowserManager** to call actual MCP tools
4. **Test with Outlier AI** login and task claiming
5. **Iterate** based on actual page structure

## Notes

- Browser Use MCP tools are accessed through Cursor's MCP interface
- Element selection uses accessibility tree, not CSS selectors
- Snapshots provide structured page content
- All interactions should include human-like delays
