#!/usr/bin/env python3
"""
Execute full integrated training pipeline with real datasets and strict artifact mode.

This script runs the complete training pipeline end-to-end, producing:
- ai/training_data_consolidated/final/MASTER_STAGE_MANIFEST.json
- ai/training_data_consolidated/final/splits/train.jsonl, val.jsonl, test.jsonl
- Per-stage splits: ai/training_data_consolidated/final/splits/{stage}/train.jsonl, etc.
- ai/lightning/training_run_checklist.json (with run provenance)

STRICT MODE (default):
- Validates all required Stage 3/4 artifacts exist
- Validates stage distribution drift < 2%
- Fails on any quality validation errors

Usage:
    python scripts/run-integrated-training-pipeline.py [--non-strict] [--allow-missing-artifacts] [--allow-drift]

Environment Variables:
    TRAINING_STRICT_MODE=false              Disable all strict checks (development only)
    TRAINING_ALLOW_MISSING_ARTIFACTS=true   Allow missing Stage 3/4 artifacts
    TRAINING_ALLOW_STAGE_DRIFT=true         Allow stage distribution drift
    DATASET_STORAGE_BACKEND=s3              Use S3 for dataset storage (default: local)
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from ai.pipelines.orchestrator.orchestration.integrated_training_pipeline import (
    IntegratedPipelineConfig,
    IntegratedTrainingPipeline,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("run_integrated_training_pipeline")


def setup_output_directories() -> None:
    """Ensure output directories exist."""
    output_dirs = [
        Path("ai/training_data_consolidated/final"),
        Path("ai/training_data_consolidated/final/splits"),
        Path("ai/lightning"),
    ]
    for dir_path in output_dirs:
        dir_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"✅ Output directory ready: {dir_path}")


def apply_cli_overrides(config: IntegratedPipelineConfig, args: argparse.Namespace) -> None:
    """Apply command-line argument overrides to config."""
    if args.non_strict:
        logger.warning("⚠️  --non-strict flag: Disabling all strict checks")
        os.environ["TRAINING_STRICT_MODE"] = "false"
        config.fail_on_stage_drift = False
        config.fail_on_missing_stage_artifacts = False

    if args.allow_missing_artifacts:
        logger.warning("⚠️  --allow-missing-artifacts flag: Allowing missing Stage 3/4 assets")
        os.environ["TRAINING_ALLOW_MISSING_ARTIFACTS"] = "true"
        config.fail_on_missing_stage_artifacts = False

    if args.allow_drift:
        logger.warning("⚠️  --allow-drift flag: Allowing stage distribution drift")
        os.environ["TRAINING_ALLOW_STAGE_DRIFT"] = "true"
        config.fail_on_stage_drift = False


def write_run_provenance(
    pipeline: IntegratedTrainingPipeline,
    output_path: Path,
    run_type: str = "production",
) -> None:
    """
    Write run provenance metadata to distinguish production runs from smoke tests.
    
    Prevents downstream automation from misinterpreting checklist state.
    """
    provenance = {
        "run_type": run_type,  # "production" or "smoke"
        "run_timestamp": datetime.now(timezone.utc).isoformat(),
        "dataset_size": pipeline.stats.total_samples,
        "stage_distribution": pipeline.stats.samples_by_stage,
        "strict_mode_enabled": {
            "fail_on_stage_drift": pipeline.config.fail_on_stage_drift,
            "fail_on_missing_stage_artifacts": pipeline.config.fail_on_missing_stage_artifacts,
        },
        "warnings": pipeline.stats.warnings,
        "errors": pipeline.stats.errors,
    }
    
    provenance_path = output_path.parent / "run_provenance.json"
    with open(provenance_path, "w", encoding="utf-8") as f:
        json.dump(provenance, f, indent=2)
    
    logger.info(f"✅ Run provenance written to {provenance_path}")


def validate_output_artifacts(output_dir: Path) -> bool:
    """
    Validate that all expected output artifacts were created.
    
    Returns True if all artifacts exist, False otherwise.
    """
    required_artifacts = [
        output_dir / "MASTER_STAGE_MANIFEST.json",
        output_dir / "splits" / "train.jsonl",
        output_dir / "splits" / "val.jsonl",
        output_dir / "splits" / "test.jsonl",
    ]
    
    missing = []
    for artifact in required_artifacts:
        if not artifact.exists():
            missing.append(str(artifact))
        else:
            logger.info(f"✅ Artifact exists: {artifact}")
    
    if missing:
        logger.error(f"❌ Missing artifacts: {missing}")
        return False
    
    # Validate non-empty outputs
    for split_file in [
        output_dir / "splits" / "train.jsonl",
        output_dir / "splits" / "val.jsonl",
        output_dir / "splits" / "test.jsonl",
    ]:
        line_count = sum(1 for _ in open(split_file, encoding="utf-8"))
        if line_count == 0:
            logger.error(f"❌ Empty split file: {split_file}")
            return False
        logger.info(f"✅ {split_file.name}: {line_count} samples")
    
    return True


def main() -> int:
    """Execute the integrated training pipeline."""
    parser = argparse.ArgumentParser(
        description="Execute full integrated training pipeline with strict artifact mode",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--non-strict",
        action="store_true",
        help="Disable all strict checks (development only)",
    )
    parser.add_argument(
        "--allow-missing-artifacts",
        action="store_true",
        help="Allow missing Stage 3/4 artifacts (development only)",
    )
    parser.add_argument(
        "--allow-drift",
        action="store_true",
        help="Allow stage distribution drift (development only)",
    )
    
    args = parser.parse_args()
    
    logger.info("=" * 70)
    logger.info("🚀 Integrated Training Pipeline Execution")
    logger.info("=" * 70)
    
    try:
        # Setup output directories
        setup_output_directories()
        
        # Create pipeline config
        config = IntegratedPipelineConfig()
        apply_cli_overrides(config, args)
        
        # Initialize and run pipeline
        logger.info("\n📊 Initializing pipeline...")
        pipeline = IntegratedTrainingPipeline(config)
        
        logger.info("\n🔄 Running integrated training pipeline...")
        result = pipeline.run()
        
        # Validate output artifacts
        output_dir = Path("ai/training_data_consolidated/final")
        logger.info("\n✅ Validating output artifacts...")
        if not validate_output_artifacts(output_dir):
            logger.error("❌ Output validation failed")
            return 1
        
        # Write run provenance
        output_path = Path(result["output_path"])
        write_run_provenance(pipeline, output_path, run_type="production")
        
        # Print summary
        logger.info("\n" + "=" * 70)
        logger.info("✅ PIPELINE EXECUTION SUCCESSFUL")
        logger.info("=" * 70)
        logger.info(f"📊 Total samples: {pipeline.stats.total_samples}")
        logger.info(f"⏱️  Execution time: {pipeline.stats.integration_time:.2f}s")
        logger.info(f"📁 Output directory: {output_dir}")
        logger.info(f"📋 Checklist: ai/lightning/training_run_checklist.json")
        logger.info(f"🔍 Provenance: {output_dir.parent / 'run_provenance.json'}")
        
        # Print stage distribution
        logger.info("\n📈 Stage Distribution:")
        for stage, count in pipeline.stats.samples_by_stage.items():
            pct = (count / pipeline.stats.total_samples * 100) if pipeline.stats.total_samples > 0 else 0
            logger.info(f"   {stage}: {count} samples ({pct:.1f}%)")
        
        return 0
        
    except RuntimeError as e:
        logger.error(f"❌ Pipeline execution failed: {e}")
        return 1
    except Exception as e:
        logger.exception(f"❌ Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
