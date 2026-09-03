"""Stage 1 delta debugging (DDMIN) over semantic description clauses."""

from __future__ import annotations

from collections.abc import Callable


def ddmin(
    units: list[str],
    oracle: Callable[[list[str]], bool],
) -> list[str]:
    """Find a 1-minimal clause subset U* subset of U via delta debugging.

    Stage 1 Phase 1: partition-and-test over semantic clauses using oracle O(d,Q,C).
    Requires O(n log n) oracle calls vs O(2^n) exhaustive search.
    """
    if not units:
        return []
    if len(units) == 1:
        return units if oracle(units) else []

    current = list(units)
    if not oracle(current):
        return units

    changed = True
    while changed and len(current) > 1:
        changed = False
        n = len(current)
        mid = n // 2
        halves = [current[:mid], current[mid:]]
        for half in halves:
            if half and oracle(half):
                current = half
                changed = True
                break
        if changed:
            continue
        for i in range(len(current)):
            candidate = current[:i] + current[i + 1 :]
            if candidate and oracle(candidate):
                current = candidate
                changed = True
                break
    return current
