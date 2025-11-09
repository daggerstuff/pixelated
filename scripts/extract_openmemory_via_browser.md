# OpenMemory Browser Extraction Guide

Follow the same approach we used for ByteRover MCP - extract memories via browser/Cursor, then import to ByteRover CLI.

## Method 1: Using OpenMemory Dashboard (Recommended)

### Step 1: Access OpenMemory Dashboard

1. **Go to OpenMemory Dashboard**:
   - Visit [app.openmemory.dev](https://app.openmemory.dev/)
   - Log in with your account (the one with API key `om-8u4kpiwqmus434epjpsdeuk86o7mnrgg`)

2. **Navigate to Memories**:
   - Look for a "Memories" or "Memory" section in the dashboard
   - This should show all your stored memories

### Step 2: Export Memories

**Option A: If Dashboard has Export Feature**
- Look for an "Export" or "Download" button
- Export all memories as JSON
- Save the file as `openmemory_export.json`

**Option B: If Dashboard shows memories in a list/table**
- You can manually copy the data
- Or use browser developer tools to extract the data (see below)

**Option C: Using Browser Developer Tools**
1. Open browser developer tools (F12)
2. Go to the Network tab
3. Navigate to the memories page in OpenMemory dashboard
4. Look for API calls that fetch memories
5. Copy the response JSON
6. Save as `openmemory_export.json`

### Step 3: Import to ByteRover CLI

Once you have the export file:

```bash
# Dry run first
uv run python scripts/migrate_openmemory_to_byterover.py \
  --import-file openmemory_export.json \
  --dry-run

# Actual import
uv run python scripts/migrate_openmemory_to_byterover.py \
  --import-file openmemory_export.json
```

## Method 2: Using OpenMemory MCP Tools in Cursor

If OpenMemory is configured as an MCP server in Cursor (similar to ByteRover MCP):

### Step 1: Check MCP Configuration

Check if OpenMemory MCP is configured in `.cursor/mcp.json`. If not, you might need to add it.

### Step 2: Extract Memories via Cursor

In Cursor, ask the AI assistant:

```
Please retrieve all memories from OpenMemory using the OpenMemory MCP tools.
Use list_memories or search_memory tools to get all memories.
Try multiple queries if needed:
- Empty query or "*" to get all
- "memory"
- "best practices"
- "error"
- etc.

Format all results as a JSON array with this structure:
{
  "memories": [
    {
      "id": "memory-id",
      "content": "memory content",
      "tags": ["tag1", "tag2"],
      "category": "best-practice",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}

Save the results to openmemory_export.json in the project root.
```

### Step 3: Import to ByteRover CLI

```bash
uv run python scripts/migrate_openmemory_to_byterover.py \
  --import-file openmemory_export.json
```

## Method 3: Manual Browser Extraction Script

If the dashboard shows memories but doesn't have an export feature, you can use a browser console script:

### Step 1: Open OpenMemory Dashboard

1. Go to [app.openmemory.dev](https://app.openmemory.dev/)
2. Log in and navigate to your memories

### Step 2: Run Browser Console Script

Open browser developer tools (F12) and go to Console tab, then run:

```javascript
// Extract all memories from OpenMemory dashboard
// This script should be run in the browser console on the OpenMemory dashboard

async function extractOpenMemoryMemories() {
  const memories = [];
  
  // Try to find memories in the page
  // Adjust selectors based on OpenMemory dashboard structure
  const memoryElements = document.querySelectorAll('[data-memory], .memory-item, .memory-card');
  
  memoryElements.forEach((el, index) => {
    const memory = {
      id: el.dataset.id || el.id || `memory-${index}`,
      content: el.textContent || el.innerText || '',
      // Extract other fields as available
    };
    memories.push(memory);
  });
  
  // If memories are loaded via API, try to intercept the API response
  // Or look for them in the page's JavaScript state
  
  // Download as JSON
  const dataStr = JSON.stringify({ memories }, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'openmemory_export.json';
  link.click();
  
  console.log(`Extracted ${memories.length} memories`);
  return memories;
}

// Run the extraction
extractOpenMemoryMemories();
```

**Note**: You may need to adjust the selectors based on how OpenMemory dashboard displays memories.

## Expected JSON Format

The export file should have this structure (similar to ByteRover MCP export):

```json
{
  "memories": [
    {
      "id": "memory-id-1",
      "content": "Memory content here",
      "tags": ["tag1", "tag2"],
      "category": "best-practice",
      "createdAt": "2025-01-01T00:00:00Z",
      "metadata": {}
    }
  ]
}
```

Or as a simple array:

```json
[
  {
    "id": "memory-id-1",
    "content": "Memory content",
    "tags": ["tag1"],
    "createdAt": "2025-01-01T00:00:00Z"
  }
]
```

## Troubleshooting

### "No export feature in dashboard"
- Use browser developer tools to extract data from API calls
- Use browser console script to extract from page
- Check if OpenMemory has MCP tools available

### "Can't find memories in page"
- Check browser Network tab for API calls
- Look for JavaScript variables containing memory data
- Try different page views (list view, table view, etc.)

### "Export format doesn't match"
- The migration script handles multiple formats
- It will try to extract `content`, `tags`, `category`, etc. from various fields
- As long as there's a `content` field (or `memory`, `text`, etc.), it should work

## Next Steps

1. **Try Method 1 first** (Dashboard export) - Easiest if available
2. **If not available, try Method 2** (MCP tools in Cursor)
3. **If neither works, try Method 3** (Browser console script)
4. **Once you have the JSON file**, use the migration script to import

## Success!

Once you have `openmemory_export.json`, the migration will work the same way as ByteRover MCP:

```bash
# The script is already tested and ready
uv run python scripts/migrate_openmemory_to_byterover.py \
  --import-file openmemory_export.json
```

Just like we did with ByteRover MCP - extract via browser, then import! 🎉

