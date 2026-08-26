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
