# Pixel Voice Pipeline: Production Documentation

## Overview

This document describes the end-to-end Pixel Voice data pipeline, covering all modules, data contracts, ML models, and validation datasets. The pipeline is fully automated, production-grade, and designed for robust, reproducible voice data processing and therapeutic dialogue generation.

---

## Pipeline Architecture

**Stages:**
1. Audio Quality Control & Segmentation
2. Batch Transcription (WhisperX)
3. Transcription Quality Filtering
4. Feature Extraction (Emotion, Sentiment, etc.)
5. Personality & Emotion Clustering, Drift Detection
6. Dialogue Pair Construction
7. ML-based Validation (Empathy, Appropriateness, Naturalness)
8. Therapeutic Pair Generation
9. Voice Quality & Consistency Assessment
10. Advanced Data Filtering & Optimization
11. Reporting & Dashboarding

**Orchestration:**  
All stages can be run sequentially via [`pixel_voice/run_full_pipeline.py`](pixel_voice/run_full_pipeline.py).

---

## Module Documentation

### [`pixel_voice/audio_quality_control.py`](pixel_voice/audio_quality_control.py)
- **Purpose:** Assess audio SNR, loudness, silence, clipping, language; segment with VAD.
- **Inputs:** WAV files in `data/voice_raw/`
- **Outputs:** Metrics JSON in `data/voice_metrics/`, segments in `data/voice_segments/`
- **Logging:** `logs/audio_quality_control.log`

### [`pixel_voice/batch_transcribe.py`](pixel_voice/batch_transcribe.py)
- **Purpose:** Batch transcribe audio with WhisperX, diarization, speaker labels.
- **Inputs:** Segments from `data/voice_segments/`
- **Outputs:** Transcripts in `data/voice_transcripts/`
- **Logging:** `logs/batch_transcribe.log`

### [`pixel_voice/transcription_quality_filter.py`](pixel_voice/transcription_quality_filter.py)
- **Purpose:** Filter transcript segments by confidence, language, and quality.
- **Inputs:** Transcripts from `data/voice_transcripts/`
- **Outputs:** Filtered transcripts in `data/voice_transcripts_filtered/`
- **Logging:** `logs/transcription_quality_filter.log`

### [`pixel_voice/feature_extraction.py`](pixel_voice/feature_extraction.py)
- **Purpose:** Extract emotion, sentiment, and text features from transcripts.
- **Inputs:** Filtered transcripts
- **Outputs:** Features JSON in `data/voice_features/`
- **Logging:** `logs/feature_extraction.log`

### [`pixel_voice/personality_emotion_clustering.py`](pixel_voice/personality_emotion_clustering.py)
- **Purpose:** Cluster segments by emotion/personality, detect drift/outliers.
- **Inputs:** Features JSON
- **Outputs:** Clusters JSON in `data/voice_clusters/`
- **Logging:** `logs/personality_emotion_clustering.log`

### [`pixel_voice/dialogue_pair_constructor.py`](pixel_voice/dialogue_pair_constructor.py)
- **Purpose:** Construct dialogue pairs with metadata.
- **Inputs:** Clustered segments
- **Outputs:** Pairs JSON in `data/dialogue_pairs/`
- **Logging:** `logs/dialogue_pair_constructor.log`

### [`pixel_voice/dialogue_pair_validation.py`](pixel_voice/dialogue_pair_validation.py)
- **Purpose:** Validate pairs for empathy, toxicity, appropriateness, naturalness.
- **Inputs:** Dialogue pairs
- **Outputs:** Validated pairs JSON in `data/dialogue_pairs/`
- **Logging:** `logs/dialogue_pair_validation.log`

### [`pixel_voice/generate_therapeutic_pairs.py`](pixel_voice/generate_therapeutic_pairs.py)
- **Purpose:** Select therapeutic pairs with clinical and empathy validation.
- **Inputs:** Validated pairs
- **Outputs:** Therapeutic pairs JSON in `data/therapeutic_pairs/`
- **Logging:** `logs/generate_therapeutic_pairs.log`

### [`pixel_voice/voice_quality_consistency.py`](pixel_voice/voice_quality_consistency.py)
- **Purpose:** Assess voice quality and consistency with multi-metric scoring.
- **Inputs:** Quality metrics, features
- **Outputs:** Consistency JSON in `data/voice_consistency/`
- **Logging:** `logs/voice_quality_consistency.log`

### [`pixel_voice/voice_data_filtering.py`](pixel_voice/voice_data_filtering.py)
- **Purpose:** Advanced filtering, selection, and optimization of voice data.
- **Inputs:** Consistency, therapeutic pairs
- **Outputs:** Optimized dataset JSON in `data/voice_optimized/`
- **Logging:** `logs/voice_data_filtering.log`

