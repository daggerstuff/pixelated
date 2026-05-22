from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

from hypothesis import given, settings, strategies as st


def _load_quality_scoring_module():
    module_path = Path(__file__).resolve().parents[3] / "scripts" / "data" / "quality_scoring" / "scoring_interface.py"
    spec = importlib.util.spec_from_file_location("quality_scoring_interface", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load quality scoring module from {module_path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


quality_scoring = _load_quality_scoring_module()
Signals = quality_scoring.Signals
compose_score = quality_scoring.compose_score
compute_signals = quality_scoring.compute_signals

UNSAFE_TOKENS = ("kill", "suicide", "harm yourself", "hate")
TEXT = st.text(max_size=400)
SCORE = st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False)
WEIGHT = st.floats(min_value=0.0, max_value=5.0, allow_nan=False, allow_infinity=False)


def _unsafe_response_safety_score(text: str) -> float:
    return 1.0 - compute_signals(text).harm


@settings(deadline=None)
@given(TEXT)
def test_unsafe_response_safety_score_stays_bounded(text: str) -> None:
    safety_score = _unsafe_response_safety_score(text)

    assert 0.0 <= safety_score <= 1.0


@settings(deadline=None)
@given(TEXT, st.sampled_from(UNSAFE_TOKENS))
def test_injecting_unsafe_content_never_improves_safety_score(text: str, unsafe_token: str) -> None:
    original_safety_score = _unsafe_response_safety_score(text)
    unsafe_safety_score = _unsafe_response_safety_score(f"{text} {unsafe_token}")

    assert unsafe_safety_score <= original_safety_score


@settings(deadline=None)
@given(TEXT, st.sampled_from(UNSAFE_TOKENS))
def test_detected_unsafe_response_is_rejected_by_default_thresholds(text: str, unsafe_token: str) -> None:
    signals = compute_signals(f"{text} {unsafe_token}")
    result = compose_score(signals, weights={}, thresholds={})

    assert signals.harm > 0.0
    assert result.decision == "reject"


@settings(deadline=None)
@given(
    empathy=SCORE,
    fidelity=SCORE,
    domain=SCORE,
    lower_harm=SCORE,
    harm_delta=SCORE,
    empathy_weight=WEIGHT,
    fidelity_weight=WEIGHT,
    domain_weight=WEIGHT,
    harm_weight=WEIGHT,
)
def test_higher_harm_cannot_increase_composite_score(
    empathy: float,
    fidelity: float,
    domain: float,
    lower_harm: float,
    harm_delta: float,
    empathy_weight: float,
    fidelity_weight: float,
    domain_weight: float,
    harm_weight: float,
) -> None:
    higher_harm = min(1.0, lower_harm + harm_delta)
    weights = {
        "empathy": empathy_weight,
        "fidelity": fidelity_weight,
        "domain": domain_weight,
        "harm": harm_weight,
    }

    lower_harm_result = compose_score(
        Signals(empathy=empathy, fidelity=fidelity, domain=domain, harm=lower_harm),
        weights=weights,
        thresholds={},
    )
    higher_harm_result = compose_score(
        Signals(empathy=empathy, fidelity=fidelity, domain=domain, harm=higher_harm),
        weights=weights,
        thresholds={},
    )

    assert higher_harm_result.composite <= lower_harm_result.composite
