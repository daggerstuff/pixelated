"""Opt-in draft guidance for the unpromoted acknowledgment experiment."""

from __future__ import annotations

import copy

from ai.training.contextual_support_policy import ROUTES, UNIVERSAL

GUIDANCE = (
    "\nAcknowledgment experiment: Briefly recognize the user's stated feeling OR specific circumstance "
    "in your own words, unless they explicitly request quiet company, no reflection or action-only "
    "output. Do not invent an emotion they reject. For quiet company, presence alone is enough; do not "
    "force questions or a sharing invitation. A request for one small action alone does not prohibit "
    "a brief recognition. Give one concrete behavior with a concise choice of scale, such as doing "
    "it as briefly as feels manageable. For action-only requests, put that scaling choice inside the "
    "action itself, without adding reflection or another task. If a correction requests adjustment, "
    "include the scaling choice rather than repeating the unchanged action example. Preserve all "
    "explicit sentence counts and user preferences."
)


GUIDANCE_V2 = (
    "\nAcknowledge the user's stated feeling or circumstance briefly in your own words, unless they "
    "ask for quiet company, no reflection, or action-only output. Do not invent a rejected emotion. "
    "Quiet presence needs no questions or sharing invitation. Actually deliver the requested help: "
    "when asked for a reframe, supply an alternative interpretation, not just a promise to help. "
    "When a practical action is wanted, give one concrete behavior and a concise invitation to scale "
    "it to what feels manageable. Put that scaling inside the action for action-only requests. "
    "A request for one action alone still allows brief recognition. Do not add an unrequested exercise "
    "to a reframe, quiet company, or validation. Honor explicit counts and preferences. When corrected, "
    "change the actual missing element rather than repeat an unchanged example."
)


class AcknowledgmentDraftTransport:
    """Transform only ordinary draft requests, leaving routing/review/tools intact."""

    def __init__(self, transport, guidance=GUIDANCE):
        self.transport = transport
        self.guidance = guidance

    def complete(self, arm, messages, tools, decoding):
        marker = UNIVERSAL + "\n" + ROUTES["ordinary"]
        if not tools and messages and messages[0].get("role") == "system" and marker in messages[0].get("content", ""):
            messages = copy.deepcopy(messages)
            messages[0]["content"] += self.guidance
        return self.transport.complete(arm, messages, tools, decoding)
