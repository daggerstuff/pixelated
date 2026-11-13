from bias_detection import sentry_metrics
from bias_detection.sentry_metrics import (
    before_send_event,
    before_send_metric,
    init_sentry,
)


class FakeClient:
    def __init__(self, options: dict | None = None) -> None:
        self.options = options or {}


class FakeSentry:
    def __init__(self, *, initialized: bool = False, options: dict | None = None) -> None:
        self.initialized = initialized
        self.client = FakeClient(options)
        self.init_calls: list[dict] = []
        self.tags: dict[str, str] = {}

    def is_initialized(self) -> bool:
        return self.initialized

    def get_client(self) -> FakeClient:
        return self.client

    def init(self, **kwargs: object) -> None:
        self.init_calls.append(dict(kwargs))
        self.initialized = True

    def set_tag(self, key: str, value: str) -> None:
        self.tags[key] = value


def test_init_sentry_does_not_send_default_pii(monkeypatch) -> None:
    fake = FakeSentry()
    monkeypatch.setattr(sentry_metrics, "_get_sentry_sdk", lambda: fake)

    init_sentry(dsn="https://public@example.invalid/1")

    assert fake.init_calls[0]["send_default_pii"] is False


def test_init_sentry_configures_an_existing_client(monkeypatch) -> None:
    fake = FakeSentry(initialized=True, options={"environment": "earlier"})
    monkeypatch.setattr(sentry_metrics, "_get_sentry_sdk", lambda: fake)

    init_sentry(dsn="https://public@example.invalid/1", environment="bias-detection-service")

    assert fake.init_calls == []
    assert fake.client.options["before_send"] is before_send_event
    assert fake.client.options["before_send_metric"] is before_send_metric
    assert fake.client.options["environment"] == "bias-detection-service"
    assert fake.tags == {"service": "bias-detection-python", "component": "bias-detection"}


def test_before_send_metric_uses_the_client_environment(monkeypatch) -> None:
    fake = FakeSentry(initialized=True, options={"environment": "bias-detection-service"})
    monkeypatch.setattr(sentry_metrics, "_get_sentry_sdk", lambda: fake)

    metric = before_send_metric({"attributes": {}}, None)

    assert metric is not None
    assert metric["attributes"]["environment"] == "bias-detection-service"


def test_metrics_gate_reads_the_environment_at_call_time(monkeypatch) -> None:
    monkeypatch.setenv("SENTRY_ENABLE_METRICS", "false")

    assert sentry_metrics._metrics_enabled() is False


def test_before_send_event_drops_sentry_test_message() -> None:
    event = {"message": "Test: KeyError in process_order"}

    assert before_send_event(event, None) is None


def test_before_send_event_drops_sentry_test_exception_value() -> None:
    event = {
        "exception": {
            "values": [
                {
                    "type": "KeyError",
                    "value": "Test: KeyError in process_order",
                }
            ]
        }
    }

    assert before_send_event(event, None) is None


def test_before_send_event_keeps_real_keyerror() -> None:
    event = {
        "exception": {
            "values": [
                {
                    "type": "KeyError",
                    "value": "KeyError in process_order",
                }
            ]
        }
    }

    assert before_send_event(event, None) == event


def test_before_send_event_drops_lowercase_test_prefix() -> None:
    event = {"message": "test: lowercase test prefix"}

    assert before_send_event(event, None) is None


def test_before_send_event_drops_whitespace_prefixed_test() -> None:
    event = {"message": "  Test: whitespace before Test:"}

    assert before_send_event(event, None) is None


def test_before_send_event_logentry_fallback() -> None:
    event = {"logentry": {"formatted": "Test: KeyError via logentry", "message": "KeyError via logentry"}}

    assert before_send_event(event, None) is None


def test_before_send_event_drops_werkzeug_client_error_log() -> None:
    event = {
        "message": "96.126.104.20 - - [08/Nov/2026 22:11:05] code 400, message Bad request version ('À\\x13À')",
        "tags": {"logger": "werkzeug"},
    }

    assert before_send_event(event, None) is None


def test_before_send_event_drops_werkzeug_tls_client_hello_log() -> None:
    event = {
        "logger": "werkzeug",
        "logentry": {
            "formatted": "176.32.193.16 - - [09/Nov/2026 05:53:43] "
            "code 400, message Bad request syntax ('\\x16\\x03\\x01')",
        },
    }

    assert before_send_event(event, None) is None


def test_before_send_event_drops_werkzeug_client_error_log_with_serialized_tags() -> None:
    event = {
        "message": "127.0.0.1 - - [08/Nov/2026 22:11:05] code 404, message Not Found",
        "tags": [{"key": "logger", "value": "werkzeug"}],
    }

    assert before_send_event(event, None) is None


def test_before_send_event_keeps_werkzeug_server_error_log() -> None:
    event = {
        "message": "127.0.0.1 - - [08/Nov/2026 22:11:05] code 500, message Internal Server Error",
        "tags": {"logger": "werkzeug"},
    }

    assert before_send_event(event, None) == event


def test_before_send_event_keeps_non_werkzeug_client_error_log() -> None:
    event = {
        "message": "96.126.104.20 - - [08/Nov/2026 22:11:05] code 400, message Bad request version ('À\\x13À')",
        "tags": {"logger": "bias_detection.services.cache_service"},
    }

    assert before_send_event(event, None) == event
