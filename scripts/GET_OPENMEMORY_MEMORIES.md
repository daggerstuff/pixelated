# Get OpenMemory Memories (Not Categories!)

You currently have **categories** exported, but we need the actual **memory content**.

## What You Have vs What We Need

### ❌ What You Have (Categories)
```json
{
  "categories": [
    {
      "name": "documentation correction",
      "description": "Automatically created category..."
    }
  ],
  "total": 260
}
```
**This is just category names - no actual memory content!**

### ✅ What We Need (Memories)
```json
{
  "memories": [
    {
      "content": "When writing documentation, always verify code examples...",
      "tags": ["documentation", "best-practice"],
      "category": "documentation correction",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```
**This is the actual memory content with text!**

## How to Get Actual Memories

### Method 1: Network Tab (Recommended)

1. **Go to OpenMemory Dashboard**:
   - Visit [app.openmemory.dev](https://app.openmemory.dev/)
   - Log in
   - **Navigate to the MEMORIES page** (where you see actual memory text, not just category names)

2. **Open Network Tab**:
   - Press F12 → **Network** tab
   - Clear the log
   - **Refresh the page**

3. **Find the Memories API Call**:
   - Look for requests that return **memory content** (not category names)
   - URLs might be: `/api/memories`, `/memories`, `/api/v1/memories`, etc.
   - **Check the Response** - it should contain actual text content, not just category names
   - The response should be **larger** (memory content is longer)

4. **Copy the Response**:
   - Click on the request
   - Go to **Preview** or **Response** tab
   - Right-click → **Copy response**
   - Save as `openmemory_memories_export.json`

### Method 2: Check Page Structure

Sometimes memories are displayed on the page. In the browser console:

```javascript
// Look for memory content on the page
console.log('Page URL:', window.location.href);
console.log('Page title:', document.title);

// Check for memory-related elements
const memoryElements = document.querySelectorAll('[class*="memory"], [data-memory]');
console.log('Memory elements found:', memoryElements.length);

// Try to extract text
Array.from(memoryElements).forEach((el, i) => {
  const text = el.textContent?.trim();
  if (text && text.length > 50) {
    console.log(`Memory ${i + 1}:`, text.substring(0, 200));
  }
});

// Check for JSON data in script tags
Array.from(document.querySelectorAll('script')).forEach((script, i) => {
  const text = script.textContent || script.innerText || '';
  if (text.includes('"content"') || text.includes('"memory"')) {
    console.log(`Script ${i} might contain memory data`);
    // Try to extract JSON
    try {
      const jsonMatch = text.match(/\{[^}]*"content"[^}]*\}/);
      if (jsonMatch) {
        console.log('Found JSON:', jsonMatch[0].substring(0, 200));
      }
    } catch (e) {}
  }
});
```

### Method 3: Use Enhanced Debug Script

1. Copy the script from `scripts/extract_openmemory_browser_debug.js`
2. Paste in browser console on OpenMemory dashboard
3. Check the output for clues about where memories are stored
4. Look for window variables, localStorage, or DOM elements with memory data

## Verify You Have Memories

Before importing, verify the file contains memory content:

```bash
# Check if file has memory content
python3 -c "
import json
data = json.load(open('openmemory_memories_export.json'))
memories = data.get('memories', data if isinstance(data, list) else [])

if not memories:
    print('❌ No memories found - file might contain categories only')
else:
    mem = memories[0] if memories else {}
    has_content = 'content' in mem or 'memory' in mem or 'text' in mem
    print(f'✅ Found {len(memories)} memories')
    print(f'Has content field: {has_content}')
    if has_content:
        content = mem.get('content') or mem.get('memory') or mem.get('text', '')
        print(f'Sample: {content[:200]}')
    else:
        print('❌ Memories don't have content field - might be categories')
"
```

## Import Once You Have Memories

Once you have the actual memories exported:

```bash
# Dry run first
uv run python scripts/migrate_openmemory_to_byterover.py \
  --import-file openmemory_memories_export.json \
  --dry-run

# Actual import
uv run python scripts/migrate_openmemory_to_byterover.py \
  --import-file openmemory_memories_export.json
```

## Key Differences

| Categories | Memories |
|------------|----------|
| Just names: "documentation correction" | Full content: "When writing docs, always verify..." |
| No text content | Has actual text/content |
| Just metadata | Has content + tags + metadata |
| 260 categories | Could be hundreds/thousands of memories |

## Success!

Once you export the actual memories (with content), the migration will work perfectly - just like ByteRover MCP! 🎉

The migration script is ready and waiting. You just need to get the actual memory content from OpenMemory dashboard!

