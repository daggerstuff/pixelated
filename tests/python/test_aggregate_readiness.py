"""
Unit tests for the DevOps Readiness Aggregator (scripts/devops/aggregate-readiness.py).
"""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import httpx
import pytest

# ---------------------------------------------------------------------------
# Load the module via importlib (hyphen in filename prevents direct import)
# ---------------------------------------------------------------------------
_script_path = Path(__file__).resolve().parents[2] / "scripts" / "devops" / "aggregate-readiness.py"
_spec = importlib.util.spec_from_file_location("aggregate_readiness", _script_path)
assert _spec is not None, f"Cannot load {_script_path}"
assert _spec.loader is not None, f"No loader for {_script_path}"
mod = importlib.util.module_from_spec(_spec)
sys.modules["aggregate_readiness"] = mod
_spec.loader.exec_module(mod)

run_command = mod.run_command
calculate_summary = mod.calculate_summary
normalize_branch = mod.normalize_branch
get_git_commit = mod.get_git_commit
get_git_branch = mod.get_git_branch
GitHubActionsClient = mod.GitHubActionsClient
GitLabCIClient = mod.GitLabCIClient
BitbucketPipelinesClient = mod.BitbucketPipelinesClient
fetch_provider_pipelines = mod.fetch_provider_pipelines
calculate_provider_summary = mod.calculate_provider_summary

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_validation_lanes() -> dict[str, dict[str, Any]]:
    return {
        "lint": {"status": "pass", "exitCode": 0, "stdout": "", "stderr": ""},
        "typecheck": {"status": "pass", "exitCode": 0, "stdout": "", "stderr": ""},
        "tests": {"status": "pass", "exitCode": 0, "stdout": "", "stderr": ""},
        "format": {"status": "pass", "exitCode": 0, "stdout": "", "stderr": ""},
    }


@pytest.fixture
def mixed_validation_lanes() -> dict[str, dict[str, Any]]:
    return {
        "lint": {"status": "pass", "exitCode": 0, "stdout": "", "stderr": ""},
        "typecheck": {"status": "fail", "exitCode": 1, "stdout": "", "stderr": "Type error"},
        "tests": {"status": "pass", "exitCode": 0, "stdout": "", "stderr": ""},
        "format": {"status": "skipped", "exitCode": None, "stdout": "", "stderr": ""},
    }


# ---------------------------------------------------------------------------
# Git helpers
# ---------------------------------------------------------------------------


def test_get_git_commit_returns_hash() -> None:
    commit = get_git_commit()
    assert commit == "unknown" or len(commit) == 40


def test_get_git_branch_returns_name() -> None:
    branch = get_git_branch()
    assert branch == "unknown" or len(branch) > 0


def test_normalize_branch_replaces_special_chars() -> None:
    assert normalize_branch("feature/my-feature") == "feature-my-feature"
    assert normalize_branch("feature_123") == "feature-123"
    assert normalize_branch("main") == "main"


def test_normalize_branch_lowercases() -> None:
    assert normalize_branch("FEATURE/X") == "feature-x"


# ---------------------------------------------------------------------------
# run_command
# ---------------------------------------------------------------------------


def test_run_command_echo() -> None:
    result = run_command(["echo", "hello"], max_retries=1)
    assert result["status"] == "pass"
    assert result["exitCode"] == 0
    assert "hello" in result["stdout"]


def test_run_command_not_found() -> None:
    result = run_command(["nonexistent-command-12345"], max_retries=1)
    assert result["status"] == "skipped"
    assert result["exitCode"] is None


def test_run_command_exit_code_failure() -> None:
    result = run_command(["bash", "-c", "exit 1"], max_retries=1)
    assert result["status"] == "fail"
    assert result["exitCode"] == 1


def test_run_command_retries_on_failure(mocker) -> None:
    """Verify retry logic retries max_retries+1 times on persistent failure."""
    mock_run = mocker.patch(f"{mod.__name__}.subprocess.run")
    mock_run.return_value = subprocess.CompletedProcess(["some-cmd"], returncode=1, stdout=b"", stderr=b"")
    result = run_command(["some-cmd"], max_retries=2)
    assert result["status"] == "fail"
    assert mock_run.call_count == 3


def test_run_command_truncates_long_output(mocker) -> None:
    long_stdout = "\n".join([f"line{i}" for i in range(100)])
    mock_result = subprocess.CompletedProcess(
        ["cmd"],
        returncode=0,
        stdout=long_stdout,
        stderr="",
    )
    mocker.patch("subprocess.run", return_value=mock_result)
    result = run_command(["cmd"], max_retries=1)
    assert result["status"] == "pass"
    assert result["stdout"].startswith("...\n")
    assert result["stdout"].count("\n") <= 52


def test_run_command_timeout(mocker):
    mocker.patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd=["fake_cmd"], timeout=1))
    result = run_command(["fake_cmd"], max_retries=1)
    assert result["status"] == "fail"
    assert "timed out" in result["stderr"]


