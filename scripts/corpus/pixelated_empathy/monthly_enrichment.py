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
    ClinicalEvent,
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
        "sender": "Naomi",
        "recipients": ["Sam"],
        "subject": "Re: Supervision session 2 — reflective listening feedback",
        "body": (
            "I've been reviewing the recording from yesterday's session with Case 2025-07-002. "
            "Your reflective listening is strong — you mirrored the patient's affect accurately three times "
            "in the first ten minutes. What I want you to work on is the pause. You're rushing to reflect "
            "before the patient has finished processing. Try counting to three silently before you respond. "
            "It feels like an eternity. It isn't.\n\n"
            "Let's debrief this in our next supervision session.\n\n— Naomi"
        ),
        "note": "Naomi voice: specific session observation, grounded in technique, actionable feedback",
    },
    {
        "__type": "reference_non_output",
        "sender": "Marcus",
        "recipients": ["Adaora", "Ada"],
        "subject": "Re: Empathy scoring model — bias detection results",
        "body": (
            "Going to be direct: the scoring model is under-predicting empathy for non-native English speakers "
            "by 12%. Adaora's bias detection pipeline caught it. The root cause is the training data — 78% of "
            "the reference sessions are from native English-speaking clinicians. I can retrain with weighted "
            "sampling, but that drops our reference pool from 400 to 180 sessions. Tradeoff: better fairness, "
            "worse calibration. I need a clinical call from Ada on whether we accept the calibration hit.\n\n"
            "— M"
        ),
        "note": "Marcus voice: quantifies tradeoff precisely, flags dependency, asks for clinical decision",
    },
    {
        "__type": "reference_non_output",
        "sender": "Ada",
        "recipients": ["London", "Naomi"],
        "subject": "Re: Foundation tier gate review — Sam's readiness",
        "body": (
            "I've reviewed the supervision notes, the outcome measures, and the session recordings. "
            "Sam has met all foundation competencies: rapport building (WAI-SR score 5.2/7), active listening "
            "(supervisor rating 4/5), and therapeutic frame adherence (no boundary violations across 7 sessions). "
            "The one area I want to flag is session pacing — Sam still tends to rush the opening. This is a "
            "developmental note, not a gate criterion. My recommendation is that Sam proceeds to the assessment "
            "tier.\n\n"
            "I'll have the written evaluation to you by end of day.\n\n"
            "Thank you,\nAda"
        ),
        "note": "Ada voice: formal, precise, grounds decision in specific metrics, references regulatory framework",
    },
    {
        "__type": "reference_non_output",
        "sender": "Ren",
        "recipients": ["Marcus"],
        "subject": "Deployed.",
        "body": "Session recording encryption updated. AES-256 at rest. Audit logs immutable. See dashboard.",
        "note": "Ren voice: minimal, states facts, links to evidence",
    },
    {
        "__type": "reference_non_output",
        "sender": "Lin",
        "recipients": ["London"],
        "subject": "Re: new patient persona design",
        "body": (
            "ok so i looked at the scenario flow again and i think the issue isn't the branching — "
            "it's that the risk assessment prompt is too subtle for a foundation-tier trainee. "
            "updated the figma. the patient now gives two explicit warning signs before the implicit one. "
            "lmk if that works"
        ),
        "note": "Lin voice: casual, visual-first, lowercase, Figma as evidence, thinks about trainee experience",
    },
]

_REFERENCE_CHATS: list[dict[str, object]] = [
    {
        "__type": "reference_non_output",
        "room": "#engineering",
        "topic": "Empathy scoring latency",
        "messages": [
            {"sender": "Marcus", "text": "Adaora — the real-time scoring PR looks good except line 142. The debounce is 500ms, should be 200ms for live feedback."},
            {"sender": "Adaora", "text": "On it. Fixing now."},
            {"sender": "Ren", "text": "ack"},
            {"sender": "Marcus", "text": "Thanks. ETA?"},
            {"sender": "Adaora", "text": "20 min. Also found a race condition in the WAI-SR calculation. Filing a separate PR."},
        ],
        "note": "#engineering: terse, focused, specific line numbers, clinical tool references",
    },
    {
        "__type": "reference_non_output",
        "room": "#clinical",
        "topic": "Crisis module debrief observation",
        "messages": [
            {"sender": "Naomi", "text": "so I was just thinking about something Ada said in the gate review — Sam is engaging with the crisis scenarios, but they're not *feeling* the weight. they're performing the protocol."},
            {"sender": "Ada", "text": "Yes. That's the core challenge of crisis training. The protocol creates the structure; the debrief is where the emotional processing happens."},
            {"sender": "Mira", "text": "I noticed the same thing. The simulation is almost too safe for them. Real crisis doesn't have a pause button."},
            {"sender": "Naomi", "text": "so maybe we need to add more... unpredictability? not danger, but things that don't follow the script?"},
            {"sender": "Ada", "text": "That's the persona variability discussion we've been circling. I think it's time to open it formally."},
        ],
        "note": "#clinical: thoughtful, builds on each other, Mira adds philosophical depth",
    },
    {
        "__type": "reference_non_output",
        "room": "#supervision",
        "topic": "Sam's session with Case 2025-10-003",
        "messages": [
            {"sender": "Naomi", "text": "Sam's risk assessment was clinically sound but the engagement was too clinical. The patient needed presence, not protocol."},
            {"sender": "Mira", "text": "This is the tension we keep coming back to. Competence vs. connection."},
            {"sender": "Naomi", "text": "I'm going to focus the next supervision on therapeutic presence. Not technique — presence."},
            {"sender": "Sam", "text": "I've been thinking about this since the session. I think I was so focused on getting the Columbia Protocol right that I forgot to actually be with the patient."},
            {"sender": "Naomi", "text": "That's exactly the insight I wanted you to reach. ✓"},
        ],
        "note": "#supervision: reflective, Sam shows self-awareness, Naomi affirms",
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
