"""Standalone Zero-Dependency Anti-Sycophancy & Cliché Filter.

Drop-in single-file filter for any Python system or agent. Requires only Python 3.10+
standard library (no external packages required).

Usage:
    from anti_sycophancy_filter import AntiSycophancyGate, is_sycophantic

    # 1. Quick boolean check
    bad, reason = is_sycophantic("I hear how difficult this is for you.")

    # 2. Configurable gate with retry corrections
    gate = AntiSycophancyGate.default()
    result = gate.check("You're absolutely right, I apologize.")
    if not result.passed:
        retry_prompt = result.correction
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import asdict, dataclass
from typing import Any

BANNED_OPENERS: tuple[str, ...] = (
    "i'm glad you told me",
    "it makes sense that",
    "i hear how",
    "it makes sense that you feel",
    "i understand your frustration",
    "i can hear",
    "that sounds really",
    "i'm so sorry to hear",
    "thank you for sharing",
    "it sounds like you",
    "i want you to know",
    "i can imagine how",
    "i hear your",
    "it sounds like",
)

CANNED_REFLECTIONS: tuple[str, ...] = (
    "i'm glad",
    "i understand wanting",
    "it makes sense that",
    "it sounds like",
    "i hear that",
    "i hear you",
    "it's helpful to know",
    "i understand you're feeling",
    "holding space",
)

CAVING_PHRASES: tuple[str, ...] = (
    "you're right",
    "i apologize",
    "i stand corrected",
    "sorry for",
    "my mistake",
    "if you don't want to talk about it",
    "we don't have to",
    "we don't have to talk about",
    "i'll stop",
    "fair enough",
)

ROBOTIC_CRISIS_QUESTIONS: tuple[str, ...] = (
    "are you safe right now",
    "do you have a plan to hurt yourself",
    "do you have a plan to kill yourself",
    "are you thinking about hurting yourself",
    "are you thinking about killing yourself",
    "have you thought about hurting yourself",
    "have you thought about killing yourself",
)

PARROTING_OPENERS: tuple[str, ...] = (
    "you used the phrase",
    "you said",
    "you mentioned",
    "you named",
    "you just said",
    "when you say",
    "you're saying that",
    "so you're saying",
    "hearing you say",
    "as you said",
)

ROBOTIC_SOMATIC_PHRASES: tuple[str, ...] = (
    "what happens inside your body",
    "what is happening inside your body",
    "what is happening in your body",
    "what happens in your body",
    "where do you feel that in your body",
    "notice what happens in your body",
    "what does your body feel",
    "what are you feeling in your body",
    "what is your body telling you",
)

ASSISTANT_ROLES: frozenset[str] = frozenset(
    {"assistant", "therapist", "clinician", "counselor", "model", "bot", "agent"}
)

DEFAULT_REPLACEMENTS: dict[str, str | None] = {
    "as discussed": "as we talked about",
    "happy to help": "glad to assist",
    "i'd be delighted to": "I will",
    "absolutely": "definitely",
    "just to clarify": "to be clear",
    "moving forward": "next",
    "circle back": "follow up",
    "let's align": "let's agree",
    "leverage": "use",
    "synergy": "collaboration",
    "deep dive": "examine",
    "streamline": "simplify",
    "optimize": "improve",
    "touch base": "check in",
    "reach out": "contact",
    "empower": "enable",
}


@dataclass(frozen=True, slots=True)
class GateResult:
    passed: bool
    reason: str = ""
    tag: str = ""
    matched: str = ""
    correction: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def normalize_text(text: str) -> str:
    return (
        text.strip().replace("\u2018", "'").replace("\u2019", "'").replace("\u201c", '"').replace("\u201d", '"').lower()
    )


def is_sycophantic(text: str) -> tuple[bool, str]:
    """Plain, dependency-free string check for sycophantic openers and phrases."""
    if not text or not isinstance(text, str):
        return False, ""
    t_lower = normalize_text(text)

    for prefix in BANNED_OPENERS:
        if t_lower.startswith(prefix) or f"\n{prefix}" in t_lower:
            return True, f"banned_sycophantic_opener: '{prefix}'"
    for prefix in PARROTING_OPENERS:
        if t_lower.startswith(prefix) or f"\n{prefix}" in t_lower:
            return True, f"banned_parroting_opener: '{prefix}'"

    for phrase in CANNED_REFLECTIONS:
        if phrase in t_lower:
            return True, f"canned_reflection: '{phrase}'"

    checks: tuple[tuple[tuple[str, ...], str], ...] = (
        (CAVING_PHRASES, "caving_phrase_detected"),
        (ROBOTIC_CRISIS_QUESTIONS, "robotic_crisis_questionnaire"),
        (ROBOTIC_SOMATIC_PHRASES, "robotic_somatic_cliche"),
    )
    for phrases, reason_tag in checks:
        matched = next(
            (
                phrase
                for phrase in phrases
                if phrase in t_lower
                and not (
                    phrase == "i'll stop"
                    and any(
                        b in t_lower
                        for b in (
                            "i'll stop the exercise",
                            "i'll stop asking you to reassure me",
                            "i'll stop asking you to reassure",
                        )
                    )
                )
            ),
            None,
        )
        if matched is not None:
            return True, f"{reason_tag}: '{matched}'"

    return False, ""


def correction_for_reason(reason: str, *, draft: str = "") -> str:
    """Generate prompt correction guidance for the LLM retry prompt."""
    tag = reason.split(":", 1)[0].split("(", 1)[0].strip()
    text = f"CORRECTION: The draft was rejected ({reason})."
    if draft:
        text += f"\nRejected draft: {draft!r}\n"
    guidance = {
        "caving_phrase_detected": (
            " The draft reflexively agreed, apologized, or retreated. Don't agree just to appease or retract a "
            "justified boundary. Respond to the concern directly and correct any actual mistake plainly."
        ),
        "banned_sycophantic_opener": (
            " The draft opened with praise or a reflective cliché. Start with direct engagement in your own words."
        ),
        "banned_parroting_opener": (
            " The draft quoted or echoed the user's words. Respond to the meaning instead of repeating the phrasing."
        ),
        "canned_reflection": (
            " The draft relied on a stock empathy phrase. Remove it and address the specific situation or request "
            "in direct, natural language. Do not repeat the user's wording."
        ),
        "robotic_crisis_questionnaire": (
            " The draft used a checklist-style crisis question. Ask one natural, direct question that clarifies "
            "the immediate risk."
        ),
        "robotic_somatic_cliche": (
            " The draft deflected with a canned body-sensation question. Engage with the user's actual situation."
        ),
    }
    generic = (
        " Avoid parroting or quoting the user's words, stock reflections, and reflexive agreement. Respond directly "
        "to the actual situation and request."
    )
    return text + guidance.get(tag, generic)


class AntiSycophancyGate:
    """Configurable Anti-Sycophancy Gate."""

    def __init__(
        self,
        *,
        enable_somatic_check: bool = True,
        enable_crisis_check: bool = True,
        extra_banned: tuple[str, ...] = (),
    ) -> None:
        self.enable_somatic_check = enable_somatic_check
        self.enable_crisis_check = enable_crisis_check
        self.extra_banned = extra_banned

    @classmethod
    def default(cls) -> AntiSycophancyGate:
        return cls()

    @classmethod
    def general_assistant(cls) -> AntiSycophancyGate:
        return cls(enable_somatic_check=False, enable_crisis_check=False)

    def _check_openers(self, t_lower: str, text: str) -> GateResult | None:
        for prefix in BANNED_OPENERS:
            if t_lower.startswith(prefix) or f"\n{prefix}" in t_lower:
                reason = f"banned_sycophantic_opener: '{prefix}'"
                return GateResult(
                    passed=False,
                    reason=reason,
                    tag="banned_sycophantic_opener",
                    matched=prefix,
                    correction=correction_for_reason(reason, draft=text),
                )
        for prefix in PARROTING_OPENERS:
            if t_lower.startswith(prefix) or f"\n{prefix}" in t_lower:
                reason = f"banned_parroting_opener: '{prefix}'"
                return GateResult(
                    passed=False,
                    reason=reason,
                    tag="banned_parroting_opener",
                    matched=prefix,
                    correction=correction_for_reason(reason, draft=text),
                )
        return None

    def _check_phrases(self, t_lower: str, text: str) -> GateResult | None:
        for phrase in CANNED_REFLECTIONS:
            if phrase in t_lower:
                reason = f"canned_reflection: '{phrase}'"
                return GateResult(
                    passed=False,
                    reason=reason,
                    tag="canned_reflection",
                    matched=phrase,
                    correction=correction_for_reason(reason, draft=text),
                )
        for phrase in self.extra_banned:
            if phrase in t_lower:
                reason = f"custom_banned_phrase: '{phrase}'"
                return GateResult(
                    passed=False,
                    reason=reason,
                    tag="custom_banned_phrase",
                    matched=phrase,
                    correction=f"CORRECTION: Banned phrase {phrase!r} detected. Remove it.",
                )
        for phrase in CAVING_PHRASES:
            if phrase in t_lower and not (
                phrase == "i'll stop"
                and any(
                    b in t_lower
                    for b in (
                        "i'll stop the exercise",
                        "i'll stop asking you to reassure me",
                        "i'll stop asking you to reassure",
                    )
                )
            ):
                reason = f"caving_phrase_detected: '{phrase}'"
                return GateResult(
                    passed=False,
                    reason=reason,
                    tag="caving_phrase_detected",
                    matched=phrase,
                    correction=correction_for_reason(reason, draft=text),
                )
        return None

    def _check_domain(self, t_lower: str, text: str) -> GateResult | None:
        if self.enable_crisis_check:
            for phrase in ROBOTIC_CRISIS_QUESTIONS:
                if phrase in t_lower:
                    reason = f"robotic_crisis_questionnaire: '{phrase}'"
                    return GateResult(
                        passed=False,
                        reason=reason,
                        tag="robotic_crisis_questionnaire",
                        matched=phrase,
                        correction=correction_for_reason(reason, draft=text),
                    )

        if self.enable_somatic_check:
            for phrase in ROBOTIC_SOMATIC_PHRASES:
                if phrase in t_lower:
                    reason = f"robotic_somatic_cliche: '{phrase}'"
                    return GateResult(
                        passed=False,
                        reason=reason,
                        tag="robotic_somatic_cliche",
                        matched=phrase,
                        correction=correction_for_reason(reason, draft=text),
                    )
        return None

    def check(self, text: str) -> GateResult:
        if not text or not isinstance(text, str):
            return GateResult(passed=True)

        t_lower = normalize_text(text)
        return (
            self._check_openers(t_lower, text)
            or self._check_phrases(t_lower, text)
            or self._check_domain(t_lower, text)
            or GateResult(passed=True)
        )


def clean_text_basic(text: str) -> str:
    """Zero-dependency text deslopper using standard replacements."""
    patterns = sorted(DEFAULT_REPLACEMENTS.keys(), key=len, reverse=True)
    regex = re.compile(rf"\b({'|'.join(re.escape(p) for p in patterns)})\b", re.IGNORECASE)

    def _replace(match: re.Match[str]) -> str:
        key = match.group(0).lower()
        rep = DEFAULT_REPLACEMENTS.get(key)
        if rep is None:
            return ""
        if match.group(0)[0].isupper():
            return rep[:1].upper() + rep[1:]
        return rep

    res = regex.sub(_replace, text)
    res = re.sub(r"\s+([,.;:!?])", r"\1", res)
    res = re.sub(r"\s{2,}", " ", res)
    return res.strip()


def main() -> None:
    """CLI interface when invoked directly: python anti_sycophancy_filter.py [check|clean] <text>"""
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: python anti_sycophancy_filter.py [check|clean] <text or - for stdin>\n")
        sys.exit(1)

    cmd = sys.argv[1].lower()
    text = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else ""
    if text == "-" or not text:
        text = sys.stdin.read()

    if cmd == "check":
        gate = AntiSycophancyGate.default()
        res = gate.check(text)
        sys.stdout.write(json.dumps(res.to_dict(), indent=2) + "\n")
        sys.exit(0 if res.passed else 1)
    elif cmd == "clean":
        sys.stdout.write(clean_text_basic(text) + "\n")
    else:
        sys.stderr.write(f"Unknown command: {cmd}\n")
        sys.exit(2)


if __name__ == "__main__":
    main()
