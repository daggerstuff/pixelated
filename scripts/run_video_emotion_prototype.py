#!/usr/bin/env python3
"""End-to-end video emotion prototype pipeline.

Orchestrates: ingestion -> AU extraction -> temporal filter -> deception -> audit.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Ensure project root on sys.path when run as __main__
_PROJECT_ROOT = str(Path(__file__).resolve().parents[1])
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from src.video_emotion.au_extractor import extract_au_scores
from src.video_emotion.audit_writer import write_audit
from src.video_emotion.deception_layer import enrich_deception_score
from src.video_emotion.ingestion import extract_frames
from src.video_emotion.temporal_filter import detect_events


def run_pipeline(video_path: str, audit_path: str, use_real_openface: bool = False) -> None:
    """Run full pipeline: video -> audit JSON.

    Args:
        video_path: Path to input video file.
        audit_path: Path to write audit JSON output.
        use_real_openface: If True, call real OpenFace (requires Docker).
    """
    frames = extract_frames(video_path, fps_target=30)
    au_frames = [extract_au_scores(f, use_real_openface=use_real_openface) for f in frames]
    events = detect_events(au_frames)
    events = [enrich_deception_score(e) for e in events]
    write_audit(audit_path, events)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Video emotion prototype pipeline")
    parser.add_argument("video", help="Path to input video file")
    parser.add_argument("--audit-output", default="output/audit.json", help="Audit JSON output path")
    parser.add_argument("--use-real-openface", action="store_true", help="Use real OpenFace (requires Docker)")
    args = parser.parse_args()
    run_pipeline(args.video, args.audit_output, use_real_openface=args.use_real_openface)
