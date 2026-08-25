# Brené Brown Monthly Adversarial Reviewer — Integration Spec

This document is the integration spec for promoting **Brené Brown** to a
permanent fourth monthly adversarial reviewer, co-located with the existing
in-tree 3-persona monthly path
(`monthly_adversarial_llm_review.py` runs Pied Piper, Man In Black, and LLM
Fidelity Engineer for the same month). The 4-persona monthly review is
additive only: the existing script is unchanged, the existing CLI surface
is extended, and the existing report shape is mirrored.

The spec is the canonical contract for the monthly wave of work that drives
finding-to-repair between waves; the scratch implementation in
`brene_brown_monthly_adversarial_review.py` is a light-weight exerciser that
proves the contract on a single month.

## Purpose

The in-tree 3-persona path is voice-and-fidelity centric: Pied Piper checks
that each persona sounds like themselves, Man In Black looks for the telltale
signals that betray AI-generated artifacts, and LLM Fidelity Engineer audits
training-signal quality. The path deliberately avoids "clinical realism"
questions — the assumption has been that the corpus is a startup
communications corpus, not a clinical-fiction training corpus.

The Brené Brown persona is a vulnerability / storytelling ethicist whose
anti-signals are clinically weighted: she asks whether the specific emotion
is named, whether shame is confused with guilt, whether armoring-up posture
appears under the guise of "strong leadership", whether platitudes come
without the named cost, and whether premature "let it go" closes rupture
before repair. None of these questions is on the existing 3-persona axis,
which is why the v1 Quadit gate surfaced 7 Brené Brown-critical findings
across the post-Wave-30 release-envelope (cleaned=5, enhanced=2).

This spec promotes Brené Brown to a permanent fourth monthly reviewer so
that, every month, the corpus is checked on the clinical-anti-signal axis
**alongside** the existing 3 personas — not as a Wave-31-style one-off
fold-in, but as a co-reviewer that flags records the wave-flow then
back-repairs via the next repair wave. The expected steady-state outcome
is `no_brene_brown_critical = true` and `no_brene_brown_critical_since` is
advancing month-over-month.

## Persona descriptor binding

