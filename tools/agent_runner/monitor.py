"""Modern Real-time TUI Observability Monitor & JSON Streamer for Multi-Agent Cluster."""

from __future__ import annotations

import http.server
import json
import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import Any

from tools.agent_runner.cluster_registry import ClusterRegistry
from tools.agent_runner.event_bus import EventBus
from tools.agent_runner.hitl_proxy import EscalationStore
from tools.agent_runner.models import RunnerConfig
from tools.agent_runner.state_manager import StateManager

logger = logging.getLogger("agent_runner.monitor")


class LiveClusterMonitor:
    """Real-time observability monitor with live terminal TUI and HTTP JSON streaming."""

    def __init__(
        self,
        config: RunnerConfig,
        state_mgr: StateManager | None = None,
        event_bus: EventBus | None = None,
        escalation_store: EscalationStore | None = None,
    ):
        self.config = config
        self.state_mgr = state_mgr or StateManager()
        self.cluster = ClusterRegistry(self.state_mgr, self.config)
        self.event_bus = event_bus or EventBus()
        self.escalation_store = escalation_store or EscalationStore()

    def get_cluster_snapshot(self) -> dict[str, Any]:
        """Aggregate full cluster telemetry snapshot."""
        now = time.time()
        active_nodes = self.cluster.get_all_active_nodes()
        active_claims = self.state_mgr.get_active_claims()
        metrics = self.state_mgr.get_metrics()
        recent_events = self.event_bus.replay_recent_events(limit=8)
        pending_escalations = self.escalation_store.get_pending_escalations()

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "server_label": self.config.server_label,
            "hostname": os.uname().nodename,
            "monitored_teams": [p.team_key for p in self.config.projects],
            "agents": [a.name for a in self.config.agents],
            "nodes": [
                {
                    "server_label": n.server_label,
                    "hostname": n.hostname,
                    "active_claims": len(n.active_claims),
                    "last_seen_seconds_ago": int(now - n.last_seen),
                }
                for n in active_nodes
            ],
            "active_claims": [
                {
                    "ticket_identifier": c.ticket_identifier,
                    "agent_name": c.agent_name,
                    "server_label": c.server_label,
                    "worktree_path": c.worktree_path,
                    "claimed_at": c.claimed_at,
                }
                for c in active_claims
            ],
            "pending_escalations": len(pending_escalations),
            "escalations": pending_escalations,
            "metrics": metrics,
            "recent_events": recent_events,
        }

    def render_tui(self) -> str:
        """Render beautiful multi-panel ANSI terminal dashboard."""
        snap = self.get_cluster_snapshot()
        esc_count = snap["pending_escalations"]
        esc_banner = (
            f" 🚨 [ALERT] {esc_count} HITL Escalation(s) Pending! Run 'agent-runner hitl' to resolve."
            if esc_count > 0
            else " ✅ All Agent Execution Loops Autonomous & Healthy"
        )

        lines = [
            "\033[2J\033[H",  # Clear screen and move to home
            "┌" + "─" * 78 + "┐",
            f"│ 🌐 PIXELATED MULTI-AGENT OBSERVABILITY CLUSTER MONITOR {' ' * 21}│",
            f"│ Host: {snap['hostname']:<18} Node: {snap['server_label']:<15} Time: {snap['timestamp'][:19]:<19}│",
            "├" + "─" * 78 + "┤",
            f"│{esc_banner:<78}│",
            "├" + "─" * 78 + "┤",
            "│ 🖥️  ACTIVE CLUSTER NODES:                                                     │",
        ]

        if not snap["nodes"]:
            lines.append(f"│   • [{snap['server_label']}] Local Host (Standalone Mode){' ' * 36}│")
        else:
            for n in snap["nodes"]:
                node_str = f"   • [{n['server_label']}] Host: {n['hostname']} | Claims: {n['active_claims']} | Last Seen: {n['last_seen_seconds_ago']}s ago"
                lines.append(f"│ {node_str:<76} │")

        lines.extend(
            [
                "├" + "─" * 78 + "┤",
                f"│ ⚡ ACTIVE WORKER LEASES ({len(snap['active_claims'])} in-flight):{' ' * 47}│",
            ]
        )

        if not snap["active_claims"]:
            lines.append(f"│   • No active task execution leases. Coordinator idling.{' ' * 22}│")
        else:
            for c in snap["active_claims"]:
                claim_str = f"   • {c['ticket_identifier']} -> Agent: {c['agent_name']} (Node: {c['server_label']})"
                lines.append(f"│ {claim_str:<76} │")

        lines.extend(
            [
                "├" + "─" * 78 + "┤",
                "│ 📜 RECENT STATE EVENT STREAM:                                                │",
            ]
        )

        if not snap["recent_events"]:
            lines.append(f"│   • No recent state events recorded.{' ' * 43}│")
        else:
            for ev in snap["recent_events"]:
                raw_ts = getattr(ev, "timestamp_utc", None) or (ev.get("timestamp_utc") if isinstance(ev, dict) else "") or ""
                ts = raw_ts[11:19] if len(raw_ts) >= 19 else "-"
                
                raw_type = getattr(ev, "event_type", None) or (ev.get("event_type") if isinstance(ev, dict) else "")
                etype = raw_type.value if hasattr(raw_type, "value") else str(raw_type)
                
                ticket = getattr(ev, "ticket_identifier", None) or (ev.get("ticket_identifier") if isinstance(ev, dict) else "") or "-"
                agent = getattr(ev, "agent_name", None) or (ev.get("agent_name") if isinstance(ev, dict) else "") or "-"
                
                ev_str = f"   [{ts}] {etype:<22} | {ticket:<10} | {agent}"
                lines.append(f"│ {ev_str[:76]:<76} │")

        lines.extend(
            [
                "└" + "─" * 78 + "┘",
                " [H] Hitl Resolver | [R] Refresh Tick | [Ctrl+C] Quit",
            ]
        )

        return "\n".join(lines)

    def run_live_tui(self, refresh_interval: int = 2) -> None:
        """Run continuous live-refreshing TUI loop in terminal."""
        try:
            while True:
                print(self.render_tui())
                time.sleep(refresh_interval)
        except KeyboardInterrupt:
            print("\nExiting Cluster Monitor.")

    def start_http_streamer(self, port: int = 8888) -> threading.Thread:
        """Start non-blocking HTTP daemon serving live cluster JSON telemetry."""
        monitor_self = self

        class TelemetryHTTPHandler(http.server.BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                if self.path in ("/", "/api", "/api/telemetry", "/api/cluster"):
                    payload = monitor_self.get_cluster_snapshot()
                    body = json.dumps(payload, indent=2).encode("utf-8")
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(body)))
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    self.wfile.write(body)
                else:
                    self.send_response(404)
                    self.end_headers()

            def log_message(self, format: str, *args: Any) -> None:
                pass  # Suppress HTTP access logging in terminal

        server = http.server.HTTPServer(("0.0.0.0", port), TelemetryHTTPHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        logger.info("Live Cluster JSON Telemetry HTTP Server listening on http://0.0.0.0:%d/api", port)
        return thread
