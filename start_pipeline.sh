#!/bin/bash
export PYTHONPATH=$PYTHONPATH:.
uv run --env-file .env python ai/dataset_pipeline/orchestration/batched_tier_processor.py --persona dark_humor > processing_v2.log 2>&1 &
echo $! > pipeline.pid
echo "Started pipeline with PID $(cat pipeline.pid)"
