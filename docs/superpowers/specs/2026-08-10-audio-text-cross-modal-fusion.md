---
name: audio-text-cross-modal-fusion-2026-08-10
spec_version: '1.0'
project: Pixelated Empathy
scope:
  audio (prosody, pitch, speech energy) + transcript sentiment + video AU fusion
  for deception/clinical hurt detection
style: compressed (AR-1)
last_verified: 2026-08-10
---

# Audio + Text Cross-Modal Fusion Spec (2026-08-10)

## 1. Goal

Fuse audio signal, transcript sentiment, and video AU stream into single
deception/hurt score. Complements video-only pipeline (spec
2026-08-10-video-emotion-design.md §4-5). Enables cross-modal misalignment
detection (calm face + stressed voice = deception; sad face + neutral text =
clinical hurt).

## 2. Input Streams

- Video: `list[AUFrame]` (from pipeline spec §2) — AU scores at 30fps, 500ms
  windows.
- Audio: WAV mono, 16kHz, extracted from same video. Features: pitch (F0
  mean/std), speech rate (syllables/sec), energy (RMS), voice quality (jitter,
  shimmer, HNR). Window: 500ms sliding (aligned with video windows).
- Text: transcript (from speech-to-text: Whisper, WhisperX, or commercial API).
  Sentiment: BERT-based sentiment classifier (positive/neutral/negative) +
  emotional intensity score (0-1). Window: per-utterance or 500ms chunked.

## 3. Fusion Architecture

Single fusion vector per 500ms window:

- Video embedding: `AUFrame.au_scores` normalized (17 AUs) → 17-dim vector.
- Audio embedding: pitch_mean, pitch_std, energy_rms, rate_syl, jitter, shimmer,
  hnr → 7-dim vector.
- Text embedding: sentiment_score (float -1 to 1), intensity (float 0-1),
  utterance_length → 3-dim vector.
- Combined: 27-dim vector per window. Deception score = weighted ensemble (video
  0.4, audio 0.3, text 0.3) — weights tunable via clinical validation; initial
  weights from literature (Ekman + prosody deception studies).

Cross-modal misalignment metric: cosine distance between video sentiment
(derived from AU: AU12+AU6 positive, AU4+AU15 negative) and audio sentiment
(energy/pitch stress) and text sentiment. High divergence (>0.6 cosine distance)
= potential deception/manipulation signal.

## 4. Deception / Hurt Signals (Multimodal)

- Deception: high AU12 (forced smile) + low AU6 (no genuine joy) +
  neutral/positive text + low audio stress = social masking. Or high AU4/AU15
  (sad) + positive text + calm audio = clinical suppression/hurt.
- Manipulation: rapid AU onset (<500ms) with sustained audio/text mismatch;
  repeated cycles indicate deliberate emotional control.
- Clinical hurt: sustained AU4/AU15 + low speech energy + negative/suppressed
  transcript sentiment + reduced eye-gaze (AU tracking) across multiple windows.

Improvement path: fine-tune fusion weights on clinical video + audio +
transcript corpus (after synthetic/de-identified dataset built — spec 3). Add
attention mechanism over windows (LSTM/Transformer) to capture temporal
misalignment patterns over 5-30s sequences.

## 5. Scale / Deployment

- Prototype: batch processing (Python pipeline: OpenCV video → librosa audio →
  Whisper text → BERT sentiment → fusion). No real-time requirement for
  prototype.
- Real-time: streaming audio + video frames → 500ms buffer → fusion score →
  clinical alert. Latency target <2s (per spec §5). GPU (NVIDIA T4/A10) for
  BERT + Whisper; CPU for AU + audio features sufficient for prototype.
- Integration point: feeds into `deception_layer.py` (video-only pipeline spec
  Task 5) as cross-modal enrichment step. Audit writer consumes enriched score.

## 6. Risks / Constraints

- Speech-to-text error: mis-transcription corrupts sentiment; requires
  confidence threshold (<0.7) → flag for manual review.
- Audio quality: background noise, microphone distance affect pitch/energy;
  noise reduction (spectral subtraction, RNNoise) required.
- Text sentiment bias: BERT sentiment may miss clinical emotional nuance
  (suppressed sadness); clinical reviewer must validate fusion weights.
- Cost: Whisper/WhisperX local (free); BERT (HuggingFace, free); commercial STT
  (AWS Transcribe) = $0.0004/sec — not needed for prototype.
- Privacy: transcript contains sensitive clinical content; audit writer must
  exclude transcript text (store only sentiment score + intensity, not raw
  text). See spec 3 (HIPAA audit chain).

## 7. Implementation (Brief)

- Audio feature extraction: `librosa` (pitch: `pyin`, energy: `rms`, rate:
  syllable counting via `librosa.feature` or VAD-based).
- Text sentiment: `transformers` (BERT-based sentiment model, pre-trained
  `text-classification`).
- Fusion module: NumPy / PyTorch (27-dim vector, ensemble scoring, cosine
  divergence).
- Integration with video pipeline: add `audio_extractor.py`,
  `text_extractor.py`, `fusion_layer.py` to `src/video_emotion/`.
- Audit: store sentiment score + intensity only; discard transcript after
  extraction (memory cleanup). Log fusion weights + divergence metric.
