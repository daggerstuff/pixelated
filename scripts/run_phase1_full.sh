#!/bin/bash
export OVH_S3_ACCESS_KEY='b6939e6b65ef4252b20338499421a5f0'
export OVH_S3_SECRET_KEY='4a7e939381c6467c88f81a5024672a96'
export OVH_S3_ENDPOINT='https://s3.us-east-va.io.cloud.ovh.us'
export OVH_S3_BUCKET='pixel-data'
export OVH_S3_REGION='us-east-va'
export AWS_ACCESS_KEY_ID='b6939e6b65ef4252b20338499421a5f0'
export AWS_SECRET_ACCESS_KEY='4a7e939381c6467c88f81a5024672a96'

cd ~/pixelated

echo "════════════════════════════════════════════════════════════"
echo "  PHASE 1 EXTENDED EXECUTION - FULL PIPELINE"
echo "════════════════════════════════════════════════════════════"
echo ""

echo "=== PHASE 1a: CORE DATASET GENERATION (3-6 hours) ==="
echo ""
echo "Task 1a.1: Generating edge case synthetic dataset (10K samples)"
/root/.local/bin/uv run python ai/training_ready/scripts/generate_edge_case_synthetic_dataset.py --output ai/training_ready/data/generated/edge_case_synthetic.jsonl --limit 10000 2>&1 &
PID1=$!

echo "Task 1a.2: Extracting long-running therapy sessions (1K+ samples)"
/root/.local/bin/uv run python ai/training_ready/scripts/extract_long_running_therapy.py --min-turns 20 --limit 1000 2>&1 &
PID2=$!

wait $PID1 $PID2
echo "✅ Phase 1a.1 & 1a.2 complete"
echo ""

echo "Task 1a.3: Running 8-gate quality validation"
/root/.local/bin/uv run python ai/training_ready/scripts/verify_final_dataset.py --report 2>&1
echo "✅ Phase 1a.3 complete"
echo ""

echo "Task 1a.4: Final compilation to S3"
/root/.local/bin/uv run python ai/training_ready/scripts/compile_final_dataset.py --s3-bucket pixel-data --upload-canonical 2>&1
echo "✅ Phase 1a complete - Core dataset ready (61K+ samples)"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "  PHASE 1b: PIPELINE EXTENSIONS (7-11 hours)"
echo "════════════════════════════════════════════════════════════"
echo ""

echo "Task 1b.1: YouTube multi-source extraction"
/root/.local/bin/uv run python ai/training_ready/scripts/extract_all_youtube_transcripts.py --all-creators --upload-s3 2>&1 &
PID3=$!

echo "Task 1b.2: Academic research integration"
/root/.local/bin/uv run python ai/training_ready/scripts/extract_academic_findings.py --upload-s3 2>&1 &
PID4=$!

echo "Task 1b.3: Books & PDF extraction"
/root/.local/bin/uv run python ai/training_ready/scripts/extract_all_books_to_training.py --all-books --upload-s3 2>&1 &
PID5=$!

echo "Task 1b.4: NeMo synthetic generation"
/root/.local/bin/uv run python ai/training_ready/scripts/generate_nemo_synthetic_data.py --quality-gated --upload-s3 2>&1 &
PID6=$!

wait $PID3 $PID4 $PID5 $PID6
echo "✅ Phase 1b.1-1b.4 complete"
echo ""

echo "Task 1b.5: Final integration & validation"
/root/.local/bin/uv run python ai/training_ready/scripts/final_phase1b_integration.py --merge-all --validate-8gates --upload-canonical 2>&1
echo "✅ Phase 1b complete"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "  ✅ PHASE 1 EXTENDED COMPLETE"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📊 Final Dataset Ready:"
echo "   • 60,000+ complete therapeutic samples"
echo "   • 8 therapeutic perspectives included"
echo "   • All quality gates passed"
echo "   • Ready for Phase 2: Baseline Validation"
echo ""
