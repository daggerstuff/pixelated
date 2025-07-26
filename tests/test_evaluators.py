import pytest

from ai.pixel.evaluation.clinical_accuracy_evaluator import ClinicalAccuracyEvaluator
from ai.pixel.evaluation.conversational_quality_evaluator import (
    ConversationalQualityEvaluator,
)
from ai.pixel.evaluation.empathy_evaluator import EmpathyEvaluator
from ai.pixel.evaluation.eq_evaluator import EQEvaluator
from ai.pixel.evaluation.persona_switching_evaluator import PersonaSwitchingEvaluator
from ai.pixel.evaluation.therapeutic_appropriateness_evaluator import (
    TherapeuticAppropriatenessEvaluator,
)


@pytest.fixture
def dummy_conversation():
    # Replace with a realistic dummy conversation structure as needed
    return {
        "messages": [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi, how can I help you?"},
        ]
    }


def test_eq_evaluator(dummy_conversation):
    evaluator = EQEvaluator()
    result = evaluator.evaluate(dummy_conversation)
    assert isinstance(result, dict)
    assert all(isinstance(v, float) for v in result.values())


def test_persona_switching_evaluator(dummy_conversation):
    evaluator = PersonaSwitchingEvaluator()
    result = evaluator.evaluate(dummy_conversation)
    assert isinstance(result, dict)
    assert all(isinstance(v, float) for v in result.values())


def test_clinical_accuracy_evaluator(dummy_conversation):
    evaluator = ClinicalAccuracyEvaluator()
    result = evaluator.evaluate(dummy_conversation)
    assert isinstance(result, dict)
    assert all(isinstance(v, float) for v in result.values())


def test_empathy_evaluator(dummy_conversation):
    evaluator = EmpathyEvaluator()
    # Test each method individually for type safety and structure
    res1 = evaluator.differentiate_empathy_simulation(dummy_conversation)
    assert isinstance(res1, dict)
    assert "empathy_simulation_score" in res1
    assert isinstance(res1["empathy_simulation_score"], float)
    res2 = evaluator.track_progressive_empathy(dummy_conversation)
    assert isinstance(res2, dict)
    assert "progressive_empathy_score" in res2
    assert isinstance(res2["progressive_empathy_score"], float)
    res3 = evaluator.measure_empathy_consistency(dummy_conversation)
    assert isinstance(res3, dict)
    assert "empathy_consistency_score" in res3
    assert isinstance(res3["empathy_consistency_score"], float)
    res4 = evaluator.calibrate_against_human(dummy_conversation)
    assert isinstance(res4, dict)
    assert "empathy_calibration_score" in res4
    assert isinstance(res4["empathy_calibration_score"], float)
    res5 = evaluator.visualize_empathy_progression(dummy_conversation)
    assert isinstance(res5, dict)
    assert "empathy_progression_score" in res5
    assert isinstance(res5["empathy_progression_score"], float)
    assert "empathy_scores" in res5
    assert isinstance(res5["empathy_scores"], list)
    # Also test the aggregate evaluate method (should be all floats for backward compatibility)
    result = evaluator.evaluate(dummy_conversation)
    assert isinstance(result, dict)
    assert all(isinstance(v, float) for v in result.values())


def test_conversational_quality_evaluator(dummy_conversation):
    evaluator = ConversationalQualityEvaluator()
    result = evaluator.evaluate(dummy_conversation)
    assert isinstance(result, dict)
    assert all(isinstance(v, float) for v in result.values())


def test_therapeutic_appropriateness_evaluator(dummy_conversation):
    evaluator = TherapeuticAppropriatenessEvaluator()
    result = evaluator.evaluate(dummy_conversation)
    assert isinstance(result, dict)
    assert all(isinstance(v, float) for v in result.values())
