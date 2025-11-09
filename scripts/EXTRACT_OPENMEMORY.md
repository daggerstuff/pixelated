# Extract OpenMemory Memories (Same as ByteRover MCP)

Follow the exact same approach we used for ByteRover MCP - extract via browser, then import!

## Quick Steps

### Step 1: Extract Memories from OpenMemory Dashboard

1. **Go to OpenMemory Dashboard**:
   - Visit [app.openmemory.dev](https://app.openmemory.dev/)
   - Log in with your account

2. **Get all your memories**:
   - Navigate to the memories/list page
   - You should see all your stored memories

3. **Export the memories** (choose one method):

   **Option A: If dashboard has export button**
   - Click "Export" or "Download" 
   - Save as `openmemory_export.json`

   **Option B: Use browser console script** (Recommended)
   - Open browser developer tools (F12)
   - Go to Console tab
   - Copy and paste the script from `scripts/extract_openmemory_browser.js`
   - Run it
   - It will automatically download `openmemory_export.json`

   **Option C: Use Cursor AI** (if OpenMemory has MCP tools)
   - In Cursor, ask AI: "Please retrieve all memories from OpenMemory and save to openmemory_export.json"

   **Option D: Manual copy from Network tab**
   - Open browser developer tools (F12)
   - Go to Network tab
   - Navigate to memories page
   - Find the API call that loads memories
   - Copy the response JSON
   - Save as `openmemory_export.json`

### Step 2: Import to ByteRover CLI

Once you have `openmemory_export.json`:

```bash
# Dry run first (preview)
uv run python scripts/migrate_openmemory_to_byterover.py \
  --import-file openmemory_export.json \
  --dry-run

# Actual import
uv run python scripts/migrate_openmemory_to_byterover.py \
  --import-file openmemory_export.json
```

That's it! Same process as ByteRover MCP. 🎉

## Browser Console Script

If you want to use the browser console script:

1. Go to [app.openmemory.dev](https://app.openmemory.dev/) and log in
2. Navigate to your memories page
3. Open browser developer tools (F12) → Console tab
4. Copy the entire script from `scripts/extract_openmemory_browser.js`
5. Paste and run it in the console
6. It will download `openmemory_export.json` automatically

## Expected Result

After import, you'll see:
- All OpenMemory memories imported to ByteRover CLI
- Organized into sections (Best Practices, Common Errors, etc.)
- Tags and metadata preserved
- Ready to push to cloud with `brv push`

## Troubleshooting

**"Can't find memories in dashboard"**
- Check you're logged into the right account
- Look for "Memories", "Memory", or "Knowledge" section
- Try different views (list, table, etc.)

**"Browser script doesn't work"**
- Make sure you're on the memories page
- Check browser console for errors
- Try Option D (Network tab) instead

**"Export format doesn't match"**
- The migration script handles multiple formats
- As long as there's a `content` field, it should work
- Check the JSON structure matches the expected format

## Next Steps After Import

```bash
# Verify memories are imported
brv status

# Test retrieval
brv retrieve --query "test"

# Push to cloud
brv push
```

Just like ByteRover MCP - extract via browser, import with script! 🚀

