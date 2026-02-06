import pytest

def test_ears_gate_initial_state_fails():
    """Integration test verifying that the EARS compliance gate initially fails on mock data."""
    from ai.pipelines.orchestrator.ears_compliance_gate import EarsComplianceGate

    # Create a mock compliance gate instance
    gate = EarsComplianceGate()

    # Mock compliance data that should fail the gate (e.g., low crisis sensitivity)
    mock_compliance_data = {
        "crisis_detection_score": 0.2,  # Below the >0.95 threshold
        "metadata": {}
    }

    # The gate should reject this data initially
    with pytest.raises(Exception) as exc_info:
        gate.validate_compliance(mock_compliance_data)

    # Ensure the exception is of the expected type (or any exception for now)
    assert "compliance" in str(exc_info.value).lower()