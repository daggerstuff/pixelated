from ai.training_corpus.pal_framework.meddies_to_pal import format_persona


def test_format_persona_basic():
    record = {
        "demographics": {"age": 45, "gender": "female", "location": "Hanoi"},
        "healthcare_behavior": {"health_literacy": "low", "preference": "traditional medicine"},
    }
    result = format_persona(record)
    expected = (
        "This patient is a 45-year-old female from Hanoi with low health literacy who prefers traditional medicine."
    )
    assert result == expected


def test_format_persona_missing_fields():
    record = {"demographics": {"age": 30}}
    result = format_persona(record)
    expected = (
        "This patient is a 30-year-old person from Vietnam with average health literacy who prefers standard medicine."
    )
    assert result == expected


def test_no_json_leakage():
    record = {
        "demographics": {"age": 60, "gender": "male", "location": "Saigon"},
        "healthcare_behavior": {"health_literacy": "high", "preference": "modern medicine"},
    }
    result = format_persona(record)
    assert "{" not in result
    assert "}" not in result
    assert "'" not in result
    assert '"' not in result
