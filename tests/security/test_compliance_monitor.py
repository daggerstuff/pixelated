import importlib.util
import sys
from pathlib import Path
from unittest.mock import patch
import pytest

@pytest.fixture(scope="session")
def compliance_module(request):
    """
    Session-scoped fixture to dynamically import compliance-monitor.py.
    Ensures a fresh import and avoids sys.modules contamination.
    """
    file_path = Path(request.config.rootpath) / "security" / "compliance-monitor.py"
    module_name = "_compliance_monitor_under_test"
    
    # Remove if already exists to force reload
    if module_name in sys.modules:
        del sys.modules[module_name]
        
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec is None or spec.loader is None:
        pytest.fail(f"Could not load compliance-monitor.py from {file_path}")
    
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    try:
        spec.loader.exec_module(module)
    except Exception as e:
        pytest.fail(f"Execution of compliance-monitor.py failed: {e}")
        
    return module

@pytest.fixture
def monitor(compliance_module):
    """Provides a fresh instance of ComplianceMonitor for each test."""
    return compliance_module.ComplianceMonitor()

class TestComplianceMonitor:
    
    def test_check_access_controls_compliant(self, monitor):
        """Should return True when both JWT_SECRET and ENCRYPTION_KEY are set."""
        with patch.dict("os.environ", {"JWT_SECRET": "secret", "ENCRYPTION_KEY": "key"}, clear=True):
            assert monitor.check_access_controls() is True

    def test_check_access_controls_non_compliant(self, monitor):
        """Should return False when mandatory secrets are missing."""
        # Test completely empty environment
        with patch.dict("os.environ", {}, clear=True):
            assert monitor.check_access_controls() is False
            
        # Test missing ENCRYPTION_KEY
        with patch.dict("os.environ", {"JWT_SECRET": "secret"}, clear=True):
            assert monitor.check_access_controls() is False
            
        # Test missing JWT_SECRET
        with patch.dict("os.environ", {"ENCRYPTION_KEY": "key"}, clear=True):
            assert monitor.check_access_controls() is False

    def test_check_system_monitoring_compliant(self, monitor):
        """Should return True when SENTRY_DSN is set."""
        with patch.dict("os.environ", {"SENTRY_DSN": "https://dsn.example.com"}, clear=True):
            assert monitor.check_system_monitoring() is True

    def test_check_system_monitoring_non_compliant(self, monitor):
        """Should return False when SENTRY_DSN is missing."""
        with patch.dict("os.environ", {}, clear=True):
            assert monitor.check_system_monitoring() is False

    def test_check_data_encryption_compliant(self, monitor):
        """Should return True when FORCE_SSL is true."""
        with patch.dict("os.environ", {"FORCE_SSL": "true"}, clear=True):
            assert monitor.check_data_encryption() is True

    def test_check_data_encryption_non_compliant(self, monitor):
        """Should return False when FORCE_SSL is not true."""
        with patch.dict("os.environ", {"FORCE_SSL": "false"}, clear=True):
            assert monitor.check_data_encryption() is False
        
        with patch.dict("os.environ", {}, clear=True):
            assert monitor.check_data_encryption() is False

    def test_generate_compliance_report_structure(self, monitor):
        """Should generate a report with the expected keys and types."""
        report = monitor.generate_compliance_report()
        
        assert "timestamp" in report
        assert "overall_compliance_score" in report
        assert "compliance_monitoring" in report
        assert isinstance(report["overall_compliance_score"], (int, float))
