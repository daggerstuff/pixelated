#!/bin/bash
export OVH_S3_ACCESS_KEY='b6939e6b65ef4252b20338499421a5f0'
export OVH_S3_SECRET_KEY='4a7e939381c6467c88f81a5024672a96'
export OVH_S3_ENDPOINT='https://s3.us-east-va.io.cloud.ovh.us'
export OVH_S3_BUCKET='pixel-data'
export OVH_S3_REGION='us-east-va'
export AWS_ACCESS_KEY_ID='b6939e6b65ef4252b20338499421a5f0'
export AWS_SECRET_ACCESS_KEY='4a7e939381c6467c88f81a5024672a96'

cd ~/pixelated

echo "=== PHASE 1a TEST RUN (100 samples) ==="
echo "Task 1: Edge case synthetic generation (test)"
/root/.local/bin/uv run python ai/training_ready/scripts/generate_edge_case_synthetic_dataset.py --output ai/training_ready/data/generated/edge_case_synthetic_test.jsonl --limit 100 2>&1 &
PID1=$!

echo "Task 2: Long-running therapy extraction (test)"
/root/.local/bin/uv run python ai/training_ready/scripts/extract_long_running_therapy.py --min-turns 20 --limit 50 2>&1 &
PID2=$!

wait $PID1 $PID2
RES1=$?
RES2=$?

if [ $RES1 -eq 0 ] && [ $RES2 -eq 0 ]; then
    echo "✅ TEST RUN SUCCESS - Ready for full execution"
    exit 0
else
    echo "❌ TEST RUN FAILED - Check logs above"
    exit 1
fi
