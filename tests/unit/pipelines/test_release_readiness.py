"""
Unit tests for CI/CD Release Readiness Aggregator and DevOps Readiness Aggregator.
"""

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# CI/CD Release Readiness Aggregator (scripts/ci/)
# ---------------------------------------------------------------------------
scripts_dir = Path(__file__).resolve().parents[3] / "scripts" / "ci"
script_path = scripts_dir / "release-readiness-aggregator.py"

spec = importlib.util.spec_from_file_location("release_readiness_aggregator", script_path)
aggregator = importlib.util.module_from_spec(spec)
sys.modules["release_readiness_aggregator"] = aggregator
spec.loader.exec_module(aggregator)

mock_provider_status = aggregator.mock_provider_status
aggregate_readiness = aggregator.aggregate_readiness

# ---------------------------------------------------------------------------
# DevOps Readiness Aggregator (scripts/devops/)
# ---------------------------------------------------------------------------
devops_scripts_dir = Path(__file__).resolve().parents[3] / "scripts" / "devops"
devops_script_path = devops_scripts_dir / "aggregate-readiness.py"

devops_spec = importlib.util.spec_from_file_location("aggregate_readiness", devops_script_path)
devops_aggregator = importlib.util.module_from_spec(devops_spec)
sys.modules["aggregate_readiness"] = devops_aggregator
devops_spec.loader.exec_module(devops_aggregator)

run_command_fn = devops_aggregator.run_command
calculate_summary_fn = devops_aggregator.calculate_summary
normalize_branch_fn = devops_aggregator.normalize_branch
aggregate_readiness_fn = devops_aggregator.aggregate_readiness
get_git_commit_fn = devops_aggregator.get_git_commit
get_git_branch_fn = devops_aggregator.get_git_branch


def test_mock_provider_status():
    """Test that mock statuses return valid schema structures."""
    github_status = mock_provider_status("github")
    assert github_status["status"] == "pass"
    assert "pipelineUrl" in github_status
    assert "build" in github_status["checks"]

    gitlab_status = mock_provider_status("gitlab")
    assert gitlab_status["status"] == "pass"
    assert "validate:lint" in gitlab_status["checks"]

    bitbucket_status = mock_provider_status("bitbucket")
    assert bitbucket_status["status"] == "pass"
    assert "governance-validate" in bitbucket_status["checks"]

    unknown_status = mock_provider_status("unknown")
    assert unknown_status["status"] == "skipped"


def test_aggregate_readiness_dry_run(tmp_path):
    """Test that aggregate_readiness runs cleanly with --dry-run and output file."""
    output_file = tmp_path / "readiness.json"

    # Run the aggregator in dry-run mode
    exit_code = aggregate_readiness(dry_run=True, output_path=str(output_file))

    assert exit_code == 0
    assert output_file.exists()

    # Verify file content is valid JSON matching schema
    with open(output_file) as f:
        data = json.load(f)

    assert "releaseId" in data
    assert "commit" in data
    assert data["overallStatus"] == "ready"
    assert data["overallScore"] == 100.0
    assert "github" in data["providers"]
    assert "qualityGates" in data


# ---------------------------------------------------------------------------
# DevOps Readiness Aggregator tests
# ---------------------------------------------------------------------------


def test_devops_aggregate_readiness_dry_run(tmp_path):
    """Verify devops aggregator dry-run produces valid output."""
    output_file = tmp_path / "devops-readiness.json"
    exit_code = aggregate_readiness_fn(dry_run=True, output_path=str(output_file))
    assert exit_code == 0
    assert output_file.exists()

    with open(output_file) as f:
        data = json.load(f)

    assert "releaseId" in data
    assert "commit" in data
    assert "branch" in data
    assert "overallStatus" in data
    assert "overallScore" in data
    assert "summary" in data
    assert "validationLanes" in data
    assert data["overallStatus"] == "ready"
    assert data["overallScore"] == 100.0
    assert data["summary"]["total"] == 4
    assert data["summary"]["passed"] == 4
    assert data["summary"]["failed"] == 0
    assert "lint" in data["validationLanes"]
    assert "typecheck" in data["validationLanes"]
    assert "tests" in data["validationLanes"]
    assert "format" in data["validationLanes"]


def test_calculate_summary_all_pass():
    """All lanes passing yields ready status and 100% score."""
    lanes = {k: {"status": "pass"} for k in ("lint", "typecheck", "tests")}
    summary = calculate_summary_fn(lanes)
    assert summary["overallStatus"] == "ready"
    assert summary["overallScore"] == 100.0
    assert summary["total"] == 3
    assert summary["passed"] == 3
    assert summary["failed"] == 0


def test_calculate_summary_with_failures():
    """Any failure yields not-ready and a partial score."""
    lanes = {
        "lint": {"status": "pass"},
        "typecheck": {"status": "fail"},
        "tests": {"status": "pass"},
    }
    summary = calculate_summary_fn(lanes)
    assert summary["overallStatus"] == "not-ready"
    assert summary["overallScore"] == pytest.approx(66.7, rel=0.1)
    assert summary["passed"] == 2
    assert summary["failed"] == 1


def test_calculate_summary_all_skipped():
    """All lanes skipped yields warning status."""
    lanes = {k: {"status": "skipped"} for k in ("lint", "typecheck", "tests")}
    summary = calculate_summary_fn(lanes)
    assert summary["overallStatus"] == "warning"
    assert summary["total"] == 3
    assert summary["passed"] == 0
    assert summary["skipped"] == 3


def test_calculate_summary_mixed_skip_and_fail():
    """Skipped lanes with failures still yield not-ready."""
    lanes = {
        "lint": {"status": "skipped"},
        "typecheck": {"status": "fail"},
    }
    summary = calculate_summary_fn(lanes)
    assert summary["overallStatus"] == "not-ready"


def test_calculate_summary_empty():
    """No lanes yields warning (skipped == total)."""
    summary = calculate_summary_fn({})
    assert summary["overallStatus"] == "warning"
    assert summary["overallScore"] == 0.0
    assert summary["total"] == 0


def test_normalize_branch():
    """Branch name normalization replaces separators."""
    assert normalize_branch_fn("feature/my-thing") == "feature-my-thing"
    assert normalize_branch_fn("fix/bug_fix") == "fix-bug-fix"
    assert normalize_branch_fn("main") == "main"
    assert normalize_branch_fn("chore/some_thing-else") == "chore-some-thing-else"


def test_run_command_not_found():
    """run_command returns skipped for missing commands."""
    result = run_command_fn(["nonexistent_cmd_xyz"])
    assert result["status"] == "skipped"


def test_run_command_timeout(mocker):
    """run_command handles timeout errors gracefully."""
    # Mock subprocess.run to raise TimeoutExpired
    mocker.patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd=["fake_cmd"], timeout=1))
    result = run_command_fn(["fake_cmd"])
    assert result["status"] == "fail"
    assert "timed out" in result["stderr"]


def test_run_command_generic_exception(mocker):
    """run_command handles generic exceptions gracefully."""
    # Mock subprocess.run to raise a generic exception
    mocker.patch("subprocess.run", side_effect=Exception("Generic error"))
    result = run_command_fn(["fake_cmd"])
    assert result["status"] == "fail"
    assert result["stderr"] == "Generic error"
    result = run_command_fn(["fake_cmd"])
    assert result["status"] == "fail"
    assert result["stderr"] == "Generic error"
