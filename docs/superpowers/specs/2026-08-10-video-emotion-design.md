---
name: video-emotion-research-2026-08-10
spec_version: '1.0'
project: Pixelated Empathy
scope:
  clinical/therapeutic video emotion detection + deceit/manipulation/hurt
  detection
style: compressed (AR-1)
last_verified: 2026-08-10
---

# Video Emotion AI — Design Spec (2026-08-10)

## 1. Goal

Enable Pixelated clinical platform to detect emotional states,
deception/manipulation, and hurt via video input. Cover current model landscape,
improvement paths, scaling architecture.

## 2. Architecture (S1 approved)

- Ingestion: 30fps extraction, <500ms windows (microexpression), keyframe
  sampling
- Pipeline: open-source AU (OpenFace 2.0) + commercial vision APIs (GPT-5,
  Gemini 2.5 Pro, Claude 3.5 Sonnet)
- Deceit layer: temporal consistency (face vs audio sentiment vs transcript),
  AU-based forced expression, microexpression peaks
- Scale: fine-tune on clinical corpora, multimodal fusion, edge/GPU inference

## 3. Current State (S2 approved)

- GPT-5 vision: frame-level, sequential upload for video, no native AU, no
  sub-500ms temporal
- Gemini 2.5 Pro: native video (~1hr), temporal reasoning at scene-level, no AU
  scores
- Claude 3.5 Sonnet: vision + video input; text-aligned reasoning; weak
  microexpression resolution
- OpenFace 2.0: 17 AUs, head pose, eye-gaze; real-time CPU; no deception
- Datasets: FER-2013 (images, 7 basic), Aff-Wild2 (video, arousal/valence), zero
  clinical deception labels
- GAP: no commercial model exposes AU scores; deception requires temporal +
  cross-modal fusion unavailable in APIs

## 4. Deceit / Manipulation / Hurt Detection (core)

Methods:

- Microexpression: <500ms AU peaks (AU12 smile + absence AU6 = forced;
  AU1+AU4+AU15 = hurt/sad; rapid onset/offset = deception)
- Temporal misalignment: video emotion vs transcript sentiment divergence; audio
  pitch stress vs facial calm
- Adversarial expression: sustained AU without temporal decay; contradictory AU
  combos; eye-gaze avoidance during positive statements
- Clinical hurt signals: prolonged AU4 (brow lower) + AU15 (lip corner
  depressor) + reduced eye contact + low speech energy

Improvement paths:

- Fine-tune temporal CNN/LSTM on clinical video (needs labeled clinical dataset
  — HIPAA gate; synthetic or de-identified first)
- Cross-modal fusion embedding (vision + BERT transcript + audio spectrogram)
  into single deception-score vector
- Real-time pipeline: OpenFace AU stream → temporal filter (<500ms peaks) →
  fusion layer → alert threshold
- Scaling: batch processing for recorded sessions; streaming for live telehealth
  (GPU edge or cloud with <2s latency)

## 5. Scale / Detection Improvements

- Data: build clinical video emotion dataset (de-identified, consented); augment
  with synthetic deception scenarios
- Model: combine open-source AU (precision) with commercial vision (robustness);
  ensemble disagreement as deception signal
- Temporal: 30fps AU tracking + sliding 500ms window peak detector + 5-second
  trend for sustained misalignment
- Deployment: GPU container (NVIDIA T4/A10) for live inference; batch for
  retrospective analysis; audit trail for clinical governance

## 6. Risks / Constraints

- HIPAA/clincial: no raw patient video in training without de-identification +
  consent; audit all inference logs
- Deception false positives: forced-smile detection has high false positive in
  social masking; requires clinician-in-the-loop review
- Model drift: emotional expression varies across cultures, age, clinical
  conditions; dataset must be diverse or model biases
- Cost: commercial video APIs at 30fps = expensive; prefer open-source AU
  pipeline for live, commercial for periodic ground-truth

## 7. Next Step (post-approval)

Invoke `writing-plans` to generate implementation plan: dataset acquisition
(de-identified), OpenFace pipeline prototype, cross-modal fusion POC, clinical
audit design.
