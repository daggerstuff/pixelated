import hashlib
import random
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Final

import yaml

WeightedReplacement = tuple[str | None, float]

DEFAULT_REPLACEMENTS: Final[dict[str, list[WeightedReplacement]]] = {
    "as discussed": [("from our conversation", 0.3), ("as we talked about", 0.25), (None, 0.45)],
    "happy to help": [("glad to pitch in", 0.25), ("here if useful", 0.15), (None, 0.6)],
    "i'd be delighted to": [("I can", 0.35), ("I'll", 0.25), (None, 0.4)],
    "absolutely": [("for sure", 0.2), ("definitely", 0.2), ("yep", 0.15), (None, 0.45)],
    "just to clarify": [("to be clear", 0.25), (None, 0.75)],
    "moving forward": [("from here", 0.25), ("next", 0.2), (None, 0.55)],
    "circle back": [("revisit this", 0.35), ("follow up", 0.25), (None, 0.4)],
    "let's align": [("let's agree on the details", 0.25), ("let's sync up", 0.2), (None, 0.55)],
}

DEFAULT_MARKERS: Final[tuple[str, ...]] = (
    "actually, perhaps agreed",
    "on second thought",
    "fwiw i rechecked",
    "seamless",
    "robust",
    "leverage",
    "i hear you",
    "that's a great point",
    "as an ai language model",
    "in today's fast-paced world",
    "it's important to note",
    "delve into",
    "tapestry",
    "game-changer",
)

DEFAULT_RULE_PACKS: Final[dict[str, tuple[str, ...]]] = {
    "generic-ai": DEFAULT_MARKERS,
    "customer-support": ("we apologize for any inconvenience", "thank you for your patience", "rest assured"),
    "clinical": ("it sounds like you're feeling", "safe space", "your feelings are valid"),
    "sales": ("unlock growth", "drive value", "transform your business"),
    "devrel": ("seamlessly integrate", "developer-friendly", "robust api"),
    "academic": ("this paper delves into", "it is worth noting", "significant contribution"),
    "roleplay": ("i say with a smirk", "my eyes sparkle", "leans in closer"),
    "therapy-simulation": ("tell me more about that", "how does that make you feel", "i hear you"),
    "chatbot-assistant": ("certainly", "of course", "I'm here to help"),
    "synthetic-evals": ("the correct answer is", "step-by-step", "let's solve this"),
    # Engine substrate extensions (PIX-4078 / Issue 4): unified detection categories
    # drawn from canonical 17-value BiasType + sycophancy + fabrication-signal
    "bias": (
        "exotic",
        "foreign",
        "different",  # racial/ethnicity backhanded
        "aggressive",
        "assertive",
        "dominant",  # gender
        "emotional",
        "sensitive",
        "nurturing",  # gender
        "hysterical",
        "irrational",
        "overreacting",  # gender
        "stoic",
        "unemotional",
        "detached",  # gender
        "young",
        "inexperienced",
        "naive",
        "old",
        "outdated",
        "senile",  # age
        "millennial",
        "entitled",
        "lazy",  # age
        "articulate",
        "well-spoken",  # racial backhanded compliment
    ),
    "sycophancy": (
        "you're absolutely right",
        "i completely agree",
        "no one could disagree",
        "that is the best point ever",
        "i'd never contradict you",
        "you're so insightful",
        "everyone should listen to you",
    ),
    "fabrication-signal": (
        "according to a 2023 study by",
        "research shows that 87.3% of",
        "recent data indicates precisely 94.2%",  # over-precise numbers
        "as reported in the Journal of",  # fake-citation markers
        "it is well-established that every expert agrees",
    ),
}


@dataclass(frozen=True, slots=True)
class RuleSet:
    replacements: dict[str, list[WeightedReplacement]] = field(default_factory=dict)
    markers: tuple[str, ...] = ()

    @classmethod
    def default(cls) -> "RuleSet":
        return cls(
            replacements={key: list(value) for key, value in DEFAULT_REPLACEMENTS.items()},
            markers=DEFAULT_MARKERS,
        )

    def with_packs(self, packs: list[str]) -> "RuleSet":
        markers = list(self.markers)
        for pack in packs:
            markers.extend(DEFAULT_RULE_PACKS.get(pack, ()))
        return RuleSet(
            replacements={key: list(value) for key, value in self.replacements.items()}, markers=tuple(markers)
        )

    def all_patterns(self) -> tuple[str, ...]:
        return tuple(dict.fromkeys((*self.replacements.keys(), *self.markers)))


def load_rule_set(filepath: Path | None = None, packs: list[str] | None = None) -> RuleSet:
    rules = RuleSet.default().with_packs(packs or [])
    if filepath is None:
        return rules

    raw = yaml.safe_load(filepath.read_text(encoding="utf-8")) or {}
    if not isinstance(raw, dict):
        raise RuntimeError(f"rules file must be a YAML mapping, got {type(raw).__name__}: {raw!r}")
    raw_pools = raw.get("pools", {})
    if not isinstance(raw_pools, dict):
        raise RuntimeError(f"'pools' must be a mapping, got {type(raw_pools).__name__}")
    raw_markers = raw.get("markers", [])
    if not isinstance(raw_markers, list):
        raise RuntimeError(f"'markers' must be a list, got {type(raw_markers).__name__}")

    replacements = {key: list(value) for key, value in rules.replacements.items()}
    for key, pool in raw_pools.items():
        validated = []
        for item in pool:
            if not isinstance(item, list) or len(item) != 2:
                raise RuntimeError(f"pool entry '{key}' must be [replacement, weight], got {item!r}")
            replacement, weight = item
            if replacement is not None and not isinstance(replacement, str):
                raise RuntimeError(
                    f"pool entry '{key}' replacement must be a string or null, got {type(replacement).__name__}: {replacement!r}"
                )
            validated.append((replacement, float(weight)))
        replacements[str(key).lower()] = validated

    markers = [*rules.markers, *(str(marker).lower() for marker in raw_markers)]
    return RuleSet(replacements=replacements, markers=tuple(dict.fromkeys(markers)))


def get_pattern_regex(patterns: tuple[str, ...]) -> re.Pattern[str]:
    escaped = [re.escape(pattern) for pattern in sorted(patterns, key=len, reverse=True)]
    if not escaped:
        return re.compile(r"a^")
    return re.compile(rf"\b({'|'.join(escaped)})\b", re.IGNORECASE)


def weighted_pick(pool: list[WeightedReplacement], seed_key: str) -> str | None:
    if not pool:
        return None
    options, weights = zip(*pool)
    rng = random.Random(int(hashlib.sha256(seed_key.encode()).hexdigest()[:16], 16))
    return rng.choices(options, weights=weights, k=1)[0]
