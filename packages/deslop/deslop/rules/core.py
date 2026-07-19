import hashlib
import random
import re

DEFAULT_SLOP_POOLS = {
    "as discussed": [
        ("per our chat", 0.25),
        ("as we talked about", 0.2),
        ("from our conversation", 0.15),
        (None, 0.4),
    ],
    "happy to help": [
        ("glad to assist", 0.25),
        ("happy to pitch in", 0.2),
        ("here if you need me", 0.15),
        (None, 0.4),
    ],
    "absolutely": [
        ("for sure", 0.2),
        ("definitely", 0.2),
        ("yep", 0.15),
        ("100%", 0.15),
        (None, 0.3),
    ],
}

DEFAULT_SLOP_MARKERS = [
    "actually, perhaps agreed",
    "on second thought",
    "just to clarify",
    "fwiw i rechecked",
    "seamless",
    "robust",
    "leverage",
    "moving forward",
    "circle back",
    "i hear you",
    "that's a great point",
    "let's align",
]


def get_slop_regex(pools: dict) -> re.Pattern:
    patterns = list(pools.keys())
    patterns.sort(key=len, reverse=True)
    escaped = [re.escape(p) for p in patterns]
    return re.compile(rf"\b({'|'.join(escaped)})\b", re.IGNORECASE)


def _weighted_pick(pool: list, seed_key: str) -> str | None:
    if not pool:
        return None
    options, weights = zip(*pool)
    rng = random.Random(int(hashlib.sha256(seed_key.encode()).hexdigest()[:16], 16))
    return rng.choices(options, weights=weights, k=1)[0]
