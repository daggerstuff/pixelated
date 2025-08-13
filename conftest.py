"""
Pytest configuration and fixtures for Pixelated Empathy AI
"""

import pytest
import os
import sys
import tempfile
import json
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

# Add project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "ai"))
sys.path.insert(0, str(project_root / "src"))

@pytest.fixture(scope="session")
def project_root():
    """Project root directory fixture"""
    return Path(__file__).parent

@pytest.fixture(scope="session") 
def ai_root(project_root):
    """AI module root directory fixture"""
    return project_root / "ai"

@pytest.fixture(scope="function")
def temp_dir():
    """Temporary directory fixture"""
    with tempfile.TemporaryDirectory() as tmp_dir:
        yield Path(tmp_dir)

@pytest.fixture(scope="function")
def mock_config():
    """Mock configuration fixture"""
    return {
        "model": {
            "name": "test_model",
            "version": "1.0.0",
            "parameters": {"max_length": 512}
        },
        "training": {
            "batch_size": 32,
            "learning_rate": 0.001,
            "epochs": 10
        },
        "data": {
            "input_dir": "/tmp/test_data",
            "output_dir": "/tmp/test_output"
        }
    }

@pytest.fixture(scope="function")
def sample_dataset():
    """Sample dataset fixture for testing"""
    return [
        {"input": "Hello", "output": "Hi there!", "label": "greeting"},
        {"input": "How are you?", "output": "I'm doing well, thank you!", "label": "wellbeing"},
        {"input": "Goodbye", "output": "See you later!", "label": "farewell"}
    ]

@pytest.fixture(scope="function")
def mock_model():
    """Mock AI model fixture"""
    model = Mock()
    model.predict.return_value = "Mock response"
    model.train.return_value = {"loss": 0.1, "accuracy": 0.95}
    model.evaluate.return_value = {"precision": 0.9, "recall": 0.85, "f1": 0.87}
    return model

@pytest.fixture(scope="function")
def mock_database():
    """Mock database connection fixture"""
    db = Mock()
    db.connect.return_value = True
    db.execute.return_value = {"status": "success", "rows_affected": 1}
    db.fetch.return_value = [{"id": 1, "data": "test"}]
    return db

@pytest.fixture(scope="function")
def mock_api_client():
    """Mock API client fixture"""
    client = Mock()
    client.get.return_value = {"status": 200, "data": {"message": "success"}}
    client.post.return_value = {"status": 201, "data": {"id": 123}}
    return client

@pytest.fixture(autouse=True)
def setup_test_environment(monkeypatch):
    """Automatically set up test environment for all tests"""
    # Set test environment variables
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    
    # Mock external services
    with patch("requests.get") as mock_get, \
         patch("requests.post") as mock_post:
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {"status": "ok"}
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"status": "created"}
        yield

@pytest.fixture(scope="function")
def capture_logs(caplog):
    """Capture and return log messages"""
    return caplog

# Pytest configuration
def pytest_configure(config):
    """Configure pytest with custom markers"""
    config.addinivalue_line("markers", "unit: Unit tests")
    config.addinivalue_line("markers", "integration: Integration tests") 
    config.addinivalue_line("markers", "slow: Slow running tests")
    config.addinivalue_line("markers", "security: Security tests")
    config.addinivalue_line("markers", "performance: Performance tests")

def pytest_collection_modifyitems(config, items):
    """Modify test collection to add markers automatically"""
    for item in items:
        # Add unit marker to all tests in unit test directories
        if "unit" in str(item.fspath):
            item.add_marker(pytest.mark.unit)
        
        # Add integration marker to integration tests
        if "integration" in str(item.fspath):
            item.add_marker(pytest.mark.integration)
        
        # Add slow marker to tests that might be slow
        if any(keyword in item.name.lower() for keyword in ["slow", "benchmark", "performance"]):
            item.add_marker(pytest.mark.slow)