# ---------------------------------------------------------------------------
# calculate_summary
# ---------------------------------------------------------------------------


def test_calculate_summary_all_pass(sample_validation_lanes) -> None:
    summary = calculate_summary(sample_validation_lanes)
    assert summary["total"] == 4
    assert summary["passed"] == 4
    assert summary["failed"] == 0
    assert summary["skipped"] == 0
    assert summary["overallScore"] == 100.0
    assert summary["overallStatus"] == "ready"


def test_calculate_summary_mixed(mixed_validation_lanes) -> None:
    summary = calculate_summary(mixed_validation_lanes)
    assert summary["total"] == 4
    assert summary["passed"] == 2
    assert summary["failed"] == 1
    assert summary["skipped"] == 1
    assert summary["overallStatus"] == "not-ready"


def test_calculate_summary_all_skipped() -> None:
    lanes = {
        "lint": {"status": "skipped"},
        "typecheck": {"status": "skipped"},
    }
    summary = calculate_summary(lanes)
    assert summary["total"] == 2
    assert summary["passed"] == 0
    assert summary["failed"] == 0
    assert summary["skipped"] == 2
    assert summary["overallStatus"] == "warning"


def test_calculate_summary_empty() -> None:
    summary = calculate_summary({})
    assert summary["total"] == 0
    assert summary["overallScore"] == 0.0
    assert summary["overallStatus"] == "warning"


# ---------------------------------------------------------------------------
# Provider clients
# ---------------------------------------------------------------------------


class TestGitHubActionsClient:
    def test_detect_repo_from_ssh_remote(self, mocker) -> None:
        mocker.patch(
            "subprocess.check_output",
            return_value="git@github.com:daggerstuff/pixelated.git\n",
        )
        client = GitHubActionsClient(token="test-token")
        assert client.repo == "daggerstuff/pixelated"

    def test_detect_repo_from_https_remote(self, mocker) -> None:
        mocker.patch(
            "subprocess.check_output",
            return_value="https://github.com/daggerstuff/pixelated.git\n",
        )
        client = GitHubActionsClient(token="test-token")
        assert client.repo == "daggerstuff/pixelated"

    def test_detect_repo_unknown_remote(self, mocker) -> None:
        mocker.patch(
            "subprocess.check_output",
            return_value="git@gitlab.com:org/project.git\n",
        )
        client = GitHubActionsClient(token="test-token")
        assert client.repo is None

    def test_detect_repo_failure_returns_none(self, mocker) -> None:
        mocker.patch("subprocess.check_output", side_effect=Exception("no git"))
        client = GitHubActionsClient(token="test-token")
        assert client.repo is None

    def test_fetch_pipelines_no_token_returns_empty(self) -> None:
        client = GitHubActionsClient(token=None, repo="org/repo")
        assert client.fetch_pipelines("main", "abc123") == []

    def test_fetch_pipelines_no_repo_returns_empty(self) -> None:
        client = GitHubActionsClient(token="test-token", repo=None)
        assert client.fetch_pipelines("main", "abc123") == []

    def test_fetch_pipelines_success(self, mocker) -> None:
        mock_response = mocker.Mock(spec=httpx.Response)
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "workflow_runs": [
                {
                    "name": "CI",
                    "status": "completed",
                    "conclusion": "success",
                    "html_url": "https://github.com/org/repo/actions/runs/1",
                    "run_started_at": "2026-07-30T10:00:00Z",
                    "updated_at": "2026-07-30T10:15:00Z",
                },
                {
                    "name": "Security Scanning",
                    "status": "completed",
                    "conclusion": "success",
                    "html_url": "https://github.com/org/repo/actions/runs/2",
                    "run_started_at": "2026-07-30T10:00:00Z",
                    "updated_at": "2026-07-30T10:12:00Z",
                },
            ]
        }
        mock_response.raise_for_status = lambda: None
        mocker.patch("httpx.get", return_value=mock_response)
        client = GitHubActionsClient(token="test-token", repo="org/repo")
        result = client.fetch_pipelines("main", "abc123")
        assert len(result) == 2
        assert result[0]["name"] == "CI"
        assert result[0]["conclusion"] == "success"

    def test_fetch_pipelines_http_error_returns_empty(self, mocker) -> None:
        mock_response = mocker.Mock(spec=httpx.Response)
        mock_response.status_code = 403
        mock_response.text = '{"message": "Forbidden"}'
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "403 Forbidden", request=mocker.Mock(), response=mock_response
        )
        mocker.patch("httpx.get", return_value=mock_response)
        client = GitHubActionsClient(token="test-token", repo="org/repo")
        assert client.fetch_pipelines("main", "abc123") == []

    def test_fetch_pipelines_network_error_returns_empty(self, mocker) -> None:
        mocker.patch("httpx.get", side_effect=httpx.RequestError("Connection refused"))
        client = GitHubActionsClient(token="test-token", repo="org/repo")
        assert client.fetch_pipelines("main", "abc123") == []

    def test_init_uses_env_token(self, monkeypatch) -> None:
        monkeypatch.setenv("GITHUB_TOKEN", "env-token")
        client = GitHubActionsClient(repo="org/repo")
        assert client.token == "env-token"


