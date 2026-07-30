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
import re
import subprocess
import sys
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

import httpx

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


# ---------------------------------------------------------------------------
# Provider API clients — query external CI/CD pipeline statuses
# ---------------------------------------------------------------------------


class ProviderClient(ABC):
    """Abstract base for CI/CD provider API clients."""

    @abstractmethod
    def fetch_pipelines(self, branch: str, commit: str) -> list[dict[str, Any]]:
        """Fetch pipeline results for the given branch/commit from this provider."""


class GitHubActionsClient(ProviderClient):
    """Queries the GitHub Actions API for workflow runs on the current ref."""

    API_BASE = "https://api.github.com"

    def __init__(self, token: str | None = None, repo: str | None = None) -> None:
        self.token = token or os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
        self.repo = repo or self._detect_repo()

    @staticmethod
    def _detect_repo() -> str | None:
        """Detect GitHub repo slug from git remote origin."""
        try:
            remote = subprocess.check_output(
                ["git", "remote", "get-url", "origin"], stderr=subprocess.DEVNULL, text=True
            ).strip()
            # Supports: git@github.com:org/repo.git and https://github.com/org/repo
            match = re.search(r"github\.com[:/]([^/]+/[^/]+?)(?:\.git)?$", remote)
            if match:
                return match.group(1)
        except Exception:
            pass
        return None

    def fetch_pipelines(self, branch: str, commit: str) -> list[dict[str, Any]]:
        """Fetch workflow runs for the given branch from GitHub Actions."""
        _ = commit
        if not self.token:
            logger.warning("  ▌ GITHUB_TOKEN not set — skipping GitHub Actions fetch")
            return []
        if not self.repo:
            logger.warning("  ▌ Could not detect GitHub repo — skipping GitHub Actions fetch")
            return []

        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "pixelated-readiness-aggregator/1.0",
        }
        url = f"{self.API_BASE}/repos/{self.repo}/actions/runs"
        params: dict[str, str] = {"branch": branch, "per_page": "30"}

        try:
            logger.info("  ▌ Fetching GitHub Actions runs for %s/%s ...", self.repo, branch)
            resp = httpx.get(url, headers=headers, params=params, timeout=30.0)
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPStatusError as exc:
            logger.warning("  ▌ GitHub API error: %s %s", exc.response.status_code, exc.response.text[:200])
            return []
        except httpx.RequestError as exc:
            logger.warning("  ▌ GitHub API request failed: %s", exc)
            return []

        results: list[dict[str, Any]] = []
        for run in data.get("workflow_runs", []):
            results.append(
                {
                    "name": run.get("name", "unknown"),
                    "status": run.get("status", "unknown"),
                    "conclusion": run.get("conclusion"),
                    "url": run.get("html_url", ""),
                    "startedAt": run.get("run_started_at"),
                    "completedAt": run.get("updated_at"),
                }
            )
        return results


class GitLabCIClient(ProviderClient):
    """Stub: queries GitLab CI pipeline status (requires gitlab-token)."""

    def __init__(self, token: str | None = None, project_id: str | None = None) -> None:
        self.token = token or os.environ.get("GITLAB_TOKEN")
        self.project_id = project_id or os.environ.get("CI_PROJECT_ID")

    def fetch_pipelines(self, branch: str, commit: str) -> list[dict[str, Any]]:
        _ = branch, commit
        logger.info("  ▌ GitLab CI provider not configured — skipping")
        return []


class BitbucketPipelinesClient(ProviderClient):
    """Stub: queries Bitbucket Pipelines status (requires bitbucket-auth)."""

    def __init__(
        self, username: str | None = None, app_password: str | None = None, repo_slug: str | None = None
    ) -> None:
        self.username = username or os.environ.get("BITBUCKET_USERNAME")
        self.app_password = app_password or os.environ.get("BITBUCKET_APP_PASSWORD")
        self.repo_slug = repo_slug or os.environ.get("BITBUCKET_REPO")

    def fetch_pipelines(self, branch: str, commit: str) -> list[dict[str, Any]]:
        _ = branch, commit
        logger.info("  ▌ Bitbucket Pipelines provider not configured — skipping")
        return []


