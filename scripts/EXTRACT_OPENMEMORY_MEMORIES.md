# Extract OpenMemory Memories (Not Categories!)

You exported **categories** (260 categories), but we need the actual **memories** (the memory content itself).

## What You Have Now

The current export (`openmemory_export.json`) contains:
- `categories`: Array of category definitions (260 categories)
- `total`: 260 (number of categories)
- `user_id`: "chad864"

**This is NOT what we need!** We need the actual memory content.

## What We Need

We need to export the **memories** themselves, which should look like:

```json
{
  "memories": [
    {
      "id": "memory-id-1",
      "content": "Actual memory content here...",
      "tags": ["tag1", "tag2"],
      "category": "category-name",
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "memory-id-2",
      "content": "Another memory...",
      "tags": ["tag3"],
      "category": "another-category",
      "createdAt": "2025-01-02T00:00:00Z"
    }
  ]
}
```

## How to Extract Actual Memories

### Step 1: Go to OpenMemory Dashboard

1. Go to [app.openmemory.dev](https://app.openmemory.dev/)
2. Log in
3. **Navigate to the MEMORIES page** (not categories)
   - Look for "Memories", "My Memories", "Memory List", etc.
   - This should show the actual memory content, not just category names

### Step 2: Open Network Tab

1. Open browser developer tools (F12)
2. Go to **Network** tab
3. **Clear** the network log
4. **Refresh the page** or navigate to memories page

### Step 3: Find the Memories API Call

Look for network requests that load the actual memory content:

**What to look for:**
- Requests that return memory **content** (not just category names)
- URLs like: `/api/memories`, `/memories`, `/api/v1/memories`, etc.
- Response should contain `content`, `memory`, or `text` fields
- Response should be larger (memory content is longer than category names)

**Tips:**
- Filter by "XHR" or "Fetch"
- Look for requests that happen when the page loads
- Check the Response/Preview tab - it should show actual memory text content
- Try scrolling or pagination to trigger more requests

### Step 4: Copy the Response

1. Click on the request that contains memory content
2. Go to **Preview** or **Response** tab
3. You should see JSON with actual memory text (not just category names)
4. Right-click → **Copy response**
5. Save as `openmemory_memories_export.json`

### Step 5: Verify the Export

Check that the file contains memory content:

```bash
# Check the file
python3 -c "import json; data = json.load(open('openmemory_memories_export.json')); mem = data.get('memories', data if isinstance(data, list) else [])[0] if (data.get('memories') or (isinstance(data, list) and len(data) > 0)) else {}; print('Has content field:', 'content' in mem or 'memory' in mem or 'text' in mem); print('Sample:', str(mem.get('content', mem.get('memory', mem.get('text', ''))))[:200])"
```

### Step 6: Import to ByteRover CLI

```bash
# Dry run first
uv run python scripts/migrate_openmemory_to_byterover.py \
  --import-file openmemory_memories_export.json \
  --dry-run

# Actual import
uv run python scripts/migrate_openmemory_to_byterover.py \
  --import-file openmemory_memories_export.json
```

## Difference: Categories vs Memories

**Categories** (what you have now):
```json
{
  "name": "documentation correction",
  "description": "Automatically created category..."
}
```

**Memories** (what we need):
```json
{
  "content": "When writing documentation, always verify code examples work before publishing...",
  "tags": ["documentation", "best-practice"],
  "category": "documentation correction"
}
```

## Alternative: Check if Memories are on the Page

Sometimes memories are displayed on the page itself. Try this in the browser console:

```javascript
// Look for memory content on the page
const pageText = document.body.innerText;
const memoryMatches = pageText.match(/[A-Z][^.!?]{50,500}[.!?]/g);
console.log('Found', memoryMatches?.length || 0, 'potential memory snippets');

// Check for memory elements
const memoryElements = document.querySelectorAll('[class*="memory"], [data-memory]');
console.log('Found', memoryElements.length, 'memory elements');

// Try to extract text from memory elements
Array.from(memoryElements).forEach((el, i) => {
  const text = el.textContent?.trim();
  if (text && text.length > 20) {
    console.log(`Memory ${i}:`, text.substring(0, 100));
  }
});
```

## Success!

Once you export the actual memories (not categories), the migration script will import them just like ByteRover MCP! 🎉

The key is finding where OpenMemory displays the actual memory content, not just the category names.

