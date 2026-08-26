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
        "Foundation: Building the therapeutic alliance",
        "The clinical team is forming. Sam is new and deferential. Supervision sessions focus on basic rapport, active listening, and the therapeutic frame. "
        "Emails are tentative — the team is still establishing communication norms. Ada sets the clinical standards. Naomi begins supervision with Sam.",
    ),
    "2025-08": (
        "Foundation: Deepening core skills",
        "Sam gains confidence in basic session conduct. The team debates scenario design and empathy scoring. Adaora instruments the first outcome measures. "
        "Marcus pushes back on clinical specs that are technically vague. The foundation tier gate review approaches.",
    ),
    "2025-09": (
        "Assessment: Intake and diagnostic screening",
        "The curriculum shifts to structured intake assessment. Sam learns the PHQ-9, GAD-7, and Columbia Protocol. Lin designs new patient personas with "
        "embedded risk factors. The team debates the ethics of diagnostic labeling. Mira begins to find her philosophical voice.",
    ),
    "2025-10": (
        "Assessment: Risk screening and case formulation",
        "Sam conducts suicide risk assessments and differential diagnoses. The team confronts the weight of clinical responsibility. "
        "Adaora's bias detection pipeline reveals demographic disparities in the empathy scoring. The assessment tier gate review tests Sam's readiness for crisis work.",
    ),
    "2025-11": (
        "Crisis: Acute suicidality and de-escalation",
        "The crisis module begins. Sam works with acutely suicidal patient personas. The team grapples with the emotional weight of crisis training. "
        "Naomi monitors Sam's wellbeing closely. Lin's crisis scenarios test the simulation engine's real-time branching. Ren stress-tests the platform.",
    ),
    "2025-12": (
        "Crisis: Safety planning and clinician self-care",
        "The year slows. Sam debriefs difficult crisis simulations. The team reflects on vicarious traumatization and clinician burnout. "
        "Mira writes her most philosophical email yet on the cost of empathy. The crisis tier gate review marks the halfway point of the program.",
    ),
    "2026-01": (
        "Rupture-Repair: Therapeutic alliance rupture",
        "The curriculum turns to alliance rupture and repair (Safran & Muran). Sam confronts patient personas designed to trigger ruptures. "
        "The team debates the difference between a therapeutic rupture and a clinical error. Adaora integrates the Working Alliance Inventory.",
    ),
    "2026-02": (
        "Rupture-Repair: Cultural rupture and metacommunication",
        "Sam navigates cultural and racial ruptures with patient personas from different backgrounds. The team examines its own cultural blind spots. "
        "Mira discusses the concept of the 'good enough' therapist (Winnicott). The rupture-repair gate review marks Sam's growing independence.",
    ),
    "2026-03": (
        "Complex: Comorbidity and intersectionality",
        "Sam faces patients with comorbid conditions and intersectional identities. The team debates the limits of categorical diagnosis. "
        "Lin designs multi-path branching scenarios. Adaora's bias detection reveals intersectional disparities. Mira questions the ethics of clinical categorization.",
    ),
    "2026-04": (
        "Complex: Trauma-informed care",
        "Sam works with complex PTSD, dissociation, and attachment difficulties. The team discusses the neurobiology of trauma. "
        "Ren upgrades the encryption and audit infrastructure for expanded session data. The complex tier gate review approaches.",
    ),
    "2026-05": (
        "Certification: Independent practice readiness",
        "Sam begins the certification assessment. The team reviews 11 months of training data. Adaora presents the comprehensive outcome analysis. "
        "Sam conducts independent sessions spanning all tiers. The team debates what 'clinical readiness' actually means.",
    ),
    "2026-06": (
        "Certification: Final review and completion",
        "The 12-month curriculum concludes. Sam conducts the final certification session. The full team reviews the training journey. "
        "Ada presents the certification decision. Mira delivers the closing reflection on what it means to simulate empathy. The team celebrates.",
    ),
}

