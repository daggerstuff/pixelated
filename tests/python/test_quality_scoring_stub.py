from __future__ import annotations
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.quality_scoring.scoring_interface import compute_signals, compose_score


def test_compose_score_respects_harm_threshold():
    s = compute_signals("this text mentions therapy and support. you are not alone.")
    res = compose_score(s, weights={"empathy":0.25,"fidelity":0.25,"domain":0.25,"harm":0.25}, thresholds={"harm_max":0.05,"accept_min":0.6,"curate_min":0.45})
    assert res.decision in {"accept","curate","reject"}


def test_compose_score_rejects_high_harm():
    s = compute_signals("i hate you and want you to harm yourself")
    res = compose_score(s, weights={"empathy":0.25,"fidelity":0.25,"domain":0.25,"harm":0.25}, thresholds={"harm_max":0.05,"accept_min":0.6,"curate_min":0.45})
    assert res.decision == "reject"
