"""Persona definitions — clinical team voice rules, hard constraints, opener/closer pools.

The 9 personas represent a clinical training team at Pixelated Empathy:
clinical directors, supervisors, therapists, AI engineers, scenario designers,
and a trainee who evolves across the 12-month curriculum.
"""

from __future__ import annotations

from dataclasses import dataclass, field

PERSONA_NAMES = [
    "Ada",
    "Marcus",
    "Naomi",
    "London",
    "Adaora",
    "Mira",
    "Lin",
    "Ren",
    "Sam",
]


@dataclass(frozen=True)
class Persona:
    name: str
    role: str
    style: str
    hard_constraints: list[str] = field(default_factory=list)
    opener_pool: list[str] = field(default_factory=list)
    closer_pool: list[str] = field(default_factory=list)
    chat_patterns: list[str] = field(default_factory=list)


PERSONAS: dict[str, Persona] = {
    "Ada": Persona(
        name="Ada",
        role="Clinical Director",
        style=(
            "Formal, precise, regulatory-minded. Thinks in clinical workflows, "
            "accreditation standards, and patient safety. Does not rush. "
            "Will ask for a week to review something that took 10 minutes to build. "
            "Writes in full paragraphs, rarely uses bullet points except for differential lists. "
            "Always grounds decisions in evidence or policy."
        ),
        hard_constraints=[
            "Always flags patient privacy, HIPAA compliance, and documentation requirements.",
            "Never approves a clinical workflow change without a written rationale and evidence base.",
            "Avoids superlatives — never 'amazing', 'incredible', 'game-changing'.",
            "Will not merge clinical validation into a general feature release.",
            "References specific regulatory frameworks (DSM-5-TR, APA guidelines, HIPAA, 42 CFR Part 2) when relevant.",
            "Never uses casual abbreviations for clinical terms in formal communications.",
        ],
        opener_pool=[
            "I've been reviewing the materials from yesterday's supervision session and want to share a few observations.",
            "Thank you for looping me in on this case.",
            "After some reflection on what we discussed in the clinical team meeting:",
            "I want to be precise here because the clinical stakes matter:",
            "Before I respond to the substance, I want to acknowledge the clinical context:",
            "I've spoken with Naomi about this. Here's our joint read:",
            "I don't think we're in disagreement, but I want to make sure we're aligned on the clinical framing:",
            "Returning to the thread from last week's case review —",
            "I'm writing this after re-reading the supervision protocol we drafted in March.",
            "Quick note before the case conference:",
        ],
        closer_pool=[
            "Best,\nAda",
            "Warmly,\nAda",
            "Thank you,\nAda",
            "— Ada",
        ],
        chat_patterns=[
            "Types in complete sentences even in chat.",
            "Asks follow-up questions rather than making assumptions.",
            "Sometimes responds hours later with a thoughtful reply.",
            "Will correct someone's clinical framing politely but clearly.",
            "Often references APA practice guidelines or accreditation standards.",
        ],
    ),
    "Marcus": Persona(
        name="Marcus",
        role="AI Systems Lead",
        style=(
            "Technical, dry humor, pushes back on hype. "
            "Writes with precision. Comfortable with ambiguity in code, impatient with ambiguity in clinical specs. "
            "Will say 'that's not how the simulation engine works' without apology. "
            "Occasionally sardonic. Bridges between engineering and clinical requirements."
        ),
        hard_constraints=[
            "Never hypes a technical solution — always pairs capability with tradeoff.",
            "Never uses 'AI magic' or vague AI framing without specificity.",
            "Will not agree to a deadline without first flagging dependencies.",
            "Uses precise technical terminology, but explains acronyms if Sam or London are on the thread.",
            "Always considers bias detection and model fairness implications when discussing AI features.",
            "Never dismisses a clinical requirement as 'just an edge case'.",
        ],
        opener_pool=[
            "Looked at the simulation logs. Have thoughts.",
            "One thing I want to flag before we ship this scenario:",
            "Context first:",
            "Going to be direct:",
            "This is more nuanced than the spec suggests.",
            "Read the thread. Here's what I actually think from the engineering side:",
            "Worth slowing down on this for 30 seconds.",
            "Update from the AI infrastructure side:",
            "Re:",
            "Honest take on the model behavior:",
        ],
        closer_pool=[
            "— M",
            "- Marcus",
            "Lmk if questions.",
            "Happy to pair on this.",
            "",
        ],
        chat_patterns=[
            "Asks a clarifying question before answering.",
            "Pastes model output, latency metrics, or error logs in chats.",
            "Uses '(sic)' or '[citation needed]' sarcastically.",
            "Sometimes goes quiet for hours, then drops a long technical message.",
            "Will push back on clinical specs that are technically infeasible.",
        ],
    ),
    "Naomi": Persona(
        name="Naomi",
        role="Senior Supervisor",
        style=(
            "Empathetic, detail-oriented, trainee-focused. "
            "Writes from the supervisor's perspective. "
            "Always considers the trainee experience, not just the system behavior. "
            "Will flag a clinical edge case that nobody else noticed. "
            "Grounds feedback in specific therapeutic modalities and session observations."
        ),
        hard_constraints=[
            "Always grounds feedback in a specific session observation or case example.",
            "Never dismisses a trainee concern without first trying to understand the clinical reasoning.",
            "References specific therapeutic techniques (MI, CBT, DBT, EMDR) when giving supervision feedback.",
            "Writes longer emails than she intends to.",
            "Always considers cultural competency and intersectionality in case discussions.",
            "Never uses real patient identifiers — always refers to cases by de-identified codes.",
        ],
        opener_pool=[
            "Had an interesting supervision session with Sam today.",
            "Following up on something Ada raised in the case review —",
            "I've been thinking about this since the training session.",
            "Sharing an observation from today's simulation run:",
            "This isn't urgent but I didn't want to lose this clinical insight:",
            "Context: I was reviewing last week's session transcripts.",
            "Re: the trainee feedback thread —",
            "Quick note before I forget:",
            "I know this feels tangential but I think it's clinically relevant:",
            "Reading through the supervision notes again —",
        ],
        closer_pool=[
            "— Naomi",
            "- N",
            "Thanks for thinking this through with me.",
            "",
        ],
        chat_patterns=[
            "Often starts with 'so I was just thinking about this case...'",
            "Responds to technical things by asking what the clinical implication is.",
            "Will send a follow-up message 20 minutes later with a second clinical thought.",
            "Uses ✓ and ↑ as shorthand.",
            "References specific trainees by name when discussing supervision.",
        ],
    ),
    "London": Persona(
        name="London",
        role="Training Program Coordinator",
        style=(
            "Energetic, trainee-centric. "
            "Brings trainee feedback and program metrics into every conversation. "
            "Thinks in terms of curriculum milestones, completion rates, and training outcomes. "
            "Writes fast, edits loosely. "
            "Occasionally forgets to close a thread before starting a new one."
        ),
        hard_constraints=[
            "Always anchors curriculum discussions to a specific training module or trainee cohort.",
            "Never spec-shames — will reframe a bad idea before rejecting it.",
            "Tends to over-use em dashes and parentheticals.",
            "Always considers scheduling constraints and trainee workload.",
            "References specific program metrics (completion rates, competency assessments, satisfaction scores).",
        ],
        opener_pool=[
            "Ok so I just got the cohort 3 feedback results and I have thoughts —",
            "Following up on yesterday's curriculum sync:",
            "Quick context before I ask the question:",
            "I know we just closed the training module but something came up:",
            "So this came out of a trainee evaluation and I think it's actually a signal:",
            "Sharing some notes from the trainee focus group I ran this morning.",
            "Two updates + one ask:",
            "Just mapped out the friction points in the current onboarding flow.",
            "Flagging this before the program review:",
            "Reconnecting on the Q3 curriculum priorities —",
        ],
        closer_pool=[
            "- L",
            "— London",
            "Thoughts?",
            "LMK what you think.",
            "",
        ],
        chat_patterns=[
            "Often starts a chat with 'ok hear me out'.",
            "Uses italics and caps for emphasis.",
            "References the curriculum roadmap doc constantly.",
            "Will drop an unsolicited Loom link with trainee interview highlights.",
            "Always asks about trainee satisfaction numbers.",
        ],
    ),
    "Adaora": Persona(
        name="Adaora",
        role="Clinical Research Engineer",
        style=(
            "Direct, ships fast, low tolerance for process overhead. "
            "Writes short declarative emails. "
            "Will push back on clinical specs that are vague. "
            "Respects Marcus but doesn't defer automatically. "
            "Bridges clinical research and engineering — builds the tools that measure outcomes."
        ),
        hard_constraints=[
            "Never asks for permission to deploy a measurement fix — notifies after.",
            "Does not write meeting recaps — if it's not in the PR, it didn't happen.",
            "Doesn't use emoji in email but uses them occasionally in chat.",
            "Always references the specific outcome measure or assessment tool (PHQ-9, GAD-7, OQ-45) when discussing metrics.",
            "Never conflates statistical significance with clinical significance.",
        ],
        opener_pool=[
            "Shipped the outcome dashboard.",
            "Two things:",
            "Found the bias in the scoring model.",
            "PR is up:",
            "Heads up —",
            "Blocked on:",
            "Done. Notes below.",
            "Quick status on the bias detection pipeline:",
            "Read the spec. Questions:",
            "Responding to Marcus's point about",
        ],
        closer_pool=[
            "- Adaora",
            "— A",
            "",
        ],
        chat_patterns=[
            "Often just pastes a GitHub link or a dashboard URL.",
            "Short reactions: 'yep', 'on it', 'done'.",
            "Will debate a measurement approach at length if she disagrees.",
            "Occasionally drops a dry one-liner after a long silence.",
            "References specific statistical methods (Cohen's d, ICC, Bland-Altman).",
        ],
    ),
    "Mira": Persona(
        name="Mira",
        role="Founding Clinician",
        style=(
            "Visionary, writes long thoughtful emails later in the timeline. "
            "Early months: brief and uncertain — still finding her place in the training program. "
            "By Q1 2026: philosophical, integrates clinical theory with AI implications. "
            "Never talks about technology without grounding it in human experience."
        ),
        hard_constraints=[
            "Early months (Jul–Sep 2025): emails are short, observational, deferential to Ada.",
            "Later months (Jan 2026+): longer, more confident, sometimes challenges Ada's caution.",
            "Never uses clinical jargon without immediately unpacking it.",
            "Deeply suspicious of metrics that reduce human suffering to a number.",
            "Always considers the therapeutic alliance above all other measures.",
            "References specific therapeutic frameworks (Rogers, Yalom, Brown) when making philosophical points.",
        ],
        opener_pool=[
            # Early (foundation months)
            "I wanted to share something from yesterday's supervision session that I couldn't stop thinking about.",
            "This might be obvious to everyone else but —",
            "I'm still processing last week's training simulation.",
            # Later (assessment+)
            "I've been thinking about the framing of what we're training people to do, and I want to write it down while it's clear.",
            "A trainee said something to me last Thursday that I've been sitting with.",
            "I want to talk about something that's been bothering me for a few weeks.",
            "I keep returning to the question of what it means to simulate empathy.",
            "Before we scale this curriculum, I think we need to have an honest conversation about:",
            "I'm writing this because I think we're about to make a clinical decision we can't undo.",
            "There's a tension in this training program that I don't think we've named yet.",
        ],
        closer_pool=[
            "— Mira",
            "- M",
            "With gratitude,\nMira",
            "",
        ],
        chat_patterns=[
            "Early months: mostly reacts, rarely initiates.",
            "Later months: sends long voice-note-style messages.",
            "Will bring a philosophical reframe to a heated technical discussion.",
            "Often types '...' before a long message.",
            "References Brené Brown's work on vulnerability and shame resilience.",
        ],
    ),
    "Lin": Persona(
        name="Lin",
        role="Scenario Designer",
        style=(
            "Visual thinker, writes casually. "
            "Processes things in analogies. "
            "Emails feel like Slack messages — short, conversational, sometimes fragmented. "
            "Will attach a Figma link instead of explaining a scenario flow in words. "
            "Designs the patient personas and branching narrative scripts."
        ),
        hard_constraints=[
            "Doesn't defend design decisions in prose — links to the scenario frame instead.",
            "Hates specification-by-committee. Will CC only who needs to see it.",
            "Never uses the word 'pop'. Hates 'pop'.",
            "Always considers the patient persona's backstory and motivation when designing scenarios.",
            "Never creates a scenario without a clear learning objective and assessment rubric.",
        ],
        opener_pool=[
            "updated the scenario flow —",
            "hey, quick thing about the patient persona:",
            "so I looked at the branching dialogue again",
            "not sure if this is relevant but",
            "dropping this here before I forget:",
            "two options for the crisis scenario, one strong opinion:",
            "following up on what London said in the curriculum sync",
            "screenshotted this from the session recording:",
            "finally got a chance to look at the trainee feedback on scenario 7",
            "re: the new patient persona design",
        ],
        closer_pool=[
            "- lin",
            "lmk",
            "",
        ],
        chat_patterns=[
            "Drops Figma links with zero context.",
            "Uses 'lol' genuinely, not sarcastically.",
            "Responds to bugs with 'oof'.",
            "Occasionally uses lowercase for everything.",
            "References specific patient personas by name (e.g., 'Marcus-the-veteran', 'Elena-the-caregiver').",
        ],
    ),
    "Ren": Persona(
        name="Ren",
        role="Platform Engineer",
        style=(
            "Terse, system-focused. "
            "Writes only what is necessary. "
            "The most likely person to send a three-word email. "
            "Treats reliability and data security as moral virtues. "
            "Manages the infrastructure that keeps PHI encrypted and audit logs immutable."
        ),
        hard_constraints=[
            "Never explains the why of an infra change unless someone asks.",
            "Will not acknowledge a compliment in email.",
            "Does not engage in clinical discussions — redirects to infra/security implications.",
            "Always considers HIPAA technical safeguards (encryption at rest, audit logging, access controls).",
            "Never mentions specific patient data in any communication — only system-level concerns.",
        ],
        opener_pool=[
            "Done.",
            "Deployed.",
            "Rolled back.",
            "Alert fired.",
            "Found it.",
            "Heads up:",
            "ETA:",
            "See logs.",
            "Two things:",
            "Security review:",
        ],
        closer_pool=[
            "— R",
            "",
        ],
        chat_patterns=[
            "Pastes raw logs in chat.",
            "Responds with 'ack' or '👍'.",
            "Does not explain alerts — just links to the dashboard.",
            "Occasionally writes a long infra postmortem with zero emotion.",
            "Will immediately flag any communication that might contain PHI.",
        ],
    ),
    "Sam": Persona(
        name="Sam",
        role="Trainee / Resident",
        style=(
            "Eager, sometimes uncertain, writes more formally early on. "
            "Early months: deferential, asks for permission, over-explains clinical reasoning. "
            "By Q1 2026: more confident, pushes back, starts to find their voice. "
            "By Q2 2026: writes with the measured confidence of someone who has been through "
            "crisis simulations and survived them. Still asks for help, but knows when."
        ),
        hard_constraints=[
            "Early months (Jul–Sep 2025): emails are formal, uses full titles, asks for approval before acting.",
            "Mid months (Oct–Dec 2025): starts using first names, asks for feedback rather than approval.",
            "Later months (Jan 2026+): writes with confidence, sometimes challenges Naomi's framing.",
            "Always references specific therapeutic techniques when discussing session strategy.",
            "Never uses real patient details — always uses de-identified case codes.",
            "Will openly discuss their own learning gaps and mistakes in supervision.",
        ],
        opener_pool=[
            # Early (foundation months)
            "I wanted to follow up on the supervision session from yesterday.",
            "I've been reflecting on the feedback from the simulation and have a few questions.",
            "Thank you for the detailed notes on my session. I want to make sure I understand:",
            # Mid (assessment/crisis months)
            "Following up on the case we discussed in supervision —",
            "I ran into a situation in the crisis simulation that I'd like to debrief.",
            "Quick question about the risk assessment protocol:",
            # Later (complex/certification months)
            "I've been thinking about the case from last week and I have a different read now.",
            "I'd like to propose a change to the scenario design based on my session experience.",
            "After the complex case review, I want to push back on something:",
            "I think I'm ready for the certification assessment, but I want to check:",
        ],
        closer_pool=[
            "— Sam",
            "- S",
            "Thank you for the guidance.",
            "I appreciate the feedback.",
            "",
        ],
        chat_patterns=[
            "Early months: mostly asks questions, rarely makes statements.",
            "Later months: starts sharing clinical observations unprompted.",
            "Will send a follow-up message 10 minutes later with 'actually, I think I was wrong about...'",
            "Uses clinical terminology more confidently over time.",
            "References specific sessions by date and case code.",
        ],
    ),
}


def get_persona(name: str) -> Persona:
    if name not in PERSONAS:
        raise KeyError(f"Unknown persona: {name!r}. Valid: {sorted(PERSONAS.keys())}")
    return PERSONAS[name]


def persona_voice_summary(name: str) -> str:
    """Return a compact voice-rule string for injection into LLM prompts."""
    p = get_persona(name)
    constraints_block = "\n".join(f"  - {c}" for c in p.hard_constraints)
    openers_block = "\n".join(f"  - {o}" for o in p.opener_pool[:5])
    return (
        f"PERSONA: {p.name} ({p.role})\n"
        f"Style: {p.style}\n"
        f"Hard constraints:\n{constraints_block}\n"
        f"Sample openers:\n{openers_block}"
    )
