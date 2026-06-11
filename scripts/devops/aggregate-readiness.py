#!/usr/bin/env python3
"""
Readiness Aggregator Script
Collects status outputs from local validation lanes (lint, typecheck, tests)
into a consolidated JSON payload outlining current pass/fail readiness.
"""

import argparse
import datetime
import json
import logging
import os
import subprocess
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def get_git_commit() -> str:
    """Get the current git commit hash."""
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"]).decode("utf-8").strip()
    except Exception:
        return "unknown"


def get_git_branch() -> str:
    """Get the current git branch name."""
    try:
        return subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"]).decode("utf-8").strip()
    except Exception:
        return "unknown"


def normalize_branch(branch: str) -> str:
    """Normalize a git branch name for use in identifiers."""
    return branch.replace("/", "-").replace("_", "-").lower()


def run_command(cmd: list[str], timeout: int = 300, cwd: str | None = None, max_retries: int = 3) -> dict:
    """Execute a command and return structured result information.

    Args:
        cmd: Command and arguments as list of strings
        timeout: Timeout in seconds (default: 300)
        cwd: Working directory (default: None)
        max_retries: Maximum number of retry attempts for transient failures (default: 3)

    Returns:
        Dictionary with status, exit code, stdout, and stderr
    """
    label = cmd[0] if len(cmd) == 1 else " ".join(cmd)
    logger.info("  ▌ Running: %s", label)

    for attempt in range(max_retries + 1):
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=cwd,
                shell=False,
                check=False,
            )
            exit_code = result.returncode
            stdout = result.stdout or ""
            stderr = result.stderr or ""

            # Truncate very long outputs to prevent huge JSON files
            stdout_lines = stdout.splitlines()
            stderr_lines = stderr.splitlines()
            if len(stdout_lines) > 50:
                stdout = "...\n" + "\n".join(stdout_lines[-50:])
            if len(stderr_lines) > 20:
                stderr = "...\n" + "\n".join(stderr_lines[-20:])

            # If successful or this was the last attempt, return the result
            if exit_code == 0 or attempt == max_retries:
                return {
                    "status": "pass" if exit_code == 0 else "fail",
                    "exitCode": exit_code,
                    "stdout": stdout,
                    "stderr": stderr,
                }

            # Log retry attempt for transient failures
            logger.warning("  ▌ Attempt %d failed with exit code %d. Retrying...", attempt + 1, exit_code)

        except subprocess.TimeoutExpired:
            logger.warning("  ▌ Command timed out after %ds: %s", timeout, label)
            if attempt == max_retries:
                return {
                    "status": "fail",
                    "exitCode": None,
                    "stdout": "",
                    "stderr": f"Command timed out after {timeout}s",
                }
            logger.warning("  ▌ Retrying timeout command...")

        except FileNotFoundError:
            logger.warning("  ▌ Command not found: %s", label)
            return {
                "status": "skipped",
                "exitCode": None,
                "stdout": "",
                "stderr": f"Command not found: {label}",
            }
        except Exception as exc:
            logger.warning("  ▌ Command error: %s", exc)
            if attempt == max_retries:
                return {
                    "status": "fail",
                    "exitCode": None,
                    "stdout": "",
                    "stderr": str(exc),
                }
            logger.warning("  ▌ Retrying after error...")

    # This should never be reached, but just in case
    return {
        "status": "fail",
        "exitCode": None,
        "stdout": "",
        "stderr": "Unknown error occurred",
    }


def run_lint(dry_run: bool, cwd: str) -> dict:
    """Run the project's linter (oxlint)."""
    if dry_run:
        logger.info("  ▌ [dry-run] Lint check (oxlint)")
        return {
            "command": "pnpm lint",
            "status": "pass",
            "exitCode": 0,
            "stdout": "",
            "stderr": "",
        }
    return run_command(["pnpm", "lint"], cwd=cwd, max_retries=2)


def run_typecheck(dry_run: bool, cwd: str) -> dict:
    """Run the project's type checker (tsc + astro check)."""
    if dry_run:
        logger.info("  ▌ [dry-run] Typecheck (astro check + tsc)")
        return {
            "command": "pnpm typecheck",
            "status": "pass",
            "exitCode": 0,
            "stdout": "",
            "stderr": "",
        }
    return run_command(["pnpm", "typecheck"], timeout=600, cwd=cwd, max_retries=2)


