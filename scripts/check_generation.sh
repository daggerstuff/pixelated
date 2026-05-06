#!/bin/bash
#
# Check generation progress
#

OUTPUT_DIR="/home/vivi/pixelated/data/therapeutic"
STATE_FILE="${OUTPUT_DIR}/.generation_state"
CONSOLIDATED="${OUTPUT_DIR}/niche_categories_1000.jsonl"

echo "=== GENERATION STATUS ==="
echo ""

if [ -f "$STATE_FILE" ]; then
    echo "Per-category progress:"
    while IFS='=' read -r cat count; do
        printf "  %-35s %d\n" "$cat:" "$count"
    done < "$STATE_FILE"
    echo ""
fi

# Show file sizes
echo "Generated files:"
ls -lh "${OUTPUT_DIR}"/*_batch_*.jsonl 2>/dev/null | awk '{print "  " $9 ": " $5}' || echo "  (no batch files yet)"
echo ""

# Show consolidated file
if [ -f "$CONSOLIDATED" ]; then
    total=$(wc -l < "$CONSOLIDATED")
    echo "Consolidated dataset: ${total} samples"
    echo "  Location: $CONSOLIDATED"
else
    echo "Consolidated dataset: Not yet created"
fi

echo ""

# Check for running process
if pgrep -f "generate_niche_data.sh" > /dev/null; then
    echo "Status: RUNNING"
    pgrep -f "generate_niche_data.sh" | xargs -I {} ps -p {} -o pid,etime,%mem,cmd 2>/dev/null | tail -1 | awk '{print "  PID: " $1 ", Elapsed: " $2}'
else
    echo "Status: NOT RUNNING"
fi
