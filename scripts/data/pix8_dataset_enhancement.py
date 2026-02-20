#!/usr/bin/env python3
"""
PIX-8 Dataset Enhancement Orchestrator

Master orchestration script for completing PIX-8 dataset enhancement tasks:
1. Recategorize 67 'Other' files using Phase 2 hybrid classifier
2. Generate 75K edge cases (25K nightmare fuel + 50K standard)
3. Generate 200K long-running sessions (20+ turns each)

Features:
- Orchestrates all PIX-8 tasks
- Real-time progress tracking
- Error handling and recovery
- Generates comprehensive final report
- All operations use uv for Python execution

Usage:
    uv run scripts/data/pix8_dataset_enhancement.py --all
    uv run scripts/data/pix8_dataset_enhancement.py --task recategorization
    uv run scripts/data/pix8_dataset_enhancement.py --task edge_cases
    uv run scripts/data/pix8_dataset_enhancement.py --task long_sessions
    uv run scripts/data/pix8_dataset_enhancement.py --test  # Small test run
"""

import argparse
import json
import logging
import re
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    """Status of a PIX-8 task."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class TaskResult:
    """Result of a PIX-8 task execution."""

    task_name: str
    status: TaskStatus
    start_time: str | None = None
    end_time: str | None = None
    duration_seconds: float = 0.0
    records_generated: int = 0
    error: str | None = None
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "task_name": self.task_name,
            "status": self.status.value,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration_seconds": round(self.duration_seconds, 2),
            "records_generated": self.records_generated,
            "error": self.error,
            "details": self.details,
        }


class PIX8Orchestrator:
    """
    Orchestrate all PIX-8 dataset enhancement tasks.

    Manages execution of recategorization, edge case generation, and
    long session generation with proper error handling and reporting.
    """

    def __init__(self, test_mode: bool = False, output_dir: Path = Path("metrics")):
        """
        Initialize orchestrator.

        Args:
            test_mode: If True, run small test batches
            output_dir: Directory for output reports
        """
        self.test_mode = test_mode
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Task results
        self.results: dict[str, TaskResult] = {}

        # Script paths
        self.project_root = Path(__file__).resolve().parent.parent.parent
        self.scripts_dir = self.project_root / "scripts" / "data"

        logger.info(f"Initialized PIX-8 Orchestrator (test_mode: {test_mode})")

    def _run_script(self, script_name: str, args: list[str], task_name: str) -> TaskResult:
        """
        Run a Python script using uv.

        Args:
            script_name: Script filename
            args: Command-line arguments
            task_name: Human-readable task name

        Returns:
            Task result
        """

        result = TaskResult(task_name=task_name, status=TaskStatus.IN_PROGRESS)
        result.start_time = datetime.now(timezone.utc).isoformat()
        start_time = time.time()

        script_path = self.scripts_dir / script_name

        if not script_path.exists():
            result.status = TaskStatus.FAILED
            result.error = f"Script not found: {script_path}"
            result.end_time = datetime.now(timezone.utc).isoformat()
            result.duration_seconds = time.time() - start_time
            return result

        # Build command using uv
        cmd = ["uv", "run", str(script_path), *args]

        logger.info(f"🚀 Starting: {task_name}")
        logger.info(f"   Command: {' '.join(cmd)}")

        try:
            # Run with real-time output
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True,
                cwd=str(self.project_root),
            )

            # Stream output
            output_lines = []
            if process.stdout:
                for line in process.stdout:
                    stripped_line = line.rstrip()
                    output_lines.append(stripped_line)
                    logger.info(f"  {stripped_line}")

            # Wait for completion
            return_code = process.wait()

            result.end_time = datetime.now(timezone.utc).isoformat()
            result.duration_seconds = time.time() - start_time

            if return_code == 0:
                result.status = TaskStatus.COMPLETED
                logger.info(f"✅ Completed: {task_name} ({result.duration_seconds:.1f}s)")

                # Try to extract statistics from output
                stats = self._parse_output_stats(output_lines)
                if stats:
                    result.details = stats
                    result.records_generated = stats.get("total_generated", 0) or stats.get(
                        "total_records", 0
                    )
            else:
                result.status = TaskStatus.FAILED
                result.error = f"Script exited with code {return_code}"
                logger.error(f"❌ Failed: {task_name} - {result.error}")

        except Exception as e:
            result.status = TaskStatus.FAILED
            result.error = str(e)
            result.end_time = datetime.now(timezone.utc).isoformat()
            result.duration_seconds = time.time() - start_time
            logger.error(f"❌ Failed: {task_name} - {e}", exc_info=True)

        return result

    def _parse_output_stats(self, output_lines: list[str]) -> dict[str, Any]:
        """
        Parse statistics from script output.

        Args:
            output_lines: Output lines from script

        Returns:
            Parsed statistics
        """
        stats = {}

        # Look for JSON stats in output
        for line in output_lines:
            if "total_generated" in line.lower() or "total_records" in line.lower():
                # Try to extract numbers

                numbers = re.findall(r"(\d+(?:,\d+)*)", line)
                if numbers:
                    # Remove commas and convert to int
                    value = int(numbers[0].replace(",", ""))
                    if "total" in line.lower():
                        stats["total_generated"] = value

        return stats

    def run_recategorization(self) -> TaskResult:
        """
        Run recategorization task.

        Returns:
            Task result
        """
        args = ["--output-dir", str(self.output_dir)]

        if self.test_mode:
            args.extend(["--limit", "5"])

        result = self._run_script("recategorize_s3_files.py", args, "Recategorization")

        self.results["recategorization"] = result
        return result

    def run_edge_case_generation(self) -> TaskResult:
        """
        Run edge case generation task.

        Returns:
            Task result
        """
        args = ["--output-dir", str(self.output_dir)]

        # In test mode, only generate nightmare scenarios (fastest to test)
        if self.test_mode:
            args.append("--nightmare-only")

        result = self._run_script("generate_edge_cases_pix8.py", args, "Edge Case Generation")

        self.results["edge_cases"] = result
        return result

    def run_long_session_generation(self) -> TaskResult:
        """
        Run long session generation task.

        Returns:
            Task result
        """
        args = ["--output-dir", str(self.output_dir)]

        if self.test_mode:
            # Small test targets
            args.extend(["--extraction-target", "5", "--synthesis-target", "5"])
        else:
            # Production targets (200K total)
            args.extend(["--extraction-target", "100000", "--synthesis-target", "100000"])

        result = self._run_script("generate_long_sessions_pix8.py", args, "Long Session Generation")

        self.results["long_sessions"] = result
        return result

    def run_all(self) -> dict[str, TaskResult]:
        """
        Run all PIX-8 tasks in sequence.

        Returns:
            Dictionary of task results
        """
        logger.info("\n" + "=" * 80)
        logger.info("🚀 STARTING PIX-8 DATASET ENHANCEMENT")
        logger.info("=" * 80)

        if self.test_mode:
            logger.info("⚠️  TEST MODE: Running small batches for validation")

        # Task 1: Recategorization
        logger.info("\n📋 TASK 1/3: Recategorization")
        self.run_recategorization()

        # Task 2: Edge Cases
        logger.info("\n📋 TASK 2/3: Edge Case Generation")
        self.run_edge_case_generation()

        # Task 3: Long Sessions
        logger.info("\n📋 TASK 3/3: Long Session Generation")
        self.run_long_session_generation()

        return self.results

    def generate_report(self) -> dict[str, Any]:
        """
        Generate comprehensive PIX-8 completion report.

        Returns:
            Report dictionary
        """
        return {
            "pix8_dataset_enhancement": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "test_mode": self.test_mode,
                "overall_status": self._calculate_overall_status(),
                "tasks": {name: result.to_dict() for name, result in self.results.items()},
                "summary": {
                    "total_tasks": len(self.results),
                    "completed": sum(
                        1 for r in self.results.values() if r.status == TaskStatus.COMPLETED
                    ),
                    "failed": sum(
                        1 for r in self.results.values() if r.status == TaskStatus.FAILED
                    ),
                    "total_records_generated": sum(
                        r.records_generated for r in self.results.values()
                    ),
                    "total_duration_seconds": sum(
                        r.duration_seconds for r in self.results.values()
                    ),
                },
            }
        }

    def _calculate_overall_status(self) -> str:
        """Calculate overall completion status."""
        if not self.results:
            return "not_started"

        statuses = [r.status for r in self.results.values()]

        if all(s == TaskStatus.COMPLETED for s in statuses):
            return "completed"
        if any(s == TaskStatus.FAILED for s in statuses):
            return "partial_failure"
        if any(s == TaskStatus.IN_PROGRESS for s in statuses):
            return "in_progress"
        return "unknown"

    def save_report(self, filename: str = "pix8_completion_report.json"):
        """
        Save report to file.

        Args:
            filename: Output filename
        """
        report = self.generate_report()
        output_path = self.output_dir / filename

        with open(output_path, "w") as f:
            json.dump(report, f, indent=2)

        logger.info(f"💾 Saved report: {output_path}")
        return output_path

    def print_summary(self):
        """Print human-readable summary."""
        report = self.generate_report()
        summary = report["pix8_dataset_enhancement"]["summary"]

        logger.info("\n" + "=" * 80)
        logger.info("📊 PIX-8 DATASET ENHANCEMENT SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Overall Status:    {report['pix8_dataset_enhancement']['overall_status']}")
        logger.info(f"Test Mode:         {self.test_mode}")
        logger.info(f"Total Tasks:       {summary['total_tasks']}")
        logger.info(f"Completed:         {summary['completed']}")
        logger.info(f"Failed:            {summary['failed']}")
        logger.info(f"Records Generated: {summary['total_records_generated']:,}")
        logger.info(f"Total Duration:    {summary['total_duration_seconds']:.1f}s")
        logger.info("\nTask Details:")

        for _, result in self.results.items():
            status_emoji = {
                TaskStatus.COMPLETED: "✅",
                TaskStatus.FAILED: "❌",
                TaskStatus.IN_PROGRESS: "🔄",
                TaskStatus.PENDING: "⏳",
                TaskStatus.SKIPPED: "⏭️",
            }.get(result.status, "❓")

            logger.info(
                f"  {status_emoji} {result.task_name:30s}: {result.status.value:12s} "
                f"({result.duration_seconds:.1f}s, {result.records_generated:,} records)"
            )

            if result.error:
                logger.info(f"     Error: {result.error}")

        logger.info("=" * 80)


def main():
    """Run PIX-8 orchestration."""
    parser = argparse.ArgumentParser(description="Orchestrate PIX-8 dataset enhancement tasks")
    parser.add_argument("--all", action="store_true", help="Run all tasks")
    parser.add_argument(
        "--task",
        choices=["recategorization", "edge_cases", "long_sessions"],
        help="Run specific task",
    )
    parser.add_argument("--test", action="store_true", help="Test mode: run small batches")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("metrics"),
        help="Output directory for reports (default: metrics)",
    )

    args = parser.parse_args()

    # Configure logging
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    # Initialize orchestrator
    orchestrator = PIX8Orchestrator(test_mode=args.test, output_dir=args.output_dir)

    # Execute tasks
    if args.all:
        orchestrator.run_all()
    elif args.task:
        if args.task == "recategorization":
            orchestrator.run_recategorization()
        elif args.task == "edge_cases":
            orchestrator.run_edge_case_generation()
        elif args.task == "long_sessions":
            orchestrator.run_long_session_generation()
    else:
        parser.print_help()
        sys.exit(1)

    # Generate and save report
    orchestrator.save_report()
    orchestrator.print_summary()


if __name__ == "__main__":
    main()
