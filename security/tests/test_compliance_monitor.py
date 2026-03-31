import sys
import os
import importlib.util

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)

spec = importlib.util.spec_from_file_location('compliance_monitor', os.path.join(parent_dir, 'compliance-monitor.py'))
compliance_monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compliance_monitor)

def test_check_data_encryption():
    monitor = compliance_monitor.ComplianceMonitor()
    result = monitor.check_data_encryption()
    assert result is True
