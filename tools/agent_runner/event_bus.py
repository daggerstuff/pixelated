"""Append-only immutable state event bus and audit trail."""

from __future__ import annotations

import json
import logging
import os
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any

logger = logging.getLogger("agent_runner.events")


class EventType(StrEnum):
    TICKET_CLAIMED = "TICKET_CLAIMED"
    TICKET_COMPLETED = "TICKET_COMPLETED"
    TICKET_FAILED = "TICKET_FAILED"
    TICKET_DISPATCHED = "TICKET_DISPATCHED"
    AUTO_REPAIR_TRIGGERED = "AUTO_REPAIR_TRIGGERED"
    VERIFICATION_PASSED = "VERIFICATION_PASSED"
    VERIFICATION_FAILED = "VERIFICATION_FAILED"
    PROPOSAL_REGISTERED = "PROPOSAL_REGISTERED"
    CONSENSUS_REACHED = "CONSENSUS_REACHED"
    SKEPTIC_TICKETS_SPAWNED = "SKEPTIC_TICKETS_SPAWNED"


@dataclass
class EventRecord:
    event_type: EventType
    agent_name: str
    ticket_identifier: str
    server_label: str
    payload: dict[str, Any] = field(default_factory=dict)
    timestamp_utc: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class EventBus:
    """Publishes and replays events into an append-only JSONL ledger."""

    def __init__(self, log_path: str | None = None):
        default_path = os.path.expanduser("~/.local/state/agent-runner/state_events.jsonl")
        self.log_path = os.path.abspath(log_path or default_path)
        os.makedirs(os.path.dirname(self.log_path), exist_ok=True)
        self._lock = threading.Lock()

    def publish(
        self,
        event_type: EventType,
        agent_name: str,
        ticket_identifier: str = "",
        server_label: str = "",
        payload: dict[str, Any] | None = None,
    ) -> EventRecord:
        """Append event to state ledger."""
        record = EventRecord(
            event_type=event_type,
            agent_name=agent_name,
            ticket_identifier=ticket_identifier,
            server_label=server_label,
            payload=payload or {},
        )

        with self._lock:
            try:
                with open(self.log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps(asdict(record)) + "\n")
            except Exception as e:
                logger.error("Could not write event to %s: %s", self.log_path, e)

        return record

    def replay_recent_events(self, limit: int = 50) -> list[EventRecord]:
        """Fetch latest events in chronological order."""
        if not os.path.exists(self.log_path):
            return []

        records = []
        with self._lock:
            try:
                with open(self.log_path, encoding="utf-8") as f:
                    lines = f.readlines()
                for line in lines[-limit:]:
                    if line.strip():
                        data = json.loads(line)
                        records.append(
                            EventRecord(
                                event_type=EventType(data["event_type"]),
                                agent_name=data["agent_name"],
                                ticket_identifier=data.get("ticket_identifier", ""),
                                server_label=data.get("server_label", ""),
                                payload=data.get("payload", {}),
                                timestamp_utc=data.get("timestamp_utc", ""),
                            )
                        )
            except Exception as e:
                logger.warning("Error reading state events: %s", e)

        return records
