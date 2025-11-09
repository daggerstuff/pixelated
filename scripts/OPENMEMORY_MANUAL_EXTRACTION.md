# OpenMemory Manual Extraction Guide

The automatic script couldn't find memories because OpenMemory uses different API endpoints. Let's extract them manually from the Network tab.

## Quick Steps

### Step 1: Open OpenMemory Dashboard
1. Go to [app.openmemory.dev](https://app.openmemory.dev/)
2. Log in
3. Navigate to the page showing your memories

### Step 2: Open Network Tab
1. Press **F12** to open developer tools
2. Click on the **Network** tab
3. Click the **Clear** button (🚫) to clear existing requests
4. **Refresh the page** (F5) or navigate to memories page

### Step 3: Find the Memory Data Request

Look through the network requests for:

**What to look for:**
- Requests with type: `xhr`, `fetch`, `json`, or `document`
- URLs containing: `memory`, `memories`, `api`, `v1`, `v2`, `query`, `graphql`
- Requests that return JSON data
- Requests that happen when the page loads or when you scroll

**Tips:**
- Filter by "XHR" or "Fetch" to see only API calls
- Look for requests with status 200 (success)
- Check the "Size" column - memory data will be larger
- Try scrolling or clicking "Load More" to trigger more requests

### Step 4: Inspect the Response

1. **Click on a request** that looks promising
2. Go to the **Preview** or **Response** tab
3. Look for JSON data with memory content
4. The data might be nested (e.g., `data.memories`, `results.items`, etc.)

### Step 5: Copy the Response

1. **Right-click** on the response JSON
2. Select **Copy** → **Copy response**
3. Or select all (Ctrl+A) and copy (Ctrl+C)

### Step 6: Save and Format

1. Open a text editor
2. Paste the data
3. If it's not an array, wrap it like this:
   ```json
   {
     "memories": [PASTE_DATA_HERE]
   }
   ```
4. Save as `openmemory_export.json`
5. Validate JSON at jsonlint.com if needed

### Step 7: Import to ByteRover CLI

```bash
# Dry run first
uv run python scripts/migrate_openmemory_to_byterover.py \
  --import-file openmemory_export.json \
  --dry-run

# Actual import
uv run python scripts/migrate_openmemory_to_byterover.py \
  --import-file openmemory_export.json
```

## Enhanced Debug Script

Try running the enhanced debug script first to get more clues:

1. Copy the script from `scripts/extract_openmemory_browser_debug.js`
2. Paste it in the browser console
3. Run it
4. Check the console output for clues about:
   - What window variables exist
   - What's in localStorage/sessionStorage
   - What DOM elements are found
   - What the page structure looks like

## Alternative: Check Page Source

Sometimes memories are embedded in the page HTML:

1. Right-click on the page → **View Page Source**
2. Search for: `memory`, `memories`, `mem0`
3. Look for `<script>` tags with JSON data
4. Copy any JSON data you find
5. Save as `openmemory_export.json`

## What the Response Might Look Like

The response could be in various formats:

**Format 1: Array**
```json
[
  {
    "id": "mem-123",
    "content": "Memory content...",
    "tags": ["tag1"],
    "createdAt": "2025-01-01T00:00:00Z"
  }
]
```

**Format 2: Object with array**
```json
{
  "memories": [...],
  "results": [...],
  "data": [...],
  "items": [...]
}
```

**Format 3: Paginated**
```json
{
  "results": [...],
  "next": "...",
  "page": 1,
  "total": 100
}
```

The migration script handles all these formats!

## Quick Console Check

Before checking Network tab, try this in Console to see what's available:

```javascript
// Check page title and URL
console.log('URL:', window.location.href);
console.log('Title:', document.title);

// Check for memory-related text on page
console.log('Page contains "memory":', document.body.innerText.includes('memory'));

// Check all script tags
Array.from(document.querySelectorAll('script')).forEach((s, i) => {
  const text = s.textContent || s.innerText || '';
  if (text.length > 100 && (text.includes('memory') || text.includes('memories'))) {
    console.log(`Script ${i} might contain memory data:`, text.substring(0, 200));
  }
});

// Check for data in common storage
console.log('LocalStorage:', Object.keys(localStorage));
console.log('SessionStorage:', Object.keys(sessionStorage));
```

## Success!

Once you find the memory data in Network tab and save it as JSON, the migration script will handle the rest - just like ByteRover MCP! 🎉

The key is finding the actual API endpoint OpenMemory uses. Check the Network tab when the page loads - that's where you'll find it!