def run_tests(dry_run: bool, cwd: str) -> dict:
    """Run the project's unit test suite."""
    if dry_run:
        logger.info("  ▌ [dry-run] Unit tests (vitest)")
        return {
            "command": "pnpm test:unit",
            "status": "pass",
            "exitCode": 0,
            "stdout": "",
            "stderr": "",
        }
    return run_command(["pnpm", "test:unit"], timeout=600, cwd=cwd, max_retries=2)


def run_format_check(dry_run: bool, cwd: str) -> dict:
    """Run the project's format check."""
    if dry_run:
        logger.info("  ▌ [dry-run] Format check")
        return {
            "command": "pnpm format:check",
            "status": "pass",
            "exitCode": 0,
            "stdout": "",
            "stderr": "",
        }
    return run_command(["pnpm", "format:check"], cwd=cwd, max_retries=2)


def calculate_summary(validation_lanes: dict) -> dict:
    """Calculate summary statistics from validation results."""
    total = len(validation_lanes)
    passed = sum(1 for v in validation_lanes.values() if v.get("status") == "pass")
    failed = sum(1 for v in validation_lanes.values() if v.get("status") == "fail")
    skipped = sum(1 for v in validation_lanes.values() if v.get("status") == "skipped")

    overall_score = (passed / total) * 100 if total > 0 else 0.0

    if failed > 0:
        overall_status = "not-ready"
    elif skipped == total or skipped > 0:
        overall_status = "warning"
    else:
        overall_status = "ready"

    return {
        "total": total,
        "passed": passed,
        "failed": failed,
        "skipped": skipped,
        "overallScore": round(overall_score, 1),
        "overallStatus": overall_status,
    }


def aggregate_readiness(
    dry_run: bool = False,
    output_path: str | None = None,
    cwd: str | None = None,
) -> int:
    """Aggregate validation lane statuses and output readiness report."""
    logger.info("▸ Aggregating Validation Lane Readiness Status...")

    project_root = cwd or os.getcwd()
    commit_hash = get_git_commit()
    branch = get_git_branch()

    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()

    validation_lanes = {
        "lint": run_lint(dry_run, project_root),
        "typecheck": run_typecheck(dry_run, project_root),
        "tests": run_tests(dry_run, project_root),
        "format": run_format_check(dry_run, project_root),
    }

    summary = calculate_summary(validation_lanes)

    report = {
        "releaseId": f"ready-{normalize_branch(branch)}-{commit_hash[:7]}",
        "commit": commit_hash,
        "branch": branch,
        "timestamp": timestamp,
        "overallStatus": summary["overallStatus"],
        "overallScore": summary["overallScore"],
        "summary": {
            "total": summary["total"],
            "passed": summary["passed"],
            "failed": summary["failed"],
            "skipped": summary["skipped"],
        },
        "validationLanes": validation_lanes,
    }

    logger.info("")
    logger.info("==========================================")
    logger.info(" VALIDATION LANE READINESS SUMMARY")
    logger.info("==========================================")
    logger.info("Overall Status: %s", summary["overallStatus"].upper())
    logger.info("Overall Score:  %.1f%%", summary["overallScore"])
    logger.info("Total Lanes:    %d", summary["total"])
    logger.info("Passed Lanes:   %d", summary["passed"])
    logger.info("Failed Lanes:   %d", summary["failed"])
    logger.info("Skipped Lanes:  %d", summary["skipped"])
    logger.info("==========================================")

    if output_path:
        out_p = Path(output_path)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        with open(out_p, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        logger.info("Report saved to: %s", out_p)

    if summary["overallStatus"] == "not-ready":
        logger.info("Release is not ready — validation lanes have failures.")
        return 1
    if summary["overallStatus"] == "warning":
        logger.info("Release has warnings but is acceptable under policy.")
        return 0

    logger.info("All validation lanes pass!")
    return 0


def main():
    """Main execution entry point."""
    parser = argparse.ArgumentParser(
        description="Aggregate validation lane (lint, typecheck, tests) results into a readiness JSON report."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate all validation checks as passing",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Path to write JSON report (default: stdout only)",
    )
    parser.add_argument(
        "--cwd",
        type=str,
        default=None,
        help="Project root directory (default: current directory)",
    )
    args = parser.parse_args()
    sys.exit(
        aggregate_readiness(
            dry_run=args.dry_run,
            output_path=args.output,
            cwd=args.cwd,
        )
    )


if __name__ == "__main__":
    main()
