"""Temporal filter — sliding-window microexpression + deception detection."""

from __future__ import annotations

from .types import AUFrame, EmotionEvent


def detect_events(frames: list[AUFrame], window_ms: int = 500) -> list[EmotionEvent]:
    """Detect emotion events from AU frame sequence.

    Identifies forced smile (AU12 high + AU6 low) and hurt (AU4 + AU15)
    patterns within <500ms windows per spec §4.
    """
    events: list[EmotionEvent] = []
    if len(frames) < 2:
        return events

    for i in range(len(frames) - 1):
        start = frames[i].timestamp_ms
        end = frames[i + 1].timestamp_ms
        au = frames[i].au_scores

        # Only flag events within the microexpression window
        if end - start > window_ms:
            continue

        au12 = au.get(12, 0)
        au6 = au.get(6, 0)
        au4 = au.get(4, 0)
        au15 = au.get(15, 0)

        if au12 > 0.7 and au6 < 0.2:
            au_combo = "AU12+AU6-"
            score = au12
            deception = True
        elif au4 > 0.5 and au15 > 0.4:
            au_combo = "AU4+AU15"
            score = max(au4, au15)
            deception = False
        else:
            continue

        events.append(
            EmotionEvent(
                start_ms=start,
                end_ms=end,
                au_combo=au_combo,
                deception_flag=deception,
                score=min(score, 1.0),
            )
        )

    return events
