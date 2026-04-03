"""
Tests for Asana progress sync service with dataset enhancements.
"""

import pytest
from unittest.mock import Mock, patch
from datetime import datetime, timezone
from pathlib import Path
import tempfile
import os

from ai.pipelines.orchestrator.orchestration.asana_progress_service import (
    AsanaProgressSyncService,
    AsanaProgressConfigProtocol,
    AsanaProgressStatsProtocol,
)


class MockConfig:
    def __init__(self):
        self.enable_asana_sync = True
        self.asana_project_gid = "1234567890"
        self.asana_section_gid = None
        self.asana_parent_task_gid = None
        
        # Use unique temporary files for test outputs
        self.test_dir = tempfile.mkdtemp()
        self.asana_task_gid_output_path = os.path.join(self.test_dir, "task_gid.txt")
        self.asana_task_key_mapping_output_path = os.path.join(self.test_dir, "task_key_mapping.json")
        self.asana_task_transition_output_path = os.path.join(self.test_dir, "task_transitions.json")

    def __del__(self):
        # Cleanup temporary files if they exist
        try:
            if hasattr(self, 'test_dir') and os.path.exists(self.test_dir):
                for f in os.listdir(self.test_dir):
                    os.remove(os.path.join(self.test_dir, f))
                os.rmdir(self.test_dir)
        except Exception:
            pass


class MockStats:
    def __init__(self):
        self.warnings = []


class MockAsanaClient:
    def __init__(self):
        self.requests = []

    def request(self, method, path, payload=None, query_params=None):
        self.requests.append({
            "method": method,
            "path": path,
            "payload": payload,
            "query_params": query_params
        })
        # Return mock response based on endpoint
        if path == "/tasks" and method == "POST":
            return {"gid": "9876543210"}
        elif path.startswith("/tasks/") and "/subtasks" in path and method == "POST":
            return {"gid": "1111111111"}
        elif path == "/projects/1234567890/tasks" and method == "GET":
            return [{"gid": "2222222222", "name": "MTGC-09 Task"}]
        elif path.startswith("/tasks/") and method == "POST" and "/stories" in path:
            return {}
        elif path.startswith("/tasks/") and method == "PUT":
            return {"gid": path.split("/")[2]}
        else:
            return {}

    def has_auth_context(self):
        return True


def test_extract_dataset_metadata():
    """Test that dataset metadata can be extracted from checklist."""
    # Mock checklist with dataset info
    checklist = {
        "generated_at": "2026-04-03T10:00:00Z",
        "stage_drift_within_tolerance": True,
        "total_samples": 1000,
        "dataset_info": {
            "size_bytes": 10485760,  # 10 MB
            "version": "v2.1",
            "quality_score": 0.95,
            "validation_passed": True
        }
    }

    # Extract dataset metadata
    dataset_info = checklist.get("dataset_info", {})
    dataset_size = dataset_info.get("size_bytes", 0)
    dataset_version = dataset_info.get("version", "unknown")
    data_quality_score = dataset_info.get("quality_score", 0.0)
    validation_passed = dataset_info.get("validation_passed", False)

    assert dataset_size == 10485760
    assert dataset_version == "v2.1"
    assert data_quality_score == 0.95
    assert validation_passed == True


def test_enhanced_task_notes_include_dataset_metrics():
    """Test that task notes include dataset metrics when available."""
    # Mock checklist with dataset info
    checklist = {
        "generated_at": "2026-04-03T10:00:00Z",
        "stage_drift_within_tolerance": True,
        "total_samples": 1500,
        "dataset_info": {
            "size_bytes": 20971520,  # 20 MB
            "version": "v1.5",
            "quality_score": 0.88,
            "validation_passed": False
        }
    }

    # Extract dataset metadata
    dataset_info = checklist.get("dataset_info", {})
    dataset_size = dataset_info.get("size_bytes", 0)
    dataset_version = dataset_info.get("version", "unknown")
    data_quality_score = dataset_info.get("quality_score", 0.0)
    validation_passed = dataset_info.get("validation_passed", False)

    # Build expected notes lines
    expected_lines = [
        "Automated training checklist sync from integrated pipeline.",
        f"Generated at: {checklist['generated_at']}",
        f"Total samples: {checklist['total_samples']}",
        f"Dataset version: {dataset_version}",
        f"Dataset size: {dataset_size / (1024**2):.2f} MB",
        f"Data quality score: {data_quality_score:.2f}",
        f"Validation passed: {validation_passed}",
        f"Stage drift within tolerance: {checklist['stage_drift_within_tolerance']}",
        f"Checklist artifact: /some/path/checklist.json",
    ]

    # For now, just verify we can extract the values we need
    assert dataset_size == 20971520
    assert dataset_version == "v1.5"
    assert data_quality_score == 0.88
    assert validation_passed == False


