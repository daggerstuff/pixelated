import pytest


def test_ears_gate_class_exists():
    from ai.core.pipelines.ears_compliance_gate import EarsComplianceGate

    assert EarsComplianceGate is not None


def test_ears_gate_methods_exist():
    from ai.core.pipelines.ears_compliance_gate import EarsComplianceGate

    assert hasattr(EarsComplianceGate, "validate_dataset")
    assert hasattr(EarsComplianceGate, "validate_compliance")
    assert hasattr(EarsComplianceGate, "check_pipeline_sensitivity")


def test_ears_gate_validates_empty_dataset():
    from ai.core.pipelines.ears_compliance_gate import EarsComplianceGate

    gate = EarsComplianceGate()
    result = gate.validate_dataset(dataset_data=[])

    assert result.is_compliant is False
    assert result.total_items == 0


def test_ears_gate_validates_sample_dataset():
    from ai.core.pipelines.ears_compliance_gate import EarsComplianceGate

    gate = EarsComplianceGate()

    sample_data = [
        {"content": "I'm feeling okay today", "label": "neutral"},
        {"content": "I want to hurt myself", "label": "crisis"},
        {"content": "Life is hard sometimes", "label": "neutral"},
    ]

    result = gate.validate_dataset(dataset_data=sample_data)

    assert result is not None
    assert hasattr(result, "is_compliant")
    assert hasattr(result, "sensitivity")
    assert hasattr(result, "total_items")
