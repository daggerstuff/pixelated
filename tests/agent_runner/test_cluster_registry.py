"""Unit tests for ClusterRegistry."""

import os
import tempfile
import time

from tools.agent_runner.cluster_registry import ClusterRegistry
from tools.agent_runner.models import RunnerConfig
from tools.agent_runner.state_manager import StateManager


def test_cluster_registry_heartbeat_and_reclaim():
    with tempfile.TemporaryDirectory() as tmp_dir:
        state_mgr = StateManager(os.path.join(tmp_dir, "state.json"))
        cfg = RunnerConfig(server_label="srv:test-node")
        registry = ClusterRegistry(state_mgr, cfg, registry_dir=tmp_dir)

        registry.record_heartbeat()
        nodes = registry.get_all_active_nodes(max_age_seconds=60)
        assert len(nodes) == 1
        assert nodes[0].server_label == "srv:test-node"

        # Record a stale claim and reclaim
        state_mgr.record_claim("PIX-1", "opencode", "srv:dead-node")
        # Manipulate timestamp to make it stale
        with state_mgr._lock:
            state_mgr._state["active_claims"]["PIX-1"]["timestamp"] = time.time() - 5000
            state_mgr._save_locked()

        reclaimed = registry.reclaim_stale_claims(stale_threshold_seconds=3600)
        assert "PIX-1" in reclaimed
        assert len(state_mgr.get_active_claims()) == 0
