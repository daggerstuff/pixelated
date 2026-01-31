#!/bin/bash
echo "=== PHASE 1 EXECUTION STATUS ==="
date

echo "🔍 RUNNING PROCESSES:"
ssh staging "ps aux | grep -E 'generate_edge_case|extract_long|hydrate|ultra_night' | grep -v grep | wc -l" | xargs echo "Active Tasks:" || true
echo ""

echo "📊 OUTPUT FILE SIZES:"
ssh staging "ls -lh ~/pixelated/ai/training_ready/data/generated/edge_case_synthetic.jsonl 2>&1 | tail -1" || true
ssh staging "du -sh ~/pixelated/ai/training_ready/data/generated/ultra_nightmares/ 2>&1" || true
ssh staging "du -sh ~/pixelated/ai/training_ready/data/generated/nightmare_hydrated/ 2>&1" || true
echo ""

echo "☁️ S3 UPLOADS:"
ssh staging "aws s3 ls s3://pixel-data/gdrive/processed/long_running_therapy/ 2>&1 | tail -1" || true
echo ""

echo "✅ TIER 3/4 STATUS:"
ssh staging "du -sh ~/datasets/consolidated/{cot,reddit}/ 2>&1" || true
