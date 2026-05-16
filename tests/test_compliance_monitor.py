import importlib.util
import sys
from pathlib import Path
from unittest.mock import patch

import pytest


@pytest.fixture(scope="session")
def compliance_module(request):
    """
    Session-scoped fixture to dynamically import compliance-monitor.py.
    """
    file_path = Path(request.config.rootpath) / "security" / "compliance-monitor.py"
    module_name = "_compliance_monitor_under_test_unified"

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

class TestComplianceMonitorHIPAA:

    @pytest.mark.parametrize("overrides, expected_score, expected_status", [
        # All pass
        ({
            "check_administrative_safeguards": True,
            "check_physical_safeguards": True,
            "check_technical_safeguards": True,
            "check_breach_notification": True,
            "check_baa": True
        }, 100.0, "compliant"),
        # Some fail (2/5)
        ({
            "check_administrative_safeguards": False,
            "check_physical_safeguards": True,
            "check_technical_safeguards": False,
            "check_breach_notification": True,
            "check_baa": True
        }, 60.0, "non_compliant"),
        # All fail (5/5)
        ({
            "check_administrative_safeguards": False,
            "check_physical_safeguards": False,
            "check_technical_safeguards": False,
            "check_breach_notification": False,
            "check_baa": False
        }, 0.0, "non_compliant")
    ])
    def test_hipaa_compliance_scenarios(self, monitor, overrides, expected_score, expected_status):
        """Test HIPAA compliance aggregation with various safeguard results."""
        with patch.multiple(monitor, 
                           **{k: (lambda x=v: x) for k, v in overrides.items()}):

            result = monitor.monitor_hipaa_compliance()

            assert result["framework"] == "HIPAA"
            assert result["compliance_score"] == expected_score
            assert result["status"] == expected_status

            for method, expected_val in overrides.items():
                key = method.replace("check_", "")
                if key == "baa":
                    key = "business_associate_agreements"
                assert result["checks"][key] == expected_val

class TestComplianceMonitorSOC2:

    @pytest.mark.parametrize("overrides, expected_score, expected_status", [
        # All pass
        ({
            "check_access_controls": True,
            "check_system_monitoring": True,
            "check_data_encryption": True,
            "check_backup_procedures": True,
            "check_incident_response": True
        }, 100.0, "compliant"),
        # Partial failure (2/5 failing)
        ({
            "check_access_controls": False,
            "check_system_monitoring": True,
            "check_data_encryption": False,
            "check_backup_procedures": True,
            "check_incident_response": True
        }, 60.0, "non_compliant"),
        # Single check failure (1/5 failing) - 80% is closest below the 95% threshold
        ({
            "check_access_controls": False,
            "check_system_monitoring": True,
            "check_data_encryption": True,
            "check_backup_procedures": True,
            "check_incident_response": True
        }, 80.0, "non_compliant"),
        # All fail (5/5 failing)
        ({
            "check_access_controls": False,
            "check_system_monitoring": False,
            "check_data_encryption": False,
            "check_backup_procedures": False,
            "check_incident_response": False
        }, 0.0, "non_compliant")
    ])
    def test_soc2_compliance_scenarios(self, monitor, overrides, expected_score, expected_status):
        """Test SOC2 compliance aggregation with various safeguard results."""
        with patch.multiple(monitor, 
                           **{k: (lambda x=v: x) for k, v in overrides.items()}):

            result = monitor.monitor_soc2_compliance()

            assert result["framework"] == "SOC2"
            assert result["compliance_score"] == expected_score
            assert result["status"] == expected_status

            for method, expected_val in overrides.items():
                key = method.replace("check_", "")
                assert result["checks"][key] == expected_val