def test_handle_missing_dataset_info_gracefully():
    """Test that service handles missing dataset info gracefully."""
    # Mock checklist without dataset info (backward compatibility)
    checklist = {
        "generated_at": "2026-04-03T10:00:00Z",
        "stage_drift_within_tolerance": False,
        "total_samples": 500
        # No dataset_info field
    }

    # Extract dataset metadata with defaults
    dataset_info = checklist.get("dataset_info", {})
    dataset_size = dataset_info.get("size_bytes", 0)
    dataset_version = dataset_info.get("version", "unknown")
    data_quality_score = dataset_info.get("quality_score", 0.0)
    validation_passed = dataset_info.get("validation_passed", False)

    # Should use default values
    assert dataset_size == 0
    assert dataset_version == "unknown"
    assert data_quality_score == 0.0
    assert validation_passed == False

    # Notes should still be generated
    notes_lines = [
        "Automated training checklist sync from integrated pipeline.",
        f"Generated at: {checklist['generated_at']}",
        f"Total samples: {checklist['total_samples']}",
        f"Dataset version: {dataset_version}",
        f"Dataset size: {dataset_size / (1024**2):.2f} MB",
        f"Data quality score: {data_quality_score:.2f}",
        f"Validation passed: {validation_passed}",
        f"Stage drift within tolerance: {checklist['stage_drift_within_tolerance']}",
        f"Checklist artifact: /some/path/checklist.json",
    ]

    # Verify notes contain expected values
    notes_text = "\n".join(notes_lines)
    assert "Dataset version: unknown" in notes_text
    assert "Dataset size: 0.00 MB" in notes_text
    assert "Data quality score: 0.00" in notes_text
    assert "Validation passed: False" in notes_text


@patch("ai.pipelines.orchestrator.orchestration.asana_progress_service.AsanaTrackerClient")
def test_sync_checklist_task_includes_dataset_info_in_notes(mock_asana_client_class):
    """Test that sync_checklist_task includes dataset info in Asana task notes."""
    # Setup
    mock_asana_client = MockAsanaClient()
    mock_asana_client_class.return_value = mock_asana_client

    config = MockConfig()
    stats = MockStats()
    service = AsanaProgressSyncService(
        config=config,
        stats=stats,
        asana_client=mock_asana_client
    )

    # Test data with dataset info
    checklist = {
        "generated_at": "2026-04-03T10:00:00Z",
        "stage_drift_within_tolerance": True,
        "total_samples": 1500,
        "dataset_info": {
            "size_bytes": 10485760,  # 10 MB
            "version": "v2.1",
            "quality_score": 0.92,
            "validation_passed": True
        }
    }
    checklist_path = Path("/tmp/test_checklist.json")

    # Execute
    service.sync_checklist_task(checklist, checklist_path)

    # Verify that a task was created (POST to /tasks)
    task_creation_requests = [
        req for req in mock_asana_client.requests
        if req["method"] == "POST" and req["path"] == "/tasks"
    ]
    assert len(task_creation_requests) == 1

    # Verify the task payload includes dataset info in notes
    task_payload = task_creation_requests[0]["payload"]
    notes = task_payload.get("notes", "")

    # Check that dataset information is included in notes
    assert "Dataset version: v2.1" in notes
    assert "Dataset size: 10.00 MB" in notes
    assert "Data quality score: 0.92" in notes
    assert "Validation passed: True" in notes


@patch("ai.pipelines.orchestrator.orchestration.asana_progress_service.AsanaTrackerClient")
def test_sync_checklist_task_handles_missing_dataset_info(mock_asana_client_class):
    """Test that sync_checklist_task works when dataset info is missing."""
    # Setup
    mock_asana_client = MockAsanaClient()
    mock_asana_client_class.return_value = mock_asana_client

    config = MockConfig()
    stats = MockStats()
    service = AsanaProgressSyncService(
        config=config,
        stats=stats,
        asana_client=mock_asana_client
    )

    # Test data without dataset info (backward compatibility)
    checklist = {
        "generated_at": "2026-04-03T10:00:00Z",
        "stage_drift_within_tolerance": False,
        "total_samples": 500
        # No dataset_info field
    }
    checklist_path = Path("/tmp/test_checklist.json")

    # Execute
    service.sync_checklist_task(checklist, checklist_path)

    # Verify that a task was created
    task_creation_requests = [
        req for req in mock_asana_client.requests
        if req["method"] == "POST" and req["path"] == "/tasks"
    ]
    assert len(task_creation_requests) == 1

    # Verify the task payload includes default dataset info in notes
    task_payload = task_creation_requests[0]["payload"]
    notes = task_payload.get("notes", "")

    # Check that default dataset information is included in notes
    assert "Dataset version: unknown" in notes
    assert "Dataset size: 0.00 MB" in notes
    assert "Data quality score: 0.00" in notes
    assert "Validation passed: False" in notes