def fetch_provider_pipelines(
    branch: str,
    commit: str,
    enabled_providers: list[str] | None = None,
    github_token: str | None = None,
    github_repo: str | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """Fetch pipeline results from all configured CI/CD providers.

    Args:
        branch: Git branch name.
        commit: Git commit hash.
        enabled_providers: List of providers to query (default: all that have credentials).
        github_token: GitHub token override.
        github_repo: GitHub repository slug override.

    Returns:
        Dict mapping provider names to lists of pipeline result dicts.
    """
    providers: dict[str, ProviderClient] = {
        "github": GitHubActionsClient(token=github_token, repo=github_repo),
        "gitlab": GitLabCIClient(),
        "bitbucket": BitbucketPipelinesClient(),
    }

    results: dict[str, list[dict[str, Any]]] = {}
    for name, client in providers.items():
        if enabled_providers and name not in enabled_providers:
            continue
        results[name] = client.fetch_pipelines(branch, commit)
    return results


def calculate_provider_summary(provider_pipelines: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    """Calculate aggregate provider pipeline stats."""
    total = 0
    passed = 0
    failed = 0
    running = 0

    for pipelines in provider_pipelines.values():
        for p in pipelines:
            total += 1
            conclusion = p.get("conclusion")
            status = p.get("status", "")
            if conclusion == "success":
                passed += 1
            elif status in ("completed",) and conclusion != "success":
                failed += 1
            elif status in ("in_progress", "pending", "queued", "waiting"):
                running += 1
            else:
                failed += 1

    return {
        "total": total,
        "passed": passed,
        "failed": failed,
        "running": running,
    }


def aggregate_readiness(  # noqa: PLR0913 — all params are independent CLI options
    dry_run: bool = False,
    output_path: str | None = None,
    cwd: str | None = None,
    providers: list[str] | None = None,
    github_token: str | None = None,
    github_repo: str | None = None,
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

    # Fetch provider pipeline results
    provider_pipelines = fetch_provider_pipelines(
        branch=branch,
        commit=commit_hash,
        enabled_providers=providers,
        github_token=github_token,
        github_repo=github_repo,
    )
    provider_summary = calculate_provider_summary(provider_pipelines)

    # Combine local + provider stats for overall readiness
    combined_total = summary["total"] + provider_summary["total"]
    combined_passed = summary["passed"] + provider_summary["passed"]
    combined_failed = summary["failed"] + provider_summary["failed"]
    overall_score = (combined_passed / combined_total * 100) if combined_total > 0 else 0.0

    has_provider_failures = provider_summary["failed"] > 0
    if summary["failed"] > 0 or has_provider_failures:
        overall_status = "not-ready"
    elif provider_summary["running"] > 0 or summary["skipped"] == summary["total"] or summary["skipped"] > 0:
        overall_status = "warning"
    else:
        overall_status = "ready"

    report = {
        "meta": {"generatedAt": timestamp, "schemaVersion": "1.0", "generator": "pixelated-readiness-aggregator"},
        "releaseId": f"ready-{normalize_branch(branch)}-{commit_hash[:7]}",
        "git": {"commit": commit_hash, "branch": branch},
        "readiness": {"status": overall_status, "score": round(overall_score, 1)},
        "summary": {
            "totalLanes": combined_total,
            "passedLanes": combined_passed,
            "failedLanes": combined_failed,
            "skippedLanes": summary["skipped"],
        },
        "validationLanes": validation_lanes,
        "providerPipelines": provider_pipelines,
        "providerSummary": provider_summary,
    }

    logger.info("")
    logger.info("==========================================")
    logger.info(" VALIDATION LANE READINESS SUMMARY")
    logger.info("==========================================")
    logger.info("Overall Status: %s", report["readiness"]["status"].upper())
    logger.info("Overall Score:  %.1f%%", report["readiness"]["score"])
    logger.info("Total Lanes:    %d", report["summary"]["totalLanes"])
    logger.info("Passed Lanes:   %d", report["summary"]["passedLanes"])
    logger.info("Failed Lanes:   %d", report["summary"]["failedLanes"])
    logger.info("Skipped Lanes:  %d", report["summary"]["skippedLanes"])

    has_provider_data = provider_summary["total"] > 0
    if has_provider_data:
        logger.info("")
        logger.info("--- Provider Pipelines ---")
        logger.info(
            "GitHub:    %d total, %d passed, %d failed, %d running",
            provider_summary["total"],
            provider_summary["passed"],
            provider_summary["failed"],
            provider_summary["running"],
        )
    logger.info("==========================================")

    if output_path:
        out_p = Path(output_path)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        with open(out_p, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        logger.info("Report saved to: %s", out_p)

    if report["readiness"]["status"] == "not-ready":
        logger.info("Release is not ready — validation lanes or provider pipelines have failures.")
        return 1
    if report["readiness"]["status"] == "warning":
        logger.info("Release has warnings but is acceptable under policy.")
        return 0

    logger.info("All validation lanes and provider pipelines pass!")
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
    parser.add_argument(
        "--providers",
        type=str,
        nargs="*",
        default=None,
        help="CI/CD providers to query (e.g. github gitlab bitbucket). Default: all with credentials.",
    )
    parser.add_argument(
        "--github-token",
        type=str,
        default=None,
        help="GitHub personal access token (default: GITHUB_TOKEN env)",
    )
    parser.add_argument(
        "--github-repo",
        type=str,
        default=None,
        help="GitHub repo slug (owner/name). Default: detected from git remote.",
    )
    args = parser.parse_args()
    sys.exit(
        aggregate_readiness(
            dry_run=args.dry_run,
            output_path=args.output,
            cwd=args.cwd,
            providers=args.providers,
            github_token=args.github_token,
            github_repo=args.github_repo,
        )
    )


if __name__ == "__main__":
    main()
