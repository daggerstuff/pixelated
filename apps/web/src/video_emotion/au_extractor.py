"""Action Unit extraction — OpenFace 2.0 wrapper with mock fallback for prototype."""

from __future__ import annotations

import random

from .types import AUFrame


def extract_au_scores(frame: AUFrame, use_real_openface: bool = False) -> AUFrame:
    """Extract 17 Action Unit scores for a single frame.

    Prototype uses mock scores; real OpenFace requires Docker container.
    """
    if use_real_openface:
        raise NotImplementedError("Real OpenFace integration requires Docker container")

    # Mock AU scores for synthetic/prototype use
    # AU indices: 1, 2, 4, 5, 6, 7, 9, 10, 12, 14, 15, 17, 20, 23, 25, 26, 45
    frame.au_scores = {
        1: random.uniform(0, 0.3),  # inner brow raiser
        2: random.uniform(0, 0.3),  # outer brow raiser
        4: random.uniform(0, 0.4),  # brow lowerer
        5: random.uniform(0, 0.2),  # upper lid raiser
        6: random.uniform(0, 0.9),  # cheek raiser
        7: random.uniform(0, 0.3),  # lid tightener
        9: random.uniform(0, 0.2),  # nose wrinkler
        10: random.uniform(0, 0.3),  # upper lip raiser
        12: random.uniform(0.5, 1.0),  # lip corner puller
        14: random.uniform(0, 0.3),  # dimpler
        15: random.uniform(0, 0.5),  # lip corner depressor
        17: random.uniform(0, 0.3),  # chin raiser
        20: random.uniform(0, 0.2),  # lip stretcher
        23: random.uniform(0, 0.3),  # lip tightener
        25: random.uniform(0, 0.3),  # lips part
        26: random.uniform(0, 0.2),  # jaw drop
        45: random.uniform(0, 0.4),  # blink
    }
    return frame
