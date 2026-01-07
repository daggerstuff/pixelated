# Phase 1: Therapeutic Data Pipeline Workflow

## Overview

The therapeutic data pipeline is the foundation for Phase 1. It provides:

- **Dataset Loading**: Ingest therapeutic conversations from multiple sources (JSON, CSV, parquet)
- **Validation**: Ensure conversations meet quality standards (non-empty, multi-turn, valid metadata)
- **Normalization**: Standardize formats across diverse conversation datasets
- **Enrichment**: Add emotion scores, therapeutic technique labels, cultural context
- **Deduplication**: Remove semantic duplicates using sentence transformers
- **Balancing**: Ensure equitable representation across therapeutic techniques, demographics, conditions
- **Splitting**: Create train/eval/test sets with stratification
- **Export**: Output for model training and evaluation

## Data Directory Structure

```
data/therapeutic/
├── raw/                      # Original source data (JSON, CSV)
├── processed/               # Cleaned and validated conversations
├── synthetic/               # NeMo-generated synthetic data
└── metadata/                # Session metadata, embeddings, quality scores
```

## Data Schema

### ConversationTurn
```python
{
    "speaker": "therapist" | "patient",
    "text": str,
    "timestamp": float (optional),
    "emotion_score": 0.0-1.0 (optional),
    "detected_technique": "CBT" | "DBT" | "MI" | ... (optional)
}
```

### TherapeuticConversation
```python
{
    "session_id": str (unique identifier),
    "turns": [ConversationTurn],
    "technique": "CBT" | "DBT" | "MI" | "ACT" | "Psychodynamic" | "Humanistic" | "Trauma-Focused",
    "cultural_context": str (optional, e.g., "South Asian", "African American"),
    "mental_health_focus": str (e.g., "anxiety", "depression", "PTSD", "grief"),
    "quality_score": 0.0-1.0 (after evaluation),
    "metadata": dict
}
```

## Workflow Steps

### 1. Load Raw Data
```python
from ai.foundation.therapeutic_data_pipeline import TherapeuticDataPipeline

pipeline = TherapeuticDataPipeline()
pipeline.initialize()
pipeline.load_conversations(Path("data/therapeutic/raw/dataset.json"))
```

### 2. Validate Conversations
```python
# Automatic validation during load
# Invalid conversations are logged and excluded
validated_count = len(pipeline.conversations)
```

### 3. Deduplicate
```python
# Remove semantic duplicates using sentence-transformers
removed_count = pipeline.deduplicate()
```

### 4. Enrich Metadata
- Run emotion detection on patient utterances
- Classify therapeutic techniques (via fine-tuned classifier)
- Extract mental health focus areas
- Tag cultural context

### 5. Balance Dataset
```python
# Ensure fair representation across techniques
distribution = pipeline.balance_by_technique()
# {
#   "Cognitive Behavioral Therapy": 245,
#   "Dialectical Behavior Therapy": 198,
#   "Motivational Interviewing": 187,
#   ...
# }
```

### 6. Create Train/Eval/Test Split
- **Train**: 70% of data
- **Evaluation**: 15% of data
- **Test**: 15% of data
- Stratified by therapeutic technique, condition, cultural context

### 7. Export
```python
# DataFrame for analysis
df = pipeline.export_to_dataframe()
df.to_parquet("data/therapeutic/processed/conversations.parquet")

# JSONL for model training
for conv in pipeline.conversations:
    print(json.dumps(conv.to_dict()), file=output_file)
```

## Quality Metrics

### Conversation-Level Quality
- **Minimum turn count**: 2 (therapist-patient exchange)
- **Maximum turn count**: 100 (reasonable session length)
- **Empty text detection**: All turns must have non-empty text
- **Semantic validity**: Checked via embeddings

### Dataset-Level Balance
- **Technique distribution**: No single technique > 40% of dataset
- **Condition representation**: All major mental health conditions covered
- **Cultural diversity**: Minimum 20% representation across primary cultures
- **Turn-level emotion**: 80%+ of patient turns have emotion scores

## Current Status

### Phase 1 Checkpoint
- ✅ Pipeline module created and tested
- ✅ Data directory structure initialized
- ✅ Core data classes (ConversationTurn, TherapeuticConversation)
- ⏳ Load raw datasets from external sources
- ⏳ Implement emotion detection (using transformers)
- ⏳ Implement technique classification
- ⏳ Implement deduplication (using FAISS)
- ⏳ Export and splitting logic

## Integration Points

### Phase 2: Model Development
- Training datasets prepared by this pipeline feed into fine-tuning
- Validation data used for quality metrics during training

### Phase 3: Integration
- Real-time conversation analysis uses same schema
- Bias detection validates against pipeline's balanced representation

### Phase 4-5: Deployment
- Production models served with monitoring aligned to pipeline metrics

## Development Commands

```bash
# Initialize pipeline
uv run python -c "from ai.foundation.therapeutic_data_pipeline import TherapeuticDataPipeline; p = TherapeuticDataPipeline(); p.initialize(); print(p.status())"

# Run tests
uv run pytest tests/test_foundation_phase1.py::TestTherapeuticDataPipeline -v

# Generate status
uv run python ai/scripts/phase1_bootstrap.py
```

## Next Actions

1. **Load Sample Data**: Ingest public therapeutic conversation datasets
2. **Implement Emotion Detection**: Fine-tune emotion classifier on therapeutic language
3. **Implement Technique Classification**: Train classifier on CBT/DBT/MI/ACT patterns
4. **Deduplication**: Set up FAISS for semantic duplicate removal
5. **Validation Suite**: Comprehensive quality checks and reporting
