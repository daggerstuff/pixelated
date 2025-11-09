# OpenMemory Network Tab Extraction (Manual Method)

Since the automatic script didn't find memories, let's extract them manually from the Network tab.

## Step-by-Step Instructions

### Step 1: Open OpenMemory Dashboard

1. Go to [app.openmemory.dev](https://app.openmemory.dev/)
2. Log in with your account
3. Navigate to the page that shows your memories

### Step 2: Open Network Tab

1. Open browser developer tools (F12)
2. Go to the **Network** tab
3. **Clear** the network log (click the clear button 🚫)
4. **Refresh the page** (F5) or navigate to the memories page

### Step 3: Find the API Call

Look for network requests that might contain memory data:

**Look for requests with:**
- URL containing: `memory`, `memories`, `mem0`, `api`, `v1`, `v2`
- Method: `GET`, `POST`, or `FETCH`
- Type: `xhr`, `fetch`, or `json`

**Common patterns to look for:**
- `/api/memories`
- `/api/v1/memories`
- `/api/v2/memories`
- `/memories`
- `/v1/memories`
- `/v2/memories`
- `/graphql` (if using GraphQL)
- `/query` (if using GraphQL)

### Step 4: Inspect the Response

1. **Click on the request** that looks like it's loading memories
2. Go to the **Response** or **Preview** tab
3. You should see JSON data with your memories

### Step 5: Copy the Response

1. **Right-click** on the response data
2. Select **Copy** → **Copy response**
3. Or select all (Ctrl+A) and copy (Ctrl+C)

### Step 6: Save as JSON File

1. Open a text editor
2. Paste the copied data
3. Save as `openmemory_export.json`
4. Make sure it's valid JSON (you can validate at jsonlint.com)

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

## Alternative: Use the Enhanced Debug Script

Run the enhanced debug script first to get more information:

1. Go to OpenMemory dashboard
2. Open Console tab (F12)
3. Copy and paste the script from `scripts/extract_openmemory_browser_debug.js`
4. Run it
5. Check the console output for clues
6. Check the downloaded `openmemory_export_debug.json` for debug info

## What to Look For in Network Tab

### Request Headers
Look for:
- `Authorization: Bearer ...`
- `X-API-Key: ...`
- `Cookie: ...`

### Response Structure
The response might be:
```json
{
  "memories": [...],
  "results": [...],
  "data": [...],
  "items": [...]
}
```

Or just an array:
```json
[...]
```

## Troubleshooting

**"Can't find any API calls"**
- Make sure you're on the memories page
- Try interacting with the page (scroll, click filters, etc.)
- Check if data loads via WebSocket (look for WS connections)
- Check if data is server-side rendered (view page source)

**"Response is empty"**
- Check if you need to be authenticated
- Try clicking "Load More" or pagination buttons
- Check if memories are loaded on demand

**"Response format is different"**
- The migration script handles multiple formats
- As long as there's memory content, it should work
- You can manually reformat if needed

## Quick Check: Is Data Already on the Page?

Before checking Network tab, try this in Console:

```javascript
// Check if memories are in the page HTML
document.body.innerText.includes('memory') 

// Check for JSON data in script tags
Array.from(document.querySelectorAll('script')).forEach(s => {
  if (s.textContent.includes('memory') || s.textContent.includes('memories')) {
    console.log('Found script with memory data:', s.textContent.substring(0, 200));
  }
});

// Check for data attributes
document.querySelectorAll('[data-memory], [data-memories]').length
```

## Success!

Once you extract the memories from Network tab and save as JSON, the migration script will handle the rest - just like we did with ByteRover MCP! 🎉

