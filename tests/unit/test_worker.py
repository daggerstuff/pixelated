import json
from pathlib import Path
from unittest.mock import patch
from datetime import datetime, timezone
import pytest

# Import the module under test
# Note: workflow/ is not a package, so we may need to handle the import path
import sys
import importlib.util

@pytest.fixture(scope="session")
def worker_module(request):
    """
    Dynamically loads workflow/worker.py to handle non-package import.
    """
    file_path = Path(request.config.rootpath) / "workflow" / "worker.py"
    module_name = "worker_under_test"
    
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec is None or spec.loader is None:
        pytest.fail(f"Could not load worker.py from {file_path}")
    
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except Exception as e:
        pytest.fail(f"Execution of worker.py failed: {e}")
        
    return module

def test_log_event(worker_module, tmp_path):
    """
    Verifies that log_event correctly appends a JSON entry to the log file.
    Uses a temporary path to avoid side effects.
    """
    log_file = tmp_path / "audit.log"
    
    # Patch the global LOG_PATH in the worker module
    with patch.object(worker_module, "LOG_PATH", str(log_file)):
        worker_module.log_event("evt_123", "test message")
        
        # Verify file content
        assert log_file.exists()
        lines = log_file.read_text().strip().split("\n")
        assert len(lines) == 1
        
        data = json.loads(lines[0])
        assert data["event_id"] == "evt_123"
        assert data["message"] == "test message"
        assert "timestamp" in data
        
        # Verify timestamp format (ISO 8601)
        try:
            datetime.fromisoformat(data["timestamp"])
        except ValueError:
            pytest.fail("Timestamp is not in valid ISO format")

def test_log_event_multiple_entries(worker_module, tmp_path):
    """Verifies that multiple calls to log_event append to the same file."""
    log_file = tmp_path / "audit_multi.log"
    
    with patch.object(worker_module, "LOG_PATH", str(log_file)):
        worker_module.log_event("evt_1", "first message")
        worker_module.log_event("evt_2", "second message")
        
        lines = log_file.read_text().strip().split("\n")
        assert len(lines) == 2
        assert json.loads(lines[0])["event_id"] == "evt_1"
        assert json.loads(lines[1])["event_id"] == "evt_2"
