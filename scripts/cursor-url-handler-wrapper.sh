#!/bin/bash
# Wrapper script to handle cursor:// URLs and prevent OAuth callbacks from opening as files
# This script intercepts cursor:// URLs and only blocks malformed file paths

URL="$1"

# Check if this is a malformed FILE PATH that looks like /home/vivi/cursor:/...
# This happens when Cursor incorrectly interprets OAuth callback URLs as file paths
# We ONLY block these malformed paths, NOT proper cursor:// URLs
if echo "$URL" | grep -qE "^/home/.*cursor:.*oauth.*callback"; then
    # This is a malformed file path - exit silently to prevent opening as file
    exit 0
fi

# Check if this is a proper cursor:// URL (starts with cursor://)
# These should be passed through to Cursor normally, even if they're OAuth callbacks
if echo "$URL" | grep -qE "^cursor://"; then
    # This is a proper cursor:// URL - pass it to Cursor
    /usr/share/cursor/cursor --open-url "$URL" 2>/dev/null &
    exit 0
fi

# Check if URL starts with /home/ and contains cursor: - this is a malformed path
# Convert it to proper cursor:// format and pass it through
if echo "$URL" | grep -qE "^/home/.*cursor:"; then
    # Convert malformed path to proper cursor:// URL
    FIXED_URL=$(echo "$URL" | sed 's|^/home/[^/]*/cursor:|cursor://|')
    # Pass the fixed URL to Cursor
    /usr/share/cursor/cursor --open-url "$FIXED_URL" 2>/dev/null &
    exit 0
fi

# For all other cases, pass to Cursor normally
if [ -n "$URL" ]; then
    /usr/share/cursor/cursor --open-url "$URL" 2>/dev/null &
else
    /usr/share/cursor/cursor 2>/dev/null &
fi

exit 0

