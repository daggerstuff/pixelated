---
name: synthetic-clinical-dataset-design-2026-08-10
spec_version: '1.0'
project: Pixelated Empathy
scope:
  synthetic/de-identified clinical video emotion dataset for prototype
  training/research
style: compressed (AR-1)
last_verified: 2026-08-10
---

# Synthetic Clinical Dataset Design Spec (2026-08-10)

## 1. Goal

Build synthetic/de-identified clinical video emotion dataset supporting
prototype pipeline (spec 2026-08-10-video-emotion-design.md). Zero real patient
data in initial version (HIPAA gate). Enables AU + deception + hurt model
training/research without consent/de-identification barriers.

## 2. Data Sources (Synthetic / De-identified)

- Synthetic generation: render 3D avatars (FaceGen, MetaHuman, Face2Face) with
  controlled AU combinations (AU4+AU15 hurt; AU12+AU6- forced smile;
  AU1+AU4+AU15 sadness). Generate 10K clips (5-30s each) across emotional
  categories.
- De-identified real data (future, not initial): clinical video recordings with
  face blur, audio pitch-shift, transcript anonymization (names → [PERSON],
  dates → [DATE], locations → [LOCATION]). Consent + IRB approval required
  before any inclusion.
- Augmentation: temporal jitter, lighting variation, head pose rotation,
  synthetic microexpression insertion (<500ms peaks).

## 3. Label Schema (Aligned with Pipeline)

Labels match `EmotionEvent` (spec §2): `start_ms`, `end_ms`, `au_combo`,
`deception_flag`, `score`. Additional fields for dataset: `subject_id`
(synthetic UUID, no linkage), `age_group` (adult/child/elderly),
`culture_category` (Western/Eastern/Mixed), `clinical_condition`
(depression/anxiety/PTSD/none — synthetic tags only).

No PII fields. `subject_id` synthetic UUID generated at render time; no mapping
to real identity.

## 4. Dataset Structure

```
data/clinical_synthetic/
  videos/          (mp4, 30fps, 640x480, synthetic avatars)
  annotations/     (json per video: list[EmotionEvent] + metadata)
  splits/          (train/test/validation — random split by subject_id, not by frame)
  provenance.md   (generation script, random seeds, avatar IDs, no real data claim)
```

Split strategy: split by synthetic `subject_id` (not by frame) to prevent
temporal leakage. 70/15/15 train/test/val.

## 5. De-identification Protocol (For Future Real Data — Not Initial)

- Video: face blur (Gaussian 50px) + background replacement; no face pixels
  retained in dataset.
- Audio: pitch shift (+/- 2 semitones), speed change (0.9-1.1x) to break speaker
  identification; transcript anonymized.
- Metadata: all dates → [DATE], locations → [LOCATION], provider names →
  [PROVIDER].
- Audit: log every de-identified file with original hash (pre-blur) and
  processed hash (post-blur) for chain-of-custody.

Initial prototype uses synthetic only — no real data, no de-identification
needed.

## 6. Quality / Validation

- Visual inspection: 5% random sample reviewed for avatar realism, AU accuracy
  (manual AU coding comparison), temporal consistency.
- Statistical checks: AU score distributions per category; microexpression peak
  frequency; cross-subject variance.
- Clinical review: licensed clinician reviews synthetic labels (hurt/deception)
  for face validity — synthetic does not guarantee clinical validity.

## 7. Scale / Growth

- Initial: 10K clips (~85GB at 640x480, 30fps, 10s avg).
- Expansion: add avatar diversity (age, skin tone, head pose), clinical
  conditions, cross-modal audio (synthetic voice with emotional prosody).
- Storage: local disk for prototype; future AWS S3 + Glacier for archive
  (cost-efficient for startup — $0.023/GB/month standard, $0.004 cold).

## 8. Risks / Constraints

- Synthetic ≠ clinical reality: avatar expressions may not match real patient
  emotional dynamics; clinical reviewer required.
- Deception labels synthetic: no ground-truth for real deception; model trained
  on synthetic may overfit to avatar artifacts.
- HIPAA: any future real data requires de-identification + consent + audit
  chain; prototype must not mix synthetic and real without clear provenance
  tags.
- Cost: 3D avatar generation (MetaHuman, FaceGen) + rendering = GPU time;
  synthetic generation script runs batch, not interactive.

## 9. Implementation Tasks (Brief)

- Generate synthetic avatar library (FaceGen / MetaHuman) — 50 base subjects,
  diverse demographics.
- Render video clips with controlled AU sequences — 10K clips, 5-30s.
- Annotate with `EmotionEvent` format (start/end, AU combo, deception flag,
  score).
- Create train/test/val splits (by subject_id, not frame).
- Write `data/clinical_synthetic/provenance.md` (generation script, seeds,
  synthetic-only claim).
- Verify: grep dataset for PII (names, dates, real IDs) = zero hits.
