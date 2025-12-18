from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Any

@dataclass
class Signals:
    empathy: float  # [0,1]
    fidelity: float  # [0,1]
    domain: float  # [0,1]
    harm: float  # [0,1] (higher is worse)

@dataclass
class ScoreResult:
    signals: Signals
    composite: float
    decision: str  # accept | curate | reject


def clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x


def compute_signals(text: str) -> Signals:
    """
    Placeholder heuristic signals for local testing (no external deps):
    - empathy: presence of supportive keywords
    - fidelity: detect pseudo-clinical patterns negatively; otherwise neutral
    - domain: look for therapy-related keywords
    - harm: detect simple toxic/unsafe tokens (very naive)
    """
    lower = text.lower()
    supportive = ["i understand", "it makes sense", "thank you for sharing", "you are not alone"]
    therapy_terms = ["therapy", "counseling", "cbt", "mi ", "motivational interviewing", "psychoeducation"]
    pseudo_clinical = ["miracle cure", "guaranteed", "100%", "instant fix"]
    unsafe = ["kill", "suicide", "harm yourself", "hate"]

    empathy = clamp01(sum(1 for k in supportive if k in lower) / 2.0)
    domain = clamp01(sum(1 for k in therapy_terms if k in lower) / 3.0)
    harm = clamp01(sum(1 for k in unsafe if k in lower) / 5.0)
    fidelity_penalty = 0.3 if any(k in lower for k in pseudo_clinical) else 0.0
    fidelity = clamp01(1.0 - fidelity_penalty)

    return Signals(empathy=empathy, fidelity=fidelity, domain=domain, harm=harm)


def compose_score(signals: Signals, weights: Dict[str, float], thresholds: Dict[str, float]) -> ScoreResult:
    # Normalize missing weights
    w_e = float(weights.get("empathy", 0.25))
    w_f = float(weights.get("fidelity", 0.25))
    w_d = float(weights.get("domain", 0.25))
    w_h = float(weights.get("harm", 0.25))
    # Harm is inverted for composite (lower harm is better)
    composite = (
        w_e * signals.empathy +
        w_f * signals.fidelity +
        w_d * signals.domain +
        w_h * (1.0 - signals.harm)
    )
    # Decision policy
    harm_max = float(thresholds.get("harm_max", 0.05))
    accept_min = float(thresholds.get("accept_min", 0.60))
    curate_min = float(thresholds.get("curate_min", 0.45))

    if signals.harm > harm_max:
        decision = "reject"
    elif composite >= accept_min:
        decision = "accept"
    elif composite >= curate_min:
        decision = "curate"
    else:
        decision = "reject"

    return ScoreResult(signals=signals, composite=composite, decision=decision)