This spec binds to the canonical persona descriptor at
`hackathon/personas/quadit/brene_brown.toml`. That file is the single source
of truth for the persona's voice, anti-signal taxonomy, sample-finding
template, signature strings, and severity rubric. The reviewer MUST NOT
duplicate any of these into the implementation; the implementation MUST
read them at runtime from the TOML file (parseable via the standard library
`tomllib`, present on Python 3.11+) and use them as the load-bearing
taxonomy and prompt content. Rebinding in the spec (e.g. "use a different
anti-signal set") requires an edit to the TOML and a HANDOFF.md revision
note; this spec does not introduce a parallel anti-signal table.

The descriptor exposes:

- `auditor_signature_questions` — the four fixed questions the reviewer
  puts to each sampled record.
- `auditor_vocabulary_signals` — load-bearing signal vocabulary (Atlas of
  the Heart, BRAVING, etc.).
- `auditor_anti_signals` — the 5 anti-signal labels that drive the
  severity rubric.
- `auditor_sample_signature_strings` — the 7 signature strings the
  reviewer emits when it fires (e.g. `clinical_abstraction_over_warmth`,
  `performative_toughness_as_armor`).
- `auditor_severity_rubric` — `critical` / `warning` / `info` mapping.
- `auditor_sample_finding_template` — the schema the reviewer renders
  findings into.

The implementation MUST append the descriptor's exact 5 anti-signal labels
into the `taxonomy` field of the emitted summary and group any findings
the reviewer emits by those labels. Drift between the descriptor and the
summary's `taxonomy` field is a non-regression violation.

## CLI surface

The spec extends the existing `corpus` CLI (defined in
`hackathon/corpus/corpus-generator/pixelated_empathy/cli.py`) with a new
subcommand:

```
corpus atrocity-review 2026-06 --persona brene-brown
```

The subcommand:

1. Lives next to the existing `corpus llm-review 2026-06 [--model MODEL]`
   subcommand (which runs all 3 personas).
2. Accepts `--persona {pied-piper,man-in-black,llm-fidelity-engineer,brene-brown}`.
   `--persona brene-brown` is the new co-review path; the other three are
   thin wrappers that dispatch to the existing 3-persona-runner for
   backward-compat callers.
3. Accepts `--work-dir` (default `monthly_work`) matching the existing
   convention. Accepts `--n` (default 50) for sample-size; the existing
   `monthly_adversarial_llm_review.py` uses 30 for emails / 20 for chats
   and the new path is 50 (stratified by sender) per the Sampling section
   below.
4. Writes outputs into
   `monthly_work/{YYYY-MM}/brene_brown_adversarial_review.json` (summary)
   and `monthly_work/{YYYY-MM}/brene_brown_adversarial_review.jsonl`
   (per-finding findings).
5. The command exits 0 on a clean run (whether or not critical findings
   are emitted — reviewer emits findings, the caller decides what to do
   with them).
6. The command is **never** invoked as a destructive operation. It does
   not modify the underlying monthly work directory except by writing its
   own summary + jsonl paths under the month directory.

The implementation must be importable as
`pixelated_empathy.brene_brown_monthly_adversarial_review.review` and
returnable as the same JSON shape that
`monthly_adversarial_llm_review.review` returns (a `Report` object with
the three-persona-shape mirrored to a single-persona shape).

## Anti-signal taxonomy

The 5 anti-signal categories are the descriptor's
`auditor_anti_signals` list, loaded verbatim from
`hackathon/personas/quadit/brene_brown.toml`:

1. `armoring-as-strong-leadership` — categorical voice that paints
   numbing, perfectionism, hustling, cool, or cynicism as professional
   strength.
2. `platitude-without-cost` — "I'm here for you" without the named
   behavioral backing (no concrete offer, no specific repair step).
3. `clinical-abstraction-over-warmth` — "experiencing difficulty"
   instead of the discrete-emotion name (shame spiral, exhausted, lonely,
   betrayed, etc.) erodes the vulnerability-as-courage frame.
4. `premature-let-it-go-closure` — "this is behind us now" before repair
   has occurred; smoothing over the rupture without accountability.
5. `dismissive-strength-talk` — "the standard is the standard",
   "you're a pro, push through", "stay busy to avoid sitting still" —
   tone that translates emotional cost into a discipline problem and
   anoints the avoidant posture as competence.

These 5 categories map onto the canonical 11-body-defect buckets in the
release-corpus audit as follows:

- `armoring-as-strong-leadership` ↔ `stacked_salutation` (the "—", "—"
  paired salutation screams armor) + a structural-residue class
  `performative_toughness_as_armor` that lives in the disposition
  ledger.
- `platitude-without-cost` ↔ `contentless` (the body says "I support you"
  with no event-content backing) + `generic_actionless_filler`.
- `clinical-abstraction-over-warmth` ↔ `repeated_signoff` (the warm
  sentiment is undermined by the closing trope) + the `tout_empathy_
  without_cost` audit signature.
- `premature-let-it-go-closure` ↔ no canonical body-defect bucket — this
  anti-signal maps onto a **per-month dialogue-level finding**, surfaced
  by the reviewer and reified by the wave-flow. The implementation emits
  it as an anti-signal label and the cleanup lane decides whether to
  back-repair.
- `dismissive-strength-talk` ↔ `sender_signoff_mismatch` (a signoff
  whose tone was a supervisor's dismissiveness rather than the sender's
  established register) + the `dismissive_strength_talk` audit
  signature.

The implementation MUST NOT collapse these anti-signals into the existing
11 body-defect buckets on summary emission. The reviewer's
`by_signature` field MUST be keyed by the 5 anti-signal labels, with a
`legacy_body_defect_overlap` cross-reference field that lists, per
anti-signal label, which canonical bucket each record's other audit
findings came with. This double-entry is necessary because the
anti-signal is **the reviewer's clinical-language opinion** and the
overlap is **the deterministic audit's body-fact opinion**.

## Sampling

N=50 emails per month, stratified by `sender`. Lighter than the Quadit
N=200-per-stage sample because the monthly path is more frequent (every
month vs. every wave) and the Brené Brown reviewer's cost-per-prompt is
roughly 3-7 seconds. Stratification by sender is necessary because the
reviewer's armoring-as-strong-leadership anti-signal is most loud on
sender-day subsections where one persona dominates (e.g. Chad-em-dash on a
late-quarter deck-prep day).

Stratification algorithm:

1. Load `monthly_work/{YYYY-MM}/generated_emails.json`.
2. Group by `sender`. Drop any group with fewer than 1 email.
3. Allocate seats per group via largest-remainder rounding so the per-month
   seat total is exactly N=50 (e.g. 9 senders → groups of ~6 each).
4. If a group's allocation exceeds its size, the surplus rebalances
   across the remaining groups, deterministic order = alphabetical sender
   name (so replications are reproducible run-to-run).
5. Within each group, take the first `min(alloc, group_size)` records in
   the source file's order. (The source file is generated by the standard
   monthly pipeline, so the order is deterministic across runs given the
   same upstream inputs.)

