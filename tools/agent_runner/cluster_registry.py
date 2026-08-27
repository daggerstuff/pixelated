"""Cluster heartbeat registry and stale claim auto-reclaim coordinator."""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import asdict, dataclass, field

from tools.agent_runner.models import RunnerConfig
from tools.agent_runner.state_manager import StateManager

logger = logging.getLogger("agent_runner.cluster")


@dataclass
class ServerHeartbeat:
    server_label: str
    hostname: str
    last_seen: float
    active_claims: list[str] = field(default_factory=list)
    version: str = "2.0.0"


class ClusterRegistry:
    """Discovers peer nodes, heartbeats, and reclaims stale leases across servers."""

    def __init__(self, state_mgr: StateManager, config: RunnerConfig, registry_dir: str | None = None):
        self.state_mgr = state_mgr
        self.config = config
        default_dir = os.path.expanduser("~/.local/state/agent-runner/nodes")
        self.registry_dir = os.path.abspath(registry_dir or default_dir)
        os.makedirs(self.registry_dir, exist_ok=True)
        self.heartbeat_file = os.path.join(self.registry_dir, f"{config.server_label.replace(':', '_')}.json")

    def record_heartbeat(self) -> None:
        """Write heartbeat file for this node."""
        hb = ServerHeartbeat(
            server_label=self.config.server_label,
            hostname=os.uname().nodename,
            last_seen=time.time(),
            active_claims=list(self.state_mgr.get_active_claims().keys()),
        )
        temp_file = f"{self.heartbeat_file}.tmp"
        try:
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(asdict(hb), f, indent=2)
            os.replace(temp_file, self.heartbeat_file)
        except Exception as e:
            logger.warning("Could not write node heartbeat: %s", e)

    def get_all_active_nodes(self, max_age_seconds: int = 180) -> list[ServerHeartbeat]:
        """Fetch all peer nodes that heartbeated recently."""
        active_nodes: list[ServerHeartbeat] = []
        now = time.time()

        if not os.path.exists(self.registry_dir):
            return active_nodes

        for f in os.listdir(self.registry_dir):
            if f.endswith(".json"):
                fpath = os.path.join(self.registry_dir, f)
                try:
                    with open(fpath, encoding="utf-8") as fp:
                        data = json.load(fp)
                        hb = ServerHeartbeat(**data)
                        if now - hb.last_seen < max_age_seconds:
                            active_nodes.append(hb)
                except Exception as e:
                    logger.debug("Error reading node file %s: %s", f, e)

        return active_nodes

    def reclaim_stale_claims(self, stale_threshold_seconds: int = 3600) -> list[str]:
        """Reclaim abandoned ticket claims from dead servers."""
        reclaimed = []
        active_claims = self.state_mgr.get_active_claims()
        now = time.time()

        for ticket_id, info in active_claims.items():
            claimed_ts = info.get("timestamp", 0)
            if now - claimed_ts > stale_threshold_seconds:
                logger.warning(
                    "Reclaiming stale claim for ticket %s (claimed by %s on %s)",
                    ticket_id,
                    info.get("agent"),
                    info.get("server"),
                )
                self.state_mgr.remove_claim(ticket_id)
                reclaimed.append(ticket_id)

        return reclaimed
