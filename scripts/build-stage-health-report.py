#!/usr/bin/env python3
"""Rebuild MTGC stage health artifacts from an existing training checklist."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ai.pipelines.orchestrator.orchestration.stage_health_rebuild import (
    rebuild_stage_health_artifacts,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Rebuild integrated stage health and closure-pack artifacts "
            "from ai/lightning/training_run_checklist.json"
        )
    )
    parser.add_argument(
        "--checklist",
        default="ai/lightning/training_run_checklist.json",
        help="Path to an existing training run checklist JSON",
    )
    parser.add_argument(
        "--manifest",
        default="ai/training_data_consolidated/final/MASTER_STAGE_MANIFEST.json",
        help="Path to the stage manifest JSON used as closure-pack evidence",
    )
    parser.add_argument(
        "--stage-health-output",
        default="ai/lightning/integrated_stage_health_report.json",
        help="Output path for the rebuilt stage health report JSON",
    )
    parser.add_argument(
        "--closure-pack-output",
        default="ai/lightning/mtgc_closure_pack.json",
        help="Output path for the rebuilt closure pack JSON",
    )
    parser.add_argument(
        "--asana-mapping-output",
        default="ai/lightning/asana_task_key_mapping.json",
        help="Existing Asana task mapping artifact path",
    )
    parser.add_argument(
        "--asana-transition-output",
        default="ai/lightning/asana_task_transition_results.json",
        help="Existing Asana transition results artifact path",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    result = rebuild_stage_health_artifacts(
        checklist_path=PROJECT_ROOT / args.checklist,
        manifest_path=PROJECT_ROOT / args.manifest,
        stage_health_report_output_path=PROJECT_ROOT / args.stage_health_output,
        closure_pack_output_path=PROJECT_ROOT / args.closure_pack_output,
        asana_task_key_mapping_output_path=PROJECT_ROOT / args.asana_mapping_output,
        asana_task_transition_output_path=PROJECT_ROOT / args.asana_transition_output,
    )
    summary = {
        "checklist_path": str(result.checklist_path),
        "stage_health_report_path": str(result.stage_health_report_path),
        "closure_pack_path": str(result.closure_pack_path),
        "stage_health_pass": result.stage_health_report.get("pass", False),
        "closure_pack_pass": result.closure_pack.get("overall_pass", False),
        "blocker_count": len(result.stage_health_report.get("blockers", [])),
        "warning_count": len(result.stage_health_report.get("warnings", [])),
        "error_count": len(result.stage_health_report.get("errors", [])),
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
