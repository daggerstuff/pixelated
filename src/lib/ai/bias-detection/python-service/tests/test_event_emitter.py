#!/usr/bin/env python3
"""Unit tests for the optional foresight EventBus emitter."""

from enum import StrEnum
from unittest.mock import MagicMock, patch

from bias_detection.services.event_emitter import emit_bias_events


class _FakeEventType(StrEnum):
    BIAS_DETECTED = "bias.detected"
    BIAS_THRESHOLD_EXCEEDED = "bias.threshold_exceeded"
    CRISIS_DETECTED = "crisis.detected"
    CRISIS_THRESHOLD_EXCEEDED = "crisis.threshold_exceeded"


class _FakeEvent:
    """Structural stand-in for foresight.event_bus.Event."""

    def __init__(self, *, id, event_type, timestamp, actor, entity_id, payload, metadata=None):
        self.id = id
        self.event_type = event_type
        self.timestamp = timestamp
        self.actor = actor
        self.entity_id = entity_id
        self.payload = payload
        self.metadata = metadata or {}


def _fake_foresight(bus):
    return (_FakeEvent, _FakeEventType, bus)


def _published_events(bus):
    return [call.args[0] for call in bus.publish.call_args_list]


class TestEventEmitterGracefulDegradation:
    def test_returns_false_when_foresight_unavailable(self):
        with patch(
            "bias_detection.services.event_emitter._load_foresight",
            return_value=None,
        ):
            emitted = emit_bias_events(session_id="s1", user_id="u1", overall_score=0.05, alert_level="low")
        assert emitted is False

    def test_never_raises_when_foresight_unavailable(self):
        with patch(
            "bias_detection.services.event_emitter._load_foresight",
            return_value=None,
        ):
            emit_bias_events(session_id="s1", user_id="u1", overall_score=0.99, alert_level="critical")


class TestEventEmitterEventSelection:
    def test_low_score_publishes_only_bias_detected(self):
        bus = MagicMock()
        with patch(
            "bias_detection.services.event_emitter._load_foresight",
            return_value=_fake_foresight(bus),
        ):
            emitted = emit_bias_events(
                session_id="s1",
                user_id="u1",
                overall_score=0.05,
                alert_level="low",
                detected_biases=["subtle wording"],
            )
        assert emitted is True
        events = _published_events(bus)
        assert [e.event_type for e in events] == [_FakeEventType.BIAS_DETECTED]
        event = events[0]
        assert event.actor == "u1"
        assert event.entity_id == "s1"
        assert event.payload["overall_bias_score"] == 0.05
        assert event.payload["alert_level"] == "low"
        assert event.payload["detected_biases"] == ["subtle wording"]

    def test_warning_score_adds_threshold_exceeded(self):
        bus = MagicMock()
        with patch(
            "bias_detection.services.event_emitter._load_foresight",
            return_value=_fake_foresight(bus),
        ):
            emit_bias_events(session_id="s1", user_id="u1", overall_score=0.3, alert_level="warning")
        events = _published_events(bus)
        assert [e.event_type for e in events] == [
            _FakeEventType.BIAS_DETECTED,
            _FakeEventType.BIAS_THRESHOLD_EXCEEDED,
        ]
        assert events[1].payload["threshold"] == 0.2

    def test_critical_score_publishes_all_four_events(self):
        bus = MagicMock()
        with patch(
            "bias_detection.services.event_emitter._load_foresight",
            return_value=_fake_foresight(bus),
        ):
            emit_bias_events(session_id="s1", user_id="u1", overall_score=0.75, alert_level="critical")
        events = _published_events(bus)
        assert [e.event_type for e in events] == [
            _FakeEventType.BIAS_DETECTED,
            _FakeEventType.BIAS_THRESHOLD_EXCEEDED,
            _FakeEventType.CRISIS_DETECTED,
            _FakeEventType.CRISIS_THRESHOLD_EXCEEDED,
        ]
        assert events[3].payload["threshold"] == 0.7


class TestEventEmitterPublishFailures:
    def test_publish_error_is_swallowed_per_event(self):
        bus = MagicMock()
        bus.publish.side_effect = RuntimeError("stream down")
        with patch(
            "bias_detection.services.event_emitter._load_foresight",
            return_value=_fake_foresight(bus),
        ):
            emit_bias_events(session_id="s1", user_id="u1", overall_score=0.75, alert_level="critical")
        assert bus.publish.call_count == 4