class TestGitLabCIClient:
    def test_fetch_pipelines_returns_empty(self) -> None:
        client = GitLabCIClient()
        assert client.fetch_pipelines("main", "abc123") == []


class TestBitbucketPipelinesClient:
    def test_fetch_pipelines_returns_empty(self) -> None:
        client = BitbucketPipelinesClient()
        assert client.fetch_pipelines("main", "abc123") == []


# ---------------------------------------------------------------------------
# fetch_provider_pipelines
# ---------------------------------------------------------------------------


def test_fetch_provider_pipelines_empty_without_token(mocker) -> None:
    mocker.patch("subprocess.check_output", return_value="git@github.com:org/repo.git\n")
    result = fetch_provider_pipelines(branch="main", commit="abc123")
    assert "github" in result
    assert "gitlab" in result
    assert "bitbucket" in result
    assert result["github"] == []
    assert result["gitlab"] == []
    assert result["bitbucket"] == []


def test_fetch_provider_pipelines_respects_enabled_filter(mocker) -> None:
    mocker.patch("subprocess.check_output", return_value="git@github.com:org/repo.git\n")
    result = fetch_provider_pipelines(
        branch="main",
        commit="abc123",
        enabled_providers=["github"],
    )
    assert "github" in result
    assert "gitlab" not in result
    assert "bitbucket" not in result


# ---------------------------------------------------------------------------
# calculate_provider_summary
# ---------------------------------------------------------------------------


def test_calculate_provider_summary_all_success() -> None:
    provider_data = {
        "github": [
            {"name": "CI", "status": "completed", "conclusion": "success"},
            {"name": "Security", "status": "completed", "conclusion": "success"},
        ]
    }
    summary = calculate_provider_summary(provider_data)
    assert summary["total"] == 2
    assert summary["passed"] == 2
    assert summary["failed"] == 0
    assert summary["running"] == 0


def test_calculate_provider_summary_mixed() -> None:
    provider_data = {
        "github": [
            {"name": "CI", "status": "completed", "conclusion": "success"},
            {"name": "Security", "status": "completed", "conclusion": "failure"},
            {"name": "Lint", "status": "in_progress", "conclusion": None},
        ]
    }
    summary = calculate_provider_summary(provider_data)
    assert summary["total"] == 3
    assert summary["passed"] == 1
    assert summary["failed"] == 1
    assert summary["running"] == 1


def test_calculate_provider_summary_empty() -> None:
    summary = calculate_provider_summary({})
    assert summary["total"] == 0
    assert summary["passed"] == 0
    assert summary["failed"] == 0
    assert summary["running"] == 0


def test_calculate_provider_summary_cancelled_is_failure() -> None:
    provider_data = {
        "github": [
            {"name": "Deploy", "status": "completed", "conclusion": "cancelled"},
        ]
    }
    summary = calculate_provider_summary(provider_data)
    assert summary["total"] == 1
    assert summary["passed"] == 0
    assert summary["failed"] == 1


# ---------------------------------------------------------------------------
# Integration: dry-run produces valid schema-conformant output
# ---------------------------------------------------------------------------


def test_aggregate_readiness_dry_run(tmp_path) -> None:
    output_file = tmp_path / "readiness.json"
    exit_code = mod.aggregate_readiness(dry_run=True, output_path=str(output_file))
    assert exit_code == 0
    assert output_file.exists()

    with open(output_file) as f:
        data = json.load(f)

    assert "releaseId" in data
    assert "git" in data
    assert data["git"]["commit"] != "unknown"
    assert "readiness" in data
    assert data["readiness"]["status"] == "ready"
    assert data["readiness"]["score"] == 100.0
    assert "summary" in data
    assert data["summary"]["totalLanes"] == 4
    assert data["summary"]["passedLanes"] == 4
    assert "validationLanes" in data
    assert "lint" in data["validationLanes"]
    assert "typecheck" in data["validationLanes"]
    assert "tests" in data["validationLanes"]
    assert "format" in data["validationLanes"]
    assert "providerPipelines" in data
    assert "providerSummary" in data


# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------


def test_schema_is_valid_json() -> None:
    schema_path = Path(__file__).resolve().parents[2] / "config" / "release-readiness-schema.json"
    assert schema_path.exists()
    with open(schema_path) as f:
        schema = json.load(f)
    assert schema["$schema"] == "http://json-schema.org/draft-07/schema#"
    assert "meta" in schema["properties"]
    assert "readiness" in schema["properties"]
    assert "providerPipelines" in schema["properties"]
    assert "validationLanes" in schema["properties"]
    assert "definitions" in schema
