from bias_detection.sentry_metrics import before_send_event


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
