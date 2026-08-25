"""Monthly enrichment — build command.

Assembles the context packet for the LLM generator:
  - Persona voice rules
  - Event details for the month
  - Topic names
  - Reference examples (marked as non-output)
  - Thread continuity hooks from prior month
→ month_enrichment.json
"""

from __future__ import annotations

import json
from pathlib import Path

from pixelated_empathy.company_events import get_event_spine
from pixelated_empathy.monthly_gate import get_accepted_months
from pixelated_empathy.personas import PERSONAS, persona_voice_summary
from pixelated_empathy.schemas import (
    CompanyEvent,
    MonthBible,
    MonthEnrichment,
    PersonaVoiceContext,
    MONTH_ORDER,
)

# ---------------------------------------------------------------------------
# Reference examples (static — marked non-output; they seed style, not content)
# ---------------------------------------------------------------------------

_REFERENCE_EMAILS: list[dict[str, object]] = [
    {
        "__type": "reference_non_output",
        "sender": "Chad",
        "recipients": ["Marcus"],
        "subject": "Re: WebSocket timeline",
        "body": (
            "Need this by Thursday or the Westbrook demo falls apart. "
            "What's blocking you specifically — I can clear the way."
        ),
        "note": "Chad voice: direct ask, clears blockers, no preamble",
    },
    {
        "__type": "reference_non_output",
        "sender": "Marcus",
        "recipients": ["Chad", "Adaora"],
        "subject": "Re: LLM cold start — root cause",
        "body": (
            "Going to be direct: the warm-pool approach Adaora suggested is the right call. "
            "It adds $60/month to infra but drops cold-start from 4.2s to under 800ms. "
            "Happy to pair on the implementation if the timeline is tight."
        ),
        "note": "Marcus voice: acknowledges colleague's idea, quantifies tradeoff precisely",
    },
    {
        "__type": "reference_non_output",
        "sender": "Ada",
        "recipients": ["London", "Chad"],
        "subject": "Re: Westbrook pilot proposal — HIPAA section",
        "body": (
            "I've reviewed the proposal carefully. The HIPAA section needs three changes before "
            "I can sign off: the BAA language should reference 45 CFR Part 164 specifically, "
            "the data retention schedule is missing a destruction clause, and the breach notification "
            "timeline is stated as 90 days — federal requirement is 60. I've marked these in the "
            "shared doc. I can turn around a revised draft within 24 hours once you let me know "
            "which sections I own.\n\nThank you for looping me in.\n\nAda"
        ),
        "note": "Ada voice: formal, precise, flags specific issues with regulatory citations",
    },
    {
        "__type": "reference_non_output",
        "sender": "Ren",
        "recipients": ["Marcus"],
        "subject": "Deployed.",
        "body": "Warm pool live. p99 at 780ms. See dashboard.",
        "note": "Ren voice: minimal, states facts, links to evidence",
    },
    {
        "__type": "reference_non_output",
        "sender": "Lin",
        "recipients": ["London"],
        "subject": "Re: dashboard feedback",
        "body": (
            "ok so i looked at the flow again and i think the issue isn't the layout — "
            "it's that the confidence meter label is too small at mobile. updated the figma. "
            "lmk if that works"
        ),
        "note": "Lin voice: casual, visual-first, lowercase, Figma as evidence",
    },
]

_REFERENCE_CHATS: list[dict[str, object]] = [
    {
        "__type": "reference_non_output",
        "room": "#engineering",
        "topic": "WebSocket latency",
        "messages": [
            {"sender": "Marcus", "text": "Adaora — the reconnect handling PR looks good except line 142. The backoff is linear, should be exponential."},
            {"sender": "Adaora", "text": "On it. Fixing now."},
            {"sender": "Ren", "text": "👍"},
            {"sender": "Marcus", "text": "Thanks. ETA?"},
            {"sender": "Adaora", "text": "20 min."},
        ],
        "note": "Engineering channel: terse, focused, specific line numbers",
    },
    {
        "__type": "reference_non_output",
        "room": "#general",
        "topic": "Hargrove signing celebration",
        "messages": [
            {"sender": "Chad", "text": "It's signed. $48k. Ren can you provision the tenant now?"},
            {"sender": "Ren", "text": "On it."},
            {"sender": "London", "text": "WE DID IT!!! 🎉🎉🎉"},
            {"sender": "Lin", "text": "ok i'm crying a little"},
            {"sender": "Naomi", "text": "This is what we've been working toward. Congratulations, everyone."},
            {"sender": "Marcus", "text": "Nice. Now let's not mess up the onboarding."},
            {"sender": "Adaora", "text": "Marcus 😂"},
            {"sender": "Ren", "text": "Provisioned. Hargrove tenant is live."},
        ],
        "note": "#general: mixed registers, celebration with Marcus tempering it",
    },
    {
        "__type": "reference_non_output",
        "room": "#clinical",
        "topic": "Session debrief observation",
        "messages": [
            {"sender": "Naomi", "text": "so I was just thinking about something Ada said in session 1 — the residents are engaging with the patient, but they're not *listening*. they're preparing their next response."},
            {"sender": "Ada", "text": "Yes. That's the core training challenge. The AI patient creates the opportunity; the debrief is where the actual learning happens."},
            {"sender": "Mira", "text": "I noticed the same thing. The simulation is almost too comfortable for them. Real patients resist."},
            {"sender": "Naomi", "text": "so maybe we need to add more... friction? controlled unpredictability?"},
            {"sender": "Ada", "text": "That's the persona variability discussion we've been circling. I think it's time to open it formally."},
        ],
        "note": "#clinical: thoughtful, builds on each other, Mira adds philosophical depth",
    },
]


