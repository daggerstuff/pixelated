"""Unit tests for EventBus."""

import os
import tempfile

from tools.agent_runner.event_bus import EventBus, EventType


def test_event_bus_publish_and_replay():
    with tempfile.TemporaryDirectory() as tmp_dir:
        log_file = os.path.join(tmp_dir, "events.jsonl")
        bus = EventBus(log_file)

        bus.publish(
            EventType.TICKET_CLAIMED,
            agent_name="opencode",
            ticket_identifier="PIX-1",
            server_label="srv:box",
            payload={"msg": "claimed"},
        )
        bus.publish(
            EventType.TICKET_COMPLETED,
            agent_name="opencode",
            ticket_identifier="PIX-1",
            server_label="srv:box",
            payload={"msg": "done"},
        )

        events = bus.replay_recent_events(limit=10)
        assert len(events) == 2
        assert events[0].event_type == EventType.TICKET_CLAIMED
        assert events[1].event_type == EventType.TICKET_COMPLETED
