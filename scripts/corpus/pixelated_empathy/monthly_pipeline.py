"""Monthly pipeline — plan command.

Consumes the event spine + prior accepted month summary → emits:
  - manifest.json
  - YYYY-MM/month_bible.json
  - YYYY-MM/salvage_candidates.json
"""

from __future__ import annotations

import json
from pathlib import Path

from pixelated_empathy.company_events import get_event_spine
from pixelated_empathy.personas import PERSONA_NAMES
from pixelated_empathy.schemas import (
    GateTier,
    Manifest,
    ManifestEntry,
    MonthBible,
    MONTH_ORDER,
    MONTH_TARGETS,
    SalvageCandidate,
)

# ---------------------------------------------------------------------------
# Month theme/arc descriptions
# ---------------------------------------------------------------------------

_MONTH_THEMES: dict[str, tuple[str, str]] = {
    "2025-07": (
        "Company inception",
        "The team is just learning to trust each other. Writing is tentative. Energy is high but context is low. Emails are short because nobody yet has the vocabulary to be long.",
    ),
    "2025-08": (
        "First prototypes",
        "Things start existing. Engineering debates are technical. Ada is starting to push back on velocity pressure. London is building the narrative.",
    ),
    "2025-09": (
        "Beta v1 launch",
        "Something real shipped. Westbrook BAA signed. The company has its first real customer relationship — and first real responsibility.",
    ),
    "2025-10": (
        "First revenue and real pressure",
        "Hargrove signed. The company has money now and everything that comes with it: more meetings, more accountability, tighter timelines.",
    ),
    "2025-11": (
        "Clinical outcomes and investor interest",
        "The +0.8 empathy outcome from Hargrove session 3 is the first number that means something. Series A conversations begin quietly.",
    ),
    "2025-12": (
        "Year-end reset",
        "Everything slows. The team exhales. People remember why they joined. Planning replaces building. Mira becomes more philosophical.",
    ),
    "2026-01": (
        "New year traction",
        "EMU enters the pipeline. The Series A narrative is taking shape. The team is bigger in spirit than in headcount.",
    ),
    "2026-02": (
        "EMU pilot and fundraising momentum",
        "EMU day 1 is the most professional thing the company has done. Benchmark wants a term sheet. Everyone is nervous in a good way.",
    ),
    "2026-03": (
        "EMU closes, Series A term sheet",
        "The +0.9 from EMU is the scientific proof point that the company has been building toward. Everything accelerates.",
    ),
    "2026-04": (
        "Series A closes, production incident, hiring",
        "The money is in the bank. A production incident at peak load tests the team. Dr. Okonkwo is hired. The company starts to feel like a company.",
    ),
    "2026-05": (
        "Public launch",
        "The press release drops. ACEP conference. 34 inbound leads. The world knows about Pixelated Empathy. The team is overwhelmed in the best possible way.",
    ),
    "2026-06": (
        "$1M ARR and stabilization",
        "The company crosses $1M ARR. Two new engineers join. The celebration dinner. Dr. Tran's name is invoked during the signing call. The team reflects on 11 months.",
    ),
}

# Suggested email thread topics per month (seeding variety)
_MONTH_KEY_THREADS: dict[str, list[str]] = {
    "2025-07": [
        "Q3 OKR alignment",
        "Westbrook proposal draft",
        "Simulation engine API design",
        "Clinical scenario approval",
        "July sprint planning",
        "LLM model benchmarking",
        "PagerDuty on-call setup",
        "Empathy scoring rubric v0.1",
        "Team operating norms",
    ],
    "2025-08": [
        "WebSocket migration plan",
        "Westbrook demo prep",
        "Multi-tenant architecture decision",
        "Hargrove product brief",
        "Clinical partner onboarding checklist",
        "Session replay UI",
        "Memory leak bug report",
        "LLM provider abstraction spec",
    ],
    "2025-09": [
        "Beta v1 launch checklist",
        "Westbrook pilot session 1 debrief",
        "Hargrove demo follow-up",
        "FHIR integration decision",
        "Latency spike investigation",
        "Sprint 5 UX kickoff",
        "Component library setup",
        "DR runbook",
    ],
    "2025-10": [
        "Hargrove pilot agreement",
        "Production incident postmortem",
        "Session history feature request",
        "Persona variability concept",
        "Pacific Allied Health pricing",
        "FHIR integration week 2",
        "pgbouncer tuning",
        "Ethics conversation — AI simulation boundaries",
    ],
    "2025-11": [
        "Westbrook pilot final session",
        "Pacific Allied deal negotiation",
        "Hargrove session 3 outcomes",
        "FHIR integration QA",
        "Tech debt sprint",
        "Series A data room",
        "PDF annotation export",
        "Clinical advisory board charter",
    ],
    "2025-12": [
        "Event sourcing refactor",
        "Westbrook renewal proposal",
        "Hargrove year-end outcomes",
        "2026 technical roadmap",
        "Security findings remediation",
        "White paper draft",
        "2026 ARR target discussion",
        "Series A narrative",
    ],
    "2026-01": [
        "EMU pilot discovery",
        "Benchmark Series A follow-up",
        "Spanish personas approval",
        "Multi-region migration",
        "Session branching v0.2",
        "Series A data room complete",
        "Cohort comparison feature",
        "Nurse practitioner scenario module",
    ],
    "2026-02": [
        "Benchmark term sheet prep",
        "EMU day 1 monitoring",
        "White paper journal submission",
        "Audit trail dashboard",
        "Pacific Allied account risk",
        "Cohort analytics performance fix",
        "Clinical advisory board first meeting",
        "FHIR validation CI",
    ],
    "2026-03": [
        "Benchmark term sheet negotiation",
        "EMU pilot results (+0.9)",
        "EMU full deal close",
        "API refactor structured errors",
        "Pacific Allied board presentation",
        "White paper resubmission",
        "ACEP poster acceptance",
        "Penetration test decision",
    ],
    "2026-04": [
        "Series A close and wire",
        "Production incident April 13",
        "Pen test findings remediation",
        "EMU rollout monitoring",
        "Dr. Okonkwo hiring",
        "v2 visual identity review",
        "Engineering headcount planning",
        "Journal acceptance announcement",
    ],
    "2026-05": [
        "Press release launch",
        "ACEP conference debrief",
        "Riverview Medical Group close",
        "Kubernetes migration decision",
        "Central Valley Nursing close",
        "34 inbound leads triage",
        "Series A press coverage",
        "EMU cohort 2 kickoff",
    ],
    "2026-06": [
        "Dr. Sharma $180k deal",
        "Kubernetes production migration",
        "$1M ARR milestone",
        "Dr. Okonkwo curriculum ladder",
        "Kai and Priya onboarding",
        "Damien Cross hire",
        "H2 growth plan",
        "H1 investor letter",
    ],
}