def _load_prior_month_summary(month: str, work_dir_root: Path) -> str | None:
    idx = MONTH_ORDER.index(month)
    if idx == 0:
        return None
    prior = MONTH_ORDER[idx - 1]
    summary_path = work_dir_root / prior / "month_summary.txt"
    if summary_path.exists():
        return summary_path.read_text().strip()
    # Fall back to last few email subjects as a summary
    emails_path = work_dir_root / prior / "generated_emails.json"
    if emails_path.exists():
        try:
            emails: list[dict[str, object]] = json.loads(emails_path.read_text())
            last_subjects = [str(e.get("subject", "")) for e in emails[-10:]]
            return f"Prior month ({prior}) ended with threads on: " + "; ".join(last_subjects)
        except Exception:
            pass
    return None


def _thread_continuity_hooks(month: str, work_dir_root: Path) -> list[dict[str, object]]:
    """Find open threads from prior month that should continue."""
    idx = MONTH_ORDER.index(month)
    if idx == 0:
        return []
    prior = MONTH_ORDER[idx - 1]
    emails_path = work_dir_root / prior / "generated_emails.json"
    if not emails_path.exists():
        return []
    try:
        emails: list[dict[str, object]] = json.loads(emails_path.read_text())
        # Threads with the most messages are likely "open"
        thread_counts: dict[str, int] = {}
        thread_subjects: dict[str, str] = {}
        for email in emails:
            tid = str(email.get("thread_id", ""))
            thread_counts[tid] = thread_counts.get(tid, 0) + 1
            thread_subjects[tid] = str(email.get("subject", ""))
        # Top 5 most active threads = likely continuation candidates
        top = sorted(thread_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        return [
            {"thread_id": tid, "subject": thread_subjects[tid], "message_count": count}
            for tid, count in top
        ]
    except Exception:
        return []


def build(month: str, work_dir_root: Path) -> MonthEnrichment:
    """Build the month enrichment context packet."""
    if month not in MONTH_ORDER:
        raise ValueError(f"Unknown month: {month!r}")

    month_dir = work_dir_root / month
    bible_path = month_dir / "month_bible.json"
    if not bible_path.exists():
        raise FileNotFoundError(
            f"Month bible missing for {month}. Run 'corpus plan {month}' first."
        )

    bible = MonthBible.model_validate_json(bible_path.read_text())
    spine = get_event_spine()
    year, mon = (int(x) for x in month.split("-"))

    # Collect all topics from this month's events
    topic_set: set[str] = set()
    for event in bible.events:
        for topic in event.topics:
            topic_set.add(topic)
    topic_names = sorted(topic_set)

    # Build persona contexts
    persona_contexts: list[PersonaVoiceContext] = []
    for name in bible.active_personas:
        p = PERSONAS[name]
        persona_contexts.append(
            PersonaVoiceContext(
                name=p.name,
                role=p.role,
                style=p.style,
                hard_constraints=list(p.hard_constraints),
                opener_pool=list(p.opener_pool),
                closer_pool=list(p.closer_pool),
            )
        )

    prior_summary = _load_prior_month_summary(month, work_dir_root)
    continuity_hooks = _thread_continuity_hooks(month, work_dir_root)

    enrichment = MonthEnrichment(
        month=month,
        tier=bible.tier,
        persona_contexts=persona_contexts,
        events=bible.events,
        topic_names=topic_names,
        reference_examples=_REFERENCE_EMAILS + _REFERENCE_CHATS,
        thread_continuity_hooks=continuity_hooks,
        prior_month_summary=prior_summary,
    )

    month_dir.mkdir(parents=True, exist_ok=True)
    (month_dir / "month_enrichment.json").write_text(enrichment.model_dump_json(indent=2))
    return enrichment
