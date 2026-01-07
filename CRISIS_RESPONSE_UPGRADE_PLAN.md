# Pixelated Empathy: Crisis Response Upgrade Plan

## Objectives
- Eliminate generic crisis replies; deliver empathetic, directive, safety-first responses across all products.
- Standardize language, escalation paths (911/988/741741), and involvement of trusted supports.
- Enforce bias-aware, HIPAA++ compliant handling with auditability and <50ms inference targets.

## Scope (apply everywhere)
- Data: all conversation corpora, synthetic generation scripts, annotation guides.
- Models: fine-tuning configs, safety/bias classifiers, prompt templates, LoRA/PEFT adapters.
- Inference: APIs, guardrails, fallback flows, UI rendering of crisis CTAs.
- Evaluation: automated metrics, human review, crisis drills; CI gates for safety quality.

## Response Standard (assistant messages)
- Tone: validating, specific to user disclosure, no minimization. Lead with empathy-first reflective listening (see EMPATHY_RESPONSE_STYLE.md).
- Safety: immediate risk check; offer to stay connected; provide 911 if imminent danger.
- Pathways: 988 call, 741741 text; invite trusted person; offer to stay while connecting.
- Boundaries: no clinical promises; no medical advice; never delay emergency direction.
- Logging: structured event with risk level, suggested action, bias audit tag; exclude PHI beyond minimum necessary.

## Data & Annotation Changes
- Update crisis examples to follow the standard (include staying-with-user, explicit emergency option, trusted support ask).
- Label schema: `risk_level` (none/low/moderate/high), `crisis_pathway` (911/988/741741/other), `support_invited` (bool), `bias_flags`.
- Add negative controls: generic/weak responses marked as `unacceptable` for contrastive loss.
- Augment with diverse demographics and contexts; run bias detection on prompts and responses.
- Require PHI scrubbing and FHE-ready transforms for sensitive fields.

## Model Training Updates
- Loss shaping: add penalty for missing crisis elements (risk check, pathway, support invite).
- Prompt/template: embed the Response Standard with slot filling for pathways; keep under 50ms budget via concise tokens.
- Safety/bias heads: train or refresh classifiers; attach thresholds for hard blocks and soft nudges.
- Eval set: curated crisis scenarios (ideation, plan, means, intent, third-party reporting) with expected responses.
- Logging: track safety_score, empathy_score, bias_score per batch; fail fast on regressions.

## Inference & Guardrails
- Pre-response scan: crisis classifier; if risk, generate empathy-first lead then append concise safety block.
- Post-response checks: safety/bias validators; reject/repair if missing empathy elements (reflection + presence + autonomy) or safety elements when risk detected.
- Deterministic minimum: always include 911/988/741741 and trusted-support invite when crisis detected.
- Audit trail: log decision path, classifier outputs, chosen template, and redactions (no raw PHI stored).
- Performance: keep latency <50ms; use caching/ONNX/quantized adapters where safe.

## Evaluation & QA
- Automated: safety_score >0.85, empathy_score >0.8, coherence >0.75; crisis detection recall >0.95 on holdout.
- Human review: weekly spot checks of high-risk conversations; red-team for prompt injection and bias.
- CI gates: block merges if crisis test fixtures or safety metrics regress; run `pnpm test` + `uv run pytest ai/models/test_phase2_development.py` equivalents in pipelines.
- Bias audits: fairlearn/AIF360 runs on crisis subset; publish deltas.

## Rollout Plan
- Phase 0 (Now): adopt this plan; update fixtures and templates; add eval scenarios to tests.
- Phase 1: refresh datasets/annotations; retrain safety/bias classifiers; integrate guardrail template in inference.
- Phase 2: fine-tune main model with new loss shaping; run full eval and bias audit; performance tune.
- Phase 3: canary deploy to limited traffic; monitor safety incidents, latency, and bias metrics; iterate.
- Phase 4: global enablement; enforce CI gates; schedule quarterly crisis drills and audits.

## Ownership & Next Steps
- Owners: Safety Lead, ML Lead, Compliance Lead (assign names in config).
- Immediate actions: (1) Update crisis samples/fixtures, (2) implement template in inference layer, (3) add CI safety gate.
- Tracking: log progress in `project_overview` memory and relevant epics; update this file as milestones complete.
