"""
Unit tests for CI/CD Release Readiness Aggregator.
"""

import importlib.util
import json
import sys
from pathlib import Path

# Dynamically import the hyphenated CLI script file
scripts_dir = Path(__file__).resolve().parents[3] / "scripts" / "ci"
script_path = scripts_dir / "release-readiness-aggregator.py"

spec = importlib.util.spec_from_file_location("release_readiness_aggregator", script_path)
aggregator = importlib.util.module_from_spec(spec)
sys.modules["release_readiness_aggregator"] = aggregator
spec.loader.exec_module(aggregator)

mock_provider_status = aggregator.mock_provider_status
aggregate_readiness = aggregator.aggregate_readiness


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