def plan_month(
    month: str,
    work_dir: Path,
    prior_month_summary: str | None = None,
) -> tuple[MonthBible, list[SalvageCandidate]]:
    """Plan a single month: emit month_bible.json and salvage_candidates.json."""
    if month not in MONTH_TARGETS:
        raise ValueError(f"Unknown month: {month}. Valid: {list(MONTH_TARGETS.keys())}")

    spine = get_event_spine()
    year, mon = (int(x) for x in month.split("-"))
    events_this_month = spine.events_for_month(year, mon)

    # Determine active personas: all 9 every month, but Mira is limited early
    active_personas = list(PERSONA_NAMES)

    target = MONTH_TARGETS[month]
    theme, arc = _MONTH_THEMES[month]
    key_threads = _MONTH_KEY_THREADS[month]

    bible = MonthBible(
        month=month,
        tier=target["tier"],
        target_emails=target["emails"],
        target_chat_bursts=target["chat_bursts"],
        events=events_this_month,
        active_personas=active_personas,
        theme=theme,
        narrative_arc=arc,
        key_threads=key_threads,
    )

    # Salvage candidates: only available from month 2 onward
    salvage: list[SalvageCandidate] = []
    month_idx = MONTH_ORDER.index(month)
    if month_idx > 0:
        prior_month = MONTH_ORDER[month_idx - 1]
        prior_emails_path = work_dir.parent / prior_month / "generated_emails.json"
        if prior_emails_path.exists():
            try:
                prior_emails: list[dict[str, object]] = json.loads(prior_emails_path.read_text())
                seen_thread_ids: set[str] = set()
                for email in prior_emails:
                    tid = str(email.get("thread_id", ""))
                    if tid in seen_thread_ids:
                        continue
                    seen_thread_ids.add(tid)
                    # Score: threads with multiple participants are better salvage candidates
                    recips = email.get("recipients", [])
                    n_recips = len(recips) if isinstance(recips, list) else 0
                    score = min(1.0, 0.3 + n_recips * 0.15)
                    salvage.append(
                        SalvageCandidate(
                            source_month=prior_month,
                            thread_id=tid,
                            subject=str(email.get("subject", "")),
                            score=score,
                            reason="Multi-participant thread with continuation potential",
                        )
                    )
                # Keep top 20 by score
                salvage = sorted(salvage, key=lambda s: s.score, reverse=True)[:20]
            except Exception:
                salvage = []

    # Write outputs
    month_dir = work_dir
    month_dir.mkdir(parents=True, exist_ok=True)
    (month_dir / "month_bible.json").write_text(
        bible.model_dump_json(indent=2)
    )
    salvage_data = [s.model_dump() for s in salvage]
    (month_dir / "salvage_candidates.json").write_text(
        json.dumps(salvage_data, indent=2, default=str)
    )

    return bible, salvage


def build_manifest(work_dir_root: Path) -> Manifest:
    """Build and write the full 11-month manifest."""
    entries: list[ManifestEntry] = []
    for month, target in MONTH_TARGETS.items():
        theme, arc = _MONTH_THEMES[month]
        entries.append(
            ManifestEntry(
                month=month,
                tier=target["tier"],
                target_emails=target["emails"],
                target_chat_bursts=target["chat_bursts"],
                theme=theme,
                narrative_arc=arc,
            )
        )
    manifest = Manifest(months=entries)
    work_dir_root.mkdir(parents=True, exist_ok=True)
    (work_dir_root / "manifest.json").write_text(manifest.model_dump_json(indent=2))
    return manifest
