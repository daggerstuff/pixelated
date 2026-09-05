#!/usr/bin/env bash
#
# Mastra Code TUI Streaming Text Visibility Fix
#
# Bug: When a model emits text/reasoning between tool calls, getTrailingParts()
# returns [] (only returns parts after the LAST tool-invocation). queueActive is
# never called, buildRenderNodes never runs, and text is saved to DB but never
# rendered in the live TUI. Text only appears after restarting mastracode.
#
# Fix: When trailingParts.length === 0, queue text/reasoning parts that come
# AFTER the last SEEN tool call (state.seenToolCallIds), not ALL parts. This
# avoids duplicates across tool-call segments while rendering text that would
# otherwise be invisible.
#
# Affected: Mastra Code v0.38.0, Node v24.19.0
# Files:   tui-DrUt7rlK.js (ESM), tui-DpWB9pec.cjs (CJS)
#
# Usage:   bash patches/mastracode-tui-streaming-text-fix.sh
# Verify:  bash patches/mastracode-tui-streaming-text-fix.sh --check
# Revert:  bash patches/mastracode-tui-streaming-text-fix.sh --revert
#

set -euo pipefail

MASTRA_BIN="$(which mastracode 2>/dev/null || echo /home/vivi/.nvm/versions/node/v24.19.0/bin/mastracode)"
MASTRA_REAL="$(readlink -f "$MASTRA_BIN")"
MASTRA_DIR="${MASTRA_DIR:-$(dirname "$MASTRA_REAL")}"

ESM="${MASTRA_DIR}/tui-DrUt7rlK.js"
CJS="${MASTRA_DIR}/tui-DpWB9pec.cjs"

# --- The old code to find (in handleMessageUpdate) ---
OLD_UPDATE='else {
		const allTextParts = getRawParts(message).filter((p) => p.type === "text" || p.type === "reasoning");
		if (allTextParts.length > 0) state.assistantRenderRegistry.queueActive(message.id, withParts(message, allTextParts), () => {
			reconcileChatBoundarySpacers(state.chatContainer);
		});
	}'

# --- The new code to replace it with ---
NEW_UPDATE='else {
		const parts = message.content?.parts ?? [];
		let lastSeenToolIdx = -1;
		for (let i = 0; i < parts.length; i++) {
			if (parts[i].type === "tool-invocation" && state.seenToolCallIds.has(parts[i].toolCallId)) lastSeenToolIdx = i;
		}
		const newParts = parts.slice(lastSeenToolIdx + 1).filter((p) => p.type === "text" || p.type === "reasoning");
		if (newParts.length > 0) state.assistantRenderRegistry.queueActive(message.id, withParts(message, newParts), () => {
			reconcileChatBoundarySpacers(state.chatContainer);
		});
	}'

# --- The old code to find (in handleMessageEnd) ---
OLD_END='else {
			const allTextParts = getRawParts(message).filter((p) => p.type === "text" || p.type === "reasoning");
			if (allTextParts.length > 0) state.assistantRenderRegistry.queueActive(message.id, withParts(message, allTextParts), () => {
				reconcileChatBoundarySpacers(state.chatContainer);
			});'

# --- The new code to replace it with ---
NEW_END='else {
			const parts = message.content?.parts ?? [];
			let lastSeenToolIdx = -1;
			for (let i = 0; i < parts.length; i++) {
				if (parts[i].type === "tool-invocation" && state.seenToolCallIds.has(parts[i].toolCallId)) lastSeenToolIdx = i;
			}
			const newParts = parts.slice(lastSeenToolIdx + 1).filter((p) => p.type === "text" || p.type === "reasoning");
			if (newParts.length > 0) state.assistantRenderRegistry.queueActive(message.id, withParts(message, newParts), () => {
				reconcileChatBoundarySpacers(state.chatContainer);
			});'

# --- Helpers ---

patch_file() {
    local file="$1"
    local label="$2"

    if [ ! -f "$file" ]; then
        echo "  SKIP: $file not found"
        return 1
    fi

    # Check if already patched
    if grep -q 'lastSeenToolIdx' "$file" 2>/dev/null; then
        echo "  ALREADY PATCHED: $label"
        return 0
    fi

    # Check if the old code exists
    if ! grep -q 'allTextParts' "$file" 2>/dev/null; then
        echo "  SKIP: $label — old pattern not found (may be different mastracode version)"
        return 1
    fi

    # Create backup
    cp "$file" "${file}.bak.streamfix"
    echo "  Backed up to ${file}.bak.streamfix"

    # Apply patches using perl (handles multiline replacement reliably)
    # Patch handleMessageUpdate
    perl -0777 -i -pe "s/\Q${OLD_UPDATE}\E/${NEW_UPDATE//\//\\/}/g" "$file"

    # Patch handleMessageEnd
    perl -0777 -i -pe "s/\Q${OLD_END}\E/${NEW_END//\//\\/}/g" "$file"

    # Verify
    if grep -q 'lastSeenToolIdx' "$file" && ! grep -q 'allTextParts' "$file"; then
        echo "  PATCHED: $label"
        return 0
    else
        echo "  FAILED: $label — patch did not apply cleanly, restoring backup"
        cp "${file}.bak.streamfix" "$file"
        return 1
    fi
}

revert_file() {
    local file="$1"
    local label="$2"

    if [ -f "${file}.bak.streamfix" ]; then
        cp "${file}.bak.streamfix" "$file"
        rm "${file}.bak.streamfix"
        echo "  REVERTED: $label"
    else
        echo "  SKIP: $label — no backup found"
    fi
}

check_file() {
    local file="$1"
    local label="$2"

    if [ ! -f "$file" ]; then
        echo "  MISSING: $label"
        return 1
    fi

    if grep -q 'lastSeenToolIdx' "$file" 2>/dev/null && ! grep -q 'allTextParts' "$file" 2>/dev/null; then
        echo "  PATCHED: $label"
        return 0
    elif grep -q 'allTextParts' "$file" 2>/dev/null; then
        echo "  UNPATCHED: $label (old code present)"
        return 1
    else
        echo "  UNKNOWN: $label (neither pattern found — different version?)"
        return 1
    fi
}

# --- Main ---

echo "Mastra Code TUI Streaming Text Visibility Fix"
echo "  Target: $MASTRA_DIR"
echo ""

case "${1:-apply}" in
    --check)
        echo "Checking patch status..."
        check_file "$ESM" "ESM (tui-DrUt7rlK.js)"
        check_file "$CJS" "CJS (tui-DpWB9pec.cjs)"
        ;;
    --revert)
        echo "Reverting patches..."
        revert_file "$ESM" "ESM (tui-DrUt7rlK.js)"
        revert_file "$CJS" "CJS (tui-DpWB9pec.cjs)"
        ;;
    apply|--apply|"")
        echo "Applying patches..."
        patch_file "$ESM" "ESM (tui-DrUt7rlK.js)"
        patch_file "$CJS" "CJS (tui-DpWB9pec.cjs)"
        echo ""
        echo "Done. Restart mastracode for changes to take effect."
        ;;
    *)
        echo "Usage: $0 [--check|--revert|apply]"
        exit 1
        ;;
esac
