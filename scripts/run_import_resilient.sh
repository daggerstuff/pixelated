#!/bin/bash
# Resilient import script that survives disconnection
# Uses screen to run the import process

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_DIR/openmemory_import.log"
SCREEN_NAME="openmemory_import"

cd "$PROJECT_DIR"

echo "🚀 Starting resilient OpenMemory import..."
echo "   Screen session: $SCREEN_NAME"
echo "   Log file: $LOG_FILE"
echo ""
echo "To attach to the session: screen -r $SCREEN_NAME"
echo "To detach (keep running): Press Ctrl+A then D"
echo "To check progress: tail -f $LOG_FILE"
echo ""

# Check if screen session already exists
if screen -list | grep -q "$SCREEN_NAME"; then
    echo "⚠️  Screen session '$SCREEN_NAME' already exists!"
    echo "   Attach with: screen -r $SCREEN_NAME"
    echo "   Or kill it with: screen -S $SCREEN_NAME -X quit"
    exit 1
fi

# Create screen session and run import
screen -dmS "$SCREEN_NAME" bash -c "
    cd '$PROJECT_DIR' && \
    uv run python scripts/migrate_openmemory_to_byterover.py \
        --import-file openmemory_memories_export.json \
        --resume \
        2>&1 | tee -a '$LOG_FILE'
"

echo "✅ Import started in screen session '$SCREEN_NAME'"
echo ""
echo "📋 Useful commands:"
echo "   Attach:        screen -r $SCREEN_NAME"
echo "   Detach:        Ctrl+A then D"
echo "   View logs:     tail -f $LOG_FILE"
echo "   Check status:  ps aux | grep migrate_openmemory"
echo "   Kill session:  screen -S $SCREEN_NAME -X quit"
echo ""
