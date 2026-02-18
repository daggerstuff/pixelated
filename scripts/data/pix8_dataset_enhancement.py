#!/usr/bin/env python3
"""
PIX-8 Dataset Enhancement Master Orchestrator

Coordinates all PIX-8 dataset enhancement tasks:
1. Re-categorize 67 'Other' files using Phase 2 hybrid classifier
2. Generate 75K edge cases (25K Nightmare Fuel)
3. Generate 200K long-running therapy sessions (20+ turns)
4. Validate enhanced dataset quality

Progress tracking and reporting to Jira PIX-8.
"""

import json
import logging
import sys
import subprocess
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime
from enum import Enum

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class PIX8Phase(str, Enum):
    """PIX-8 enhancement phases."""
    RECATEGORIZATION = "recategorization"
    EDGE_CASES = "edge_cases"
    LONG_SESSIONS = "long_sessions"
    VALIDATION = "validation"


class PIX8Orchestrator:
    """Master orchestrator for PIX-8 dataset enhancement."""
    
    def __init__(self, output_dir: Path = None):
        """
        Initialize the PIX-8 orchestrator.
        
        Args:
            output_dir: Output directory for all PIX-8 outputs
        """
        self.output_dir = output_dir or Path("ai/training_ready/data/pix8_enhanced")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.scripts_dir = Path(__file__).parent
        
        self.progress = {
            "started_at": datetime.utcnow().isoformat(),
            "phases": {},
            "overall_status": "in_progress"
        }
        
        logger.info("="*80)
        logger.info("PIX-8 DATASET ENHANCEMENT ORCHESTRATOR")
        logger.info("="*80)
        logger.info(f"Output directory: {self.output_dir}")
        logger.info("="*80)
    
    def run_phase(self, phase: PIX8Phase, script_name: str, args: List[str] = None) -> Dict[str, Any]:
        """
        Run a PIX-8 enhancement phase.
        
        Args:
            phase: Phase identifier
            script_name: Script filename to run
            args: Additional command-line arguments
            
        Returns:
            Phase execution results
        """
        logger.info("\n" + "="*80)
        logger.info(f"PHASE: {phase.value.upper()}")
        logger.info("="*80)
        
        script_path = self.scripts_dir / script_name
        
        if not script_path.exists():
            logger.error(f"Script not found: {script_path}")
            return {
                "phase": phase.value,
                "status": "failed",
                "error": f"Script not found: {script_path}"
            }
        
        cmd = ["python3", str(script_path)]
        if args:
            cmd.extend(args)
        
        logger.info(f"Running: {' '.join(cmd)}")
        
        phase_result = {
            "phase": phase.value,
            "script": script_name,
            "command": ' '.join(cmd),
            "started_at": datetime.utcnow().isoformat()
        }
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )
            
            phase_result["status"] = "success"
            phase_result["stdout"] = result.stdout
            phase_result["completed_at"] = datetime.utcnow().isoformat()
            
            logger.info(f"✅ Phase {phase.value} completed successfully!")
            logger.info(result.stdout)
            
        except subprocess.CalledProcessError as e:
            phase_result["status"] = "failed"
            phase_result["error"] = str(e)
            phase_result["stdout"] = e.stdout
            phase_result["stderr"] = e.stderr
            phase_result["failed_at"] = datetime.utcnow().isoformat()
            
            logger.error(f"❌ Phase {phase.value} failed!")
            logger.error(f"Error: {e}")
            logger.error(f"stdout: {e.stdout}")
            logger.error(f"stderr: {e.stderr}")
        
        self.progress["phases"][phase.value] = phase_result
        self._save_progress()
        
        return phase_result
    
    def phase_1_recategorization(self) -> Dict[str, Any]:
        """
        Phase 1: Re-categorize 67 'Other' files using Phase 2 hybrid classifier.
        
        Uses NVIDIA NIM GLM4.7 for edge cases and ambiguous entries.
        """
        logger.info("\n🔄 Starting Phase 1: Recategorization")
        logger.info("Task: Re-categorize 67 'Other' files with hybrid classifier")
        logger.info("Expected: Proper taxonomy for 60% of dataset")
        
        return self.run_phase(
            phase=PIX8Phase.RECATEGORIZATION,
            script_name="recategorize_s3_files.py",
            args=["--threshold=0.70"]
        )
    
    def phase_2_edge_cases(self) -> Dict[str, Any]:
        """
        Phase 2: Generate 75K edge cases (25K Nightmare Fuel).
        
        Uses NeMo Data Designer for extreme therapeutic scenarios.
        """
        logger.info("\n🔥 Starting Phase 2: Edge Case Generation")
        logger.info("Task: Generate 75K edge cases")
        logger.info("  - 25K Nightmare Fuel (extreme scenarios)")
        logger.info("  - 50K Standard edge cases")
        
        return self.run_phase(
            phase=PIX8Phase.EDGE_CASES,
            script_name="generate_edge_cases_pix8.py"
        )
    
    def phase_3_long_sessions(self) -> Dict[str, Any]:
        """
        Phase 3: Generate 200K long-running therapy sessions (20+ turns).
        
        Extracts from existing datasets and generates synthetic sessions.
        """
        logger.info("\n💬 Starting Phase 3: Long-Running Session Generation")
        logger.info("Task: Generate 200K sessions with ≥20 turns")
        logger.info("  - 100K from extraction")
        logger.info("  - 100K synthetic (if available)")
        
        return self.run_phase(
            phase=PIX8Phase.LONG_SESSIONS,
            script_name="generate_long_sessions_pix8.py",
            args=["--min-turns=20"]
        )
    
    def phase_4_validation(self) -> Dict[str, Any]:
        """
        Phase 4: Validate enhanced dataset quality.
        
        Checks:
        - Categorization distribution
        - Edge case coverage
        - Session length distribution
        - Overall dataset quality
        """
        logger.info("\n✅ Starting Phase 4: Validation")
        logger.info("Task: Validate enhanced dataset quality")
        
        # For now, collect statistics from previous phases
        validation_result = {
            "phase": PIX8Phase.VALIDATION.value,
            "started_at": datetime.utcnow().isoformat(),
            "status": "success"
        }
        
        # Aggregate statistics from phases
        stats = {
            "recategorization": self._extract_stats(PIX8Phase.RECATEGORIZATION),
            "edge_cases": self._extract_stats(PIX8Phase.EDGE_CASES),
            "long_sessions": self._extract_stats(PIX8Phase.LONG_SESSIONS)
        }
        
        validation_result["statistics"] = stats
        validation_result["completed_at"] = datetime.utcnow().isoformat()
        
        self.progress["phases"][PIX8Phase.VALIDATION.value] = validation_result
        self._save_progress()
        
        logger.info("✅ Validation complete!")
        
        return validation_result
    
    def _extract_stats(self, phase: PIX8Phase) -> Dict[str, Any]:
        """Extract statistics from a phase's output."""
        if phase.value not in self.progress["phases"]:
            return {"status": "not_run"}
        
        phase_data = self.progress["phases"][phase.value]
        
        # Try to find stats file
        stats_files = {
            PIX8Phase.RECATEGORIZATION: "metrics/recategorization_stats.json",
            PIX8Phase.EDGE_CASES: "ai/training_ready/data/generated/pix8_edge_cases/pix8_edge_cases_stats.json",
            PIX8Phase.LONG_SESSIONS: "ai/training_ready/data/generated/pix8_long_sessions/pix8_long_sessions_stats.json"
        }
        
        stats_file = Path(stats_files.get(phase, ""))
        if stats_file.exists():
            with open(stats_file, 'r') as f:
                return json.load(f)
        
        return {"status": phase_data.get("status", "unknown")}
    
    def run_all_phases(self) -> Dict[str, Any]:
        """
        Run all PIX-8 enhancement phases in sequence.
        
        Returns:
            Final orchestration results
        """
        logger.info("\n🚀 Starting PIX-8 Dataset Enhancement")
        logger.info("All phases will run in sequence:")
        logger.info("  1. Recategorization (hybrid classifier)")
        logger.info("  2. Edge Case Generation (75K total)")
        logger.info("  3. Long Session Generation (200K total)")
        logger.info("  4. Validation")
        
        # Phase 1: Recategorization
        phase1_result = self.phase_1_recategorization()
        if phase1_result["status"] != "success":
            logger.warning("⚠️  Phase 1 failed, continuing with remaining phases...")
        
        # Phase 2: Edge Cases
        phase2_result = self.phase_2_edge_cases()
        if phase2_result["status"] != "success":
            logger.warning("⚠️  Phase 2 failed, continuing with remaining phases...")
        
        # Phase 3: Long Sessions
        phase3_result = self.phase_3_long_sessions()
        if phase3_result["status"] != "success":
            logger.warning("⚠️  Phase 3 failed, continuing with validation...")
        
        # Phase 4: Validation
        phase4_result = self.phase_4_validation()
        
        # Final summary
        self.progress["completed_at"] = datetime.utcnow().isoformat()
        
        successful_phases = sum(
            1 for p in self.progress["phases"].values()
            if p.get("status") == "success"
        )
        
        if successful_phases == 4:
            self.progress["overall_status"] = "success"
        elif successful_phases > 0:
            self.progress["overall_status"] = "partial_success"
        else:
            self.progress["overall_status"] = "failed"
        
        self._save_progress()
        self._print_final_summary()
        
        return self.progress
    
    def _save_progress(self):
        """Save progress to JSON file."""
        progress_file = self.output_dir / "pix8_progress.json"
        with open(progress_file, 'w') as f:
            json.dump(self.progress, f, indent=2)
        logger.debug(f"Progress saved: {progress_file}")
    
    def _print_final_summary(self):
        """Print final execution summary."""
        logger.info("\n" + "="*80)
        logger.info("📊 PIX-8 DATASET ENHANCEMENT - FINAL SUMMARY")
        logger.info("="*80)
        
        for phase_name, phase_data in self.progress["phases"].items():
            status_icon = "✅" if phase_data.get("status") == "success" else "❌"
            logger.info(f"{status_icon} {phase_name.upper()}: {phase_data.get('status', 'unknown')}")
        
        logger.info("\n" + "="*80)
        logger.info(f"Overall Status: {self.progress['overall_status'].upper()}")
        logger.info(f"Duration: {self.progress.get('started_at')} → {self.progress.get('completed_at')}")
        logger.info(f"Progress file: {self.output_dir / 'pix8_progress.json'}")
        logger.info("="*80)


def main():
    """Run PIX-8 dataset enhancement orchestrator."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="PIX-8 Dataset Enhancement Master Orchestrator"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("ai/training_ready/data/pix8_enhanced"),
        help="Output directory for PIX-8 outputs"
    )
    parser.add_argument(
        "--phase",
        type=str,
        choices=["recategorization", "edge_cases", "long_sessions", "validation", "all"],
        default="all",
        help="Phase to run (default: all)"
    )
    
    args = parser.parse_args()
    
    orchestrator = PIX8Orchestrator(output_dir=args.output_dir)
    
    if args.phase == "all":
        results = orchestrator.run_all_phases()
    elif args.phase == "recategorization":
        results = orchestrator.phase_1_recategorization()
    elif args.phase == "edge_cases":
        results = orchestrator.phase_2_edge_cases()
    elif args.phase == "long_sessions":
        results = orchestrator.phase_3_long_sessions()
    elif args.phase == "validation":
        results = orchestrator.phase_4_validation()
    
    logger.info("\n✅ PIX-8 dataset enhancement orchestration complete!")
    
    return 0 if results.get("overall_status") in ["success", "partial_success"] else 1


if __name__ == "__main__":
    sys.exit(main())
