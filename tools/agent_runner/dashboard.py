"""Live terminal observability monitor and cluster dashboard."""

from __future__ import annotations

import logging
import os
import time

from tools.agent_runner.cluster_registry import ClusterRegistry
from tools.agent_runner.event_bus import EventBus
from tools.agent_runner.models import RunnerConfig
from tools.agent_runner.state_manager import StateManager

logger = logging.getLogger("agent_runner.dashboard")


class ClusterDashboard:
    """Renders real-time cluster health, active leases, metrics, and state event stream."""

    def __init__(self, config: RunnerConfig, state_mgr: StateManager | None = None, event_bus: EventBus | None = None):
        self.config = config
        self.state_mgr = state_mgr or StateManager()
        self.cluster = ClusterRegistry(self.state_mgr, self.config)
        self.event_bus = event_bus or EventBus()

    def render_text(self) -> str:
        """Generate text dashboard string."""
        now = time.time()
        active_nodes = self.cluster.get_all_active_nodes()
        active_claims = self.state_mgr.get_active_claims()
        metrics = self.state_mgr.get_metrics()
        recent_events = self.event_bus.replay_recent_events(limit=5)

        lines = [
            "=" * 80,
            " 🌐 LINEAR MULTI-AGENT CLUSTER OBSERVABILITY DASHBOARD",
            "=" * 80,
            f" Local Server:  {self.config.server_label} ({os.uname().nodename})",
            f" Configured Agents: {', '.join([a.name for a in self.config.agents])}",
            f" Monitored Teams:   {', '.join([p.team_key for p in self.config.projects])}",
            "-" * 80,
            " 🖥️  ACTIVE CLUSTER NODES:",
        ]

        if not active_nodes:
            lines.append(f"   • [{self.config.server_label}] Host: {os.uname().nodename} (Standalone Mode)")
        else:
            for node in active_nodes:
                age = int(now - node.last_seen)
                lines.append(
                    f"   • [{node.server_label}] Host: {node.hostname} | Active Claims: {len(node.active_claims)} | Seen: {age}s ago"
                )

        lines.extend(
            [
                "-" * 80,
                f" ⚡ ACTIVE WORKER LEASES ({len(active_claims)} active):",
            ]
        )

        if not active_claims:
            lines.append("   (All agent workers are idle / ready for tasks)")
        else:
            for ticket_id, info in active_claims.items():
                lines.append(f"   • [{ticket_id}] -> Agent: {info.get('agent')} on Server: {info.get('server')}")

        lines.extend(
            [
                "-" * 80,
                " 📊 LIFETIME EXECUTION METRICS:",
                f"   • Total Triaged:         {metrics.get('total_triaged', 0)}",
                f"   • Completed (In Review): {metrics.get('total_completed', 0)}",
                f"   • Failed:                {metrics.get('total_failed', 0)}",
                f"   • Skeptic Reviews:       {metrics.get('skeptic_reviews', 0)}",
                "-" * 80,
                " 📜 RECENT EVENT STREAM:",
            ]
        )

        if not recent_events:
            lines.append("   (No state events recorded yet)")
        else:
            for ev in recent_events:
                ts = ev.timestamp_utc[11:19] if len(ev.timestamp_utc) >= 19 else "00:00:00"
                lines.append(f"   [{ts}] {ev.event_type.value} [{ev.agent_name}] ({ev.ticket_identifier})")

        lines.append("=" * 80)
        return "\n".join(lines)
