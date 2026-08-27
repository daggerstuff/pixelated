"""Unit tests for StateManager."""

import os
import tempfile

from tools.agent_runner.state_manager import StateManager


def test_state_manager_lifecycle():
    with tempfile.TemporaryDirectory() as tmp_dir:
        state_file = os.path.join(tmp_dir, "state.json")
        mgr = StateManager(state_file)

        idx0 = mgr.get_and_advance_rr_index(3)
        idx1 = mgr.get_and_advance_rr_index(3)
        idx2 = mgr.get_and_advance_rr_index(3)
        idx3 = mgr.get_and_advance_rr_index(3)

        assert idx0 == 0
        assert idx1 == 1
        assert idx2 == 2
        assert idx3 == 0

        mgr.increment_metric("total_triaged", 5)
        metrics = mgr.get_metrics()
        assert metrics["total_triaged"] == 5

        mgr.record_claim("PIX-10", "opencode", "srv:box")
        claims = mgr.get_active_claims()
        assert "PIX-10" in claims
        assert claims["PIX-10"]["agent"] == "opencode"

        mgr.remove_claim("PIX-10")
        assert "PIX-10" not in mgr.get_active_claims()