### [`pixel_voice/pipeline_reporting.py`](pixel_voice/pipeline_reporting.py)
- **Purpose:** Aggregate metrics, errors, and generate reports for all stages.
- **Outputs:** Reports in `reports/`
- **Logging:** `logs/pipeline_reporting.log`

### [`pixel_voice/run_full_pipeline.py`](pixel_voice/run_full_pipeline.py)
- **Purpose:** Orchestrate all pipeline stages, log status/errors.
- **Logging:** `logs/run_full_pipeline.log`

---

## Data Contracts

### Audio Quality Metrics (`data/voice_metrics/*.json`)
```json
{
  "file": "data/voice_raw/example.wav",
  "snr": 22.5,
  "loudness_db": -18.2,
  "silence_ratio": 0.12,
  "language": "en",
  "num_segments": 3,
  "segments": ["data/voice_segments/example_seg_0_1000.wav", ...]
}
```

### Transcript Features (`data/voice_features/*.json`)
```json
[
  {
    "start": 0.0,
    "end": 2.5,
    "text": "Hello, how are you?",
    "length": 18,
    "num_words": 4,
    "avg_word_length": 4.5,
    "emotion": [{"label": "joy", "score": 0.92}, ...],
    "sentiment": [{"label": "POSITIVE", "score": 0.98}]
  }
]
```

### Clustered Segments (`data/voice_clusters/personality_emotion_clusters.json`)
```json
[
  {
    "file": "example",
    "start": 0.0,
    "end": 2.5,
    "text": "Hello, how are you?",
    "cluster": 2,
    "outlier": 0,
    "emotion_joy": 0.92,
    "sentiment_label": "POSITIVE"
  }
]
```

### Dialogue Pairs (`data/dialogue_pairs/dialogue_pairs.json`)
```json
[
  {
    "file": "example",
    "turn_1": { ... },
    "turn_2": { ... },
    "pair_metadata": { ... }
  }
]
```

### Validated Pairs (`data/dialogue_pairs/dialogue_pairs_validated.json`)
```json
[
  {
    "file": "example",
    "turn_1": { ... },
    "turn_2": { ... },
    "pair_metadata": { ... },
    "validation": {
      "empathy_turn_1": [{"label": "empathic", "score": 0.85}],
      "toxicity_turn_1": [{"label": "non-toxic", "score": 0.01}]
    }
  }
]
```

### Therapeutic Pairs (`data/therapeutic_pairs/therapeutic_pairs.json`)
- Same schema as validated pairs, filtered for clinical/empathy criteria.

### Voice Consistency (`data/voice_consistency/voice_quality_consistency.json`)
```json
[
  {
    "file": "example.wav",
    "snr": 0.75,
    "loudness": 0.85,
    "silence": 0.90,
    "clipping": 1.0,
    "language": 1.0,
    "emotion_stability": 0.95,
    "composite_score": 0.89
  }
]
```

### Optimized Dataset (`data/voice_optimized/voice_optimized_dataset.json`)
- Subset of therapeutic pairs, optimized for quality, empathy, and diversity.

---

## ML Models

- **WhisperX**: Open-source ASR with diarization and speaker labels.
- **Emotion Classifier**: `j-hartmann/emotion-english-distilroberta-base`
- **Sentiment Classifier**: `distilbert-base-uncased-finetuned-sst-2-english`
- **Empathy Classifier**: `mrm8488/t5-base-finetuned-empathy`
- **Toxicity Classifier**: `unitary/toxic-bert`
- **Clustering**: KMeans, DBSCAN (scikit-learn)
- **Outlier Detection**: IsolationForest (scikit-learn)

---

## Validation Datasets

- **Empathy/Appropriateness**: Validated using open-source and custom datasets for empathy, toxicity, and conversational appropriateness.
- **Therapeutic Criteria**: Clinical review and automated scoring.

---

## Testing & CI/CD

- Automated tests in `tests/` (pytest).
- Example: [`tests/test_audio_quality_control.py`](tests/test_audio_quality_control.py), [`tests/test_feature_extraction.py`](tests/test_feature_extraction.py)
- CI/CD integration recommended via GitHub Actions or similar.

---

## Logging & Error Handling

- All modules log to `logs/` with structured, timestamped entries.
- Errors are logged and surfaced in reporting.

---

## Reproducibility

- All stages are fully automated and can be run via [`pixel_voice/run_full_pipeline.py`](pixel_voice/run_full_pipeline.py).
- Environment setup via `uv`/`uvx` and `requirements/pixel_voice_pipeline.txt`.

---
