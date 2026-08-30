from tools.agent_runner.event_bus import EventBus, EventType
from tools.agent_runner.models import AgentConfig, ProjectConfig, RunnerConfig
from tools.agent_runner.monitor import LiveClusterMonitor
from tools.agent_runner.state_manager import StateManager


def test_live_cluster_monitor_snapshot_and_tui():
    cfg = RunnerConfig(
        server_label="test-node-01",
        agents=[AgentConfig(name="claude", label="agent:claude", cmd=["echo"])],
        projects=[
            ProjectConfig(
                team_key="PIX",
                default_repo="/tmp",
            )
        ],
    )

    state_mgr = StateManager()
    event_bus = EventBus()
    event_bus.publish(EventType.TICKET_CLAIMED, agent_name="claude", ticket_identifier="PIX-100")

    monitor = LiveClusterMonitor(config=cfg, state_mgr=state_mgr, event_bus=event_bus)
    snap = monitor.get_cluster_snapshot()
    assert snap["server_label"] == "test-node-01"
    assert "PIX" in snap["monitored_teams"]
    assert len(snap["recent_events"]) >= 1

    tui_text = monitor.render_tui()
    assert "PIXELATED MULTI-AGENT OBSERVABILITY" in tui_text
    assert "test-node-01" in tui_text
