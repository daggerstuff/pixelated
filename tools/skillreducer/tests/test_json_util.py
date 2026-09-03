from skillreducer.llm.json_util import parse_llm_json


def test_parse_plain_json() -> None:
    assert parse_llm_json('{"name": "x"}') == {"name": "x"}


def test_parse_fenced_json() -> None:
    text = '```json\n{"passes": true}\n```'
    assert parse_llm_json(text) == {"passes": True}


def test_parse_json_in_prose() -> None:
    text = 'Here is the result:\n{"selected": "jwt-auth"}\nThanks.'
    assert parse_llm_json(text) == {"selected": "jwt-auth"}


def test_parse_empty_returns_none() -> None:
    assert parse_llm_json("") is None
    assert parse_llm_json("   ") is None
    assert parse_llm_json("not json at all") is None