# Suggested email thread topics per month (seeding variety)
_MONTH_KEY_THREADS: dict[str, list[str]] = {
    "2025-07": [
        "Program orientation and supervision structure",
        "First mock intake with standardized patient",
        "Patient persona design review",
        "Reflective listening with resistant patient",
        "Foundation module timeline",
        "Empathy scoring pipeline setup",
        "Platform architecture and HIPAA compliance",
        "Foundation module debrief",
    ],
    "2025-08": [
        "Anxiety patient persona session",
        "Substance use screening (SBIRT) supervision",
        "Session boundaries and containment",
        "Bias detection pipeline review",
        "Module 2 trainee feedback",
        "Independent foundation session evaluation",
        "Foundation tier gate review",
        "New patient persona clinical fidelity",
    ],
    "2025-09": [
        "Intake assessment protocol training",
        "Crisis-intake scenario design",
        "PHQ-9 and GAD-7 outcome measurement",
        "PTSD assessment and trauma-informed approach",
        "Differential diagnosis supervision",
        "Bias detection across demographic groups",
        "Assessment module debrief",
        "Updated simulation engine deployment",
    ],
    "2025-10": [
        "Suicide risk assessment (Columbia Protocol)",
        "High-risk patient persona review",
        "Homicidal ideation and duty to warn",
        "Audit trail and encryption review",
        "Case formulation for comorbid presentations",
        "Assessment tier gate review",
        "Independent intake assessment evaluation",
        "Module 4 trainee satisfaction review",
    ],
    "2025-11": [
        "Crisis intervention protocol training",
        "Acute suicidality scenario design",
        "Crisis session supervision and de-escalation",
        "Platform stress test for concurrent sessions",
        "Patient refusing intervention — engagement strategy",
        "Crisis module trainee feedback",
        "Independent safety planning evaluation",
        "Crisis tier gate review (part 1)",
    ],
    "2025-12": [
        "Crisis debrief and clinician self-care",
        "Consolidated patient persona library review",
        "Co-occurring suicidality and substance intoxication",
        "Year-end platform performance and security audit",
        "Six-month training reflection",
        "Year-end full team debrief",
        "Independent crisis session evaluation",
        "Crisis tier gate review (part 2)",
    ],
    "2026-01": [
        "Therapeutic alliance rupture framework (Safran & Muran)",
        "Rupture-triggering patient persona design",
        "Confrontation repair supervision",
        "Working Alliance Inventory integration",
        "Missed sessions and re-engagement",
        "Rupture-repair module trainee feedback",
        "Independent repair session evaluation",
        "Rupture-repair gate review (part 1)",
    ],
    "2026-02": [
        "Therapeutic modality conflict navigation",
        "Cultural and racial rupture scenarios",
        "Cultural humility supervision",
        "Bias detection for rupture scenarios",
        "Independent rupture-repair cycle",
        "Rupture-repair module outcomes review",
        "Overall rupture-repair competence evaluation",
        "Rupture-repair gate review (part 2)",
    ],
    "2026-03": [
        "Comorbidity framework and case conceptualization",
        "Comorbid patient persona design (MDD + GAD + substance use)",
        "Integrated treatment for comorbid conditions",
        "Multi-path branching engine deployment",
        "Refugee patient with complex trauma",
        "Personality disorder features and therapeutic frame",
        "Intersectional bias analysis",
        "Complex module debrief (part 1)",
    ],
    "2026-04": [
        "TF-CBT trauma-focused session supervision",
        "Dissociation branching scenario design",
        "Grounding technique evaluation",
        "Encryption and audit trail upgrade",
        "Complex PTSD and attachment difficulties",
        "Complex module trainee feedback",
        "Independent complex case evaluation",
        "Complex tier gate review",
    ],
    "2026-05": [
        "Certification assessment framework",
        "Comprehensive certification scenario design",
        "Full independent session supervision",
        "Final platform performance review",
        "Crisis certification session",
        "Certification module curriculum review",
        "Rupture-repair certification session",
        "Certification review (part 1)",
    ],
    "2026-06": [
        "Comprehensive session integrating all tiers",
        "Complete patient persona library review",
        "Final certification session",
        "12-month outcome analysis",
        "Training journey reflection",
        "Program completion review",
        "Final supervision and certification recommendation",
        "Certification ceremony and closing reflection",
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