If `generated_emails.json` has fewer than 50 emails total, the sample
falls back to `len(emails)` and the run is still recorded (sample `n`
field has the actual count). If `generated_emails.json` is missing, the
run refuses to proceed and exits non-zero with a clear error message —
this is a precondition failure on the upstream generation, not on the
reviewer.

## Output

The output is two files in `monthly_work/{YYYY-MM}/`:

1. `brene_brown_adversarial_review.json` — a **single summary document**,
   shaped to mirror the existing
   `monthly_adversarial_llm_review.review()`'s
   `AdversarialLLMReviewReport` shape (single-persona, not all-3-personas).
   Top-level keys:

   - `month` — `YYYY-MM`.
   - `review_mode` — `"adversarial_auditor"`.
   - `review_date` — ISO-8601 UTC timestamp of the run.
   - `model` — string; for the scratch implementation, the empty string
     `"deterministic"` because no LLM is called (anti-signal coverage
     is exercised deterministically against the descriptor taxonomy).
   - `endpoint` — string; same convention.
   - `corpus_provenance` — `month`, `email_path`,
     `email_count`, `chat_burst_count`, `chat_message_count` (chat
     sampling is out-of-scope for the Brené Brown reviewer — chat is
     voice-fidelity territory, not clinical-anti-signal territory).
   - `sample_sizes` — `email_threads: int`, `chat_bursts: 0`.
   - `reviews` — a single-element list. The element mirrors the
     `PersonaJudgeResult` shape extended with: `persona` (`"Brené Brown"`),
     `role` (from descriptor), `verdict` (`"pass"` if 0 critical,
     `"fail"` otherwise), `score` (0-100 integer percent passing),
     `summary` (one-paragraph assessment), `strengths` (string list),
     `concerns` (string list), `findings` (list of finding dicts with
     `severity`, `signature`, `rationale`, `example_excerpt`,
     `artifact_id`), `critical_count`, `warning_count`, `info_count`.
   - `total_critical`, `total_warning`, `total_info`, `failing_verdicts`
     — totals.
   - `status` — `PASS` or `FAIL` (mirror of `adversarial_llm_review_report.json`).
   - `summary` — a single block with `persona = "brene_brown"`,
     `severity_counts` (`critical`, `warning`, `info` ints),
     `by_signature` (dict keyed by the 5 anti-signal labels, value is
     a list of finding_dicts), `by_month` (dict keyed by month year-month
     strings, lists finding ids — for monthly cadence), `n` (sample size),
     `no_brene_brown_critical` (bool — true iff total_critical == 0),
     `no_brene_brown_critical_since` (string — either `"NEVER"` or
     the `YYYY-MM` of the last clean month), `cascade_required` (bool —
     true iff any critical fires).
   - `taxonomy` — the 5 anti-signal labels verbatim from the descriptor
     (these MUST match the descriptor's `auditor_anti_signals` list).
   - `legacy_body_defect_overlap` — dict keyed by the 5 anti-signal
     labels, value is a list of body-defect bucket names that overlap
     with the records found under this anti-signal label.

2. `brene_brown_adversarial_review.jsonl` — line-delimited per-finding
   records. One record per finding, schema:

   ```json
   {
     "id": "<uuid>",
     "month": "2026-06",
     "artifact_id": "<email id>",
     "sender": "<sender name>",
     "severity": "critical" | "warning" | "info",
     "signature": "<one of 5 anti-signal labels>",
     "rationale": "<str>",
     "example_excerpt": "<str>"
   }
   ```

The summary's top-level shape mirrors
`monthly_adversarial_llm_review_report.json` for the reviewer-module, but
adds the `summary` sub-group to satisfy the snapshot-style summary
contract the wave-flow consumes. The jsonl complements the summary so
the wave-flow can diff month-over-month.

## Cascade rules

The reviewer is the upstream eye; the wave-flow is the downstream muscle.

1. **Per-month critical trigger.** When the reviewer emits at least one
   `critical` finding in month `M`, the next month's
   `monthly_generator.py --phase repair` MUST take the
   `(artifact_id, signature)` pairs from the `findings.jsonl` into its
   repair queue. The artifact-id is the load-bearing key; the signature
   is informational (the wave-flow already knows which body-defect
   bucket it is folding into).

2. **Body-fixable vs structural-residue split.** Whenever a reviewer's
   critical finding corresponds to a body-fixable body-defect bucket
   (per the cross-reference table in the Anti-Signal Taxonomy section
   above), the wave-fold-in is straightforward: a body-only seam merge.
   Whenever the anti-signal is not body-fixable (e.g.
   `premature-let-it-go-closure` is dialogue-level, not body-level), the
   finding enters the disposition ledger as a new entry — the new
   structural-residue category is `brene_brown_clinical_signature`
   (already authorized in Wave-31 / Quadit Iterate architecture
   `architecture.md § Iteration Lane Boundaries`).

3. **Critical → cascade = true.** The summary's `cascade_required`
   field is set to `true` iff `total_critical > 0`. The wave-flow's
   prelude reads this field and queues the month for back-repair.

4. **No silent escapes.** Even if the deterministic audit returns 0
   failing-records on the post-cascade state, the reviewer finding is
   preserved (not deleted). The disposal of reviewer findings is the
   structural-disposition ledger's job, not the reviewer's.

5. **Per-the-month dispatch-resume-gate.** If the wave-flow is mid-cascade
   for any reason at the time the reviewer runs, the reviewer runs
   against the post-cascade state, not the pre-cascade state. The
   reviewer's contract is "this month's empirical state" — never
   back-rolled for cleanup-velocity reasons.

## Non-regression gate

The spec's non-regression gate is `no_brene_brown_critical_since`. The
field advances whenever the reviewer's run returns `total_critical == 0`.

- When `total_critical == 0`, set
  `no_brene_brown_critical_since = "<this-month-YYYY-MM>"`.
- When `total_critical > 0`, set
  `no_brene_brown_critical_since = "<uint>P30D"` — i.e. the longest
  consecutive clean-month streak measured in P30D (30-day) units, capped
  at the longest attested streak in any prior reviewer's report.

The gate's **practical interpretation** is: cleanup operations that end
the active session only run if `no_brene_brown_critical_since = "P30D"`
(i.e. at least 30 days of consecutive clean-monthly reviews). Cleanup
operations that would end-session in `<P30D` state require orchestrator
review. This gate is enforced at the orchestrator level, not by the
reviewer. The reviewer emits the field; the orchestrator reads it.

The complement field `no_brene_brown_critical` (boolean) fires whenever
this specific run returns zero criticals. The two fields together are
the non-regression evidence stream.

## Additive only

This spec is additive only. The non-negotiable constraint is:

- The existing `monthly_adversarial_llm_review.py` file
  (`corpus/corpus-generator/pixelated_empathy/monthly_adversarial_llm_review.py`)
  MUST remain byte-identical pre/post v3 implementation. The SHA-256 of
  the existing file MUST equal its pre-implementation SHA-256 after this
  feature lands. This is enforced at the orchestrator level via
  `sha256sum`. Drift is a non-regression violation.
- The existing 3-persona CLI subcommand (`corpus llm-review 2026-06`)
  MUST continue to work and return the same shape.
- The existing `AdversarialLLMReviewReport` Pydantic schema MUST NOT be
  modified. The new summary document is a separate class
  (`BreneBrownAdversarialReport`) that lives in the new
  `brene_brown_monthly_adversarial_review.py` file.
- The reviewer does not modify any email, chat, or persona descriptor
  content. It is a read-only auditor.
- The existing `monthly_adversarial_review.py` (rule-based) is also
  untouched.

The "additive only" constraint is what allows the v3 promotion to ship
in the same wave-flow cycle as Wave 31 fold-in; the two are not zero-sum.
Wave 31 addresses the 5 body-fixable Brené Brown criticals that v1
surfaced; this spec establishes the steady-state review cadence that
prevents the next cycle from being equivalent to Wave 31's work again.
