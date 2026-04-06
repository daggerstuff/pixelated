import importlib.util
from pathlib import Path
import pytest
import sys

# Dynamically import compliance-monitor.py due to hyphen in filename
module_name = "compliance_monitor"
file_path = Path(__file__).parent.parent.parent / "security" / "compliance-monitor.py"
spec = importlib.util.spec_from_file_location(module_name, file_path)
module = importlib.util.module_from_spec(spec)
sys.modules[module_name] = module
spec.loader.exec_module(module)

ComplianceMonitor = module.ComplianceMonitor

def test_check_access_controls():
    monitor = ComplianceMonitor()
    assert monitor.check_access_controls() is True

def test_check_system_monitoring():
    monitor = ComplianceMonitor()
    assert monitor.check_system_monitoring() is True

def test_check_data_encryption():
    monitor = ComplianceMonitor()
    assert monitor.check_data_encryption() is True
