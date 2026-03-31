import os
import sys
import importlib.util

# Load the module dynamically since it has a hyphen in the filename
spec = importlib.util.spec_from_file_location(
    "compliance_monitor",
    os.path.join(os.path.dirname(__file__), "..", "security", "compliance-monitor.py")
)
compliance_monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compliance_monitor)

ComplianceMonitor = compliance_monitor.ComplianceMonitor

class TestComplianceMonitorHIPAA:
    def test_hipaa_compliance_all_pass(self):
        monitor = ComplianceMonitor()
        result = monitor.monitor_hipaa_compliance()

        assert result["framework"] == "HIPAA"
        assert result["compliance_score"] == 100.0
        assert result["status"] == "compliant"
        assert all(result["checks"].values())

    def test_hipaa_compliance_some_fail(self):
        monitor = ComplianceMonitor()

        # Override a few methods to simulate failure
        monitor.check_administrative_safeguards = lambda: False
        monitor.check_technical_safeguards = lambda: False

        result = monitor.monitor_hipaa_compliance()

        assert result["framework"] == "HIPAA"
        assert result["compliance_score"] == 60.0
        assert result["status"] == "non_compliant"
        assert result["checks"]["administrative_safeguards"] is False
        assert result["checks"]["technical_safeguards"] is False
        assert result["checks"]["physical_safeguards"] is True

    def test_hipaa_compliance_all_fail(self):
        monitor = ComplianceMonitor()

        # Override all methods to simulate failure
        monitor.check_administrative_safeguards = lambda: False
        monitor.check_physical_safeguards = lambda: False
        monitor.check_technical_safeguards = lambda: False
        monitor.check_breach_notification = lambda: False
        monitor.check_baa = lambda: False

        result = monitor.monitor_hipaa_compliance()

        assert result["framework"] == "HIPAA"
        assert result["compliance_score"] == 0.0
        assert result["status"] == "non_compliant"
        assert not any(result["checks"].values())
