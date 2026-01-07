# Phase 2: Model Development — Practical Implementation Guide

## Status

**Current**: Foundation modules complete; emotion recognition and bias detection baseline working.

**Completed**:
- ✅ `ai/foundation/emotion_recognition.py` — Valence/arousal detection, crisis signals
- ✅ `ai/foundation/bias_detection.py` — Gender/racial/cultural bias scoring
- ✅ `ai/foundation/therapeutic_data_pipeline.py` — Conversation data structures and validation
- ✅ `ai/foundation/dev_environment.py` — PyTorch/CUDA validation
- ✅ `ai/foundation/nemo_orchestration.py` — NeMo microservices orchestration
- ✅ Bootstrap script and Phase 1 tests (11/11 passing)

**Next Steps** (Weeks 3–6):

## Task 1: Transformer-Based Emotion Classifier

Create a fine-tuned emotion classifier on therapeutic dialogue data.

### Files to Create

**`ai/models/emotion_classifier.py`**
```python
# HuggingFace transformer-based emotion classifier
# Fine-tune DistilBERT on therapeutic emotion dataset
# Input: therapist/patient utterance
# Output: valence (0-1), arousal (0-1), primary emotion class
```

**`ai/models/training/emotion_classifier_train.py`**
```python
# Training script using HuggingFace Trainer
# Dataset: therapeutic conversations with emotion labels
# Metrics: F1, accuracy, calibration
```

### Implementation Checklist
- [ ] Load therapeutic conversations with emotion ground truth
- [ ] Create HuggingFace dataset from therapeutic_data_pipeline
- [ ] Fine-tune DistilBERT-base-uncased on emotion classification
- [ ] Validate on held-out test set
- [ ] Export to ONNX for inference efficiency
- [ ] Integrate with EmotionRecognizer baseline for comparison

### Development Commands
```bash
# Prepare training data
uv run python -m ai.models.training.emotion_classifier_train \
  --data-path data/therapeutic/processed/ \
  --output-dir checkpoints/emotion-classifier

# Evaluate
uv run python -m ai.models.evaluation.emotion_classifier_eval \
  --checkpoint checkpoints/emotion-classifier \
  --test-data data/therapeutic/test/
```

---

## Task 2: Bias Detection Classifier

Upgrade BiasDetector from pattern-based to transformer-based.

### Files to Create

**`ai/models/bias_classifier.py`**
```python
# Multi-task transformer for bias detection
# Tasks:
#   - Gender bias (binary: biased/not biased)
#   - Racial bias (multi-class: which group overrepresented)
#   - Cultural bias (multi-class: which culture underrepresented)
# Outputs fairness metrics (demographic parity, equalized odds)
```

**`ai/models/training/bias_classifier_train.py`**
```python
# Train on synthetic biased/unbiased conversation pairs
# Generate training data: augment conversations to introduce/remove bias
```

### Implementation Checklist
- [ ] Create synthetic biased conversation dataset (augment existing data)
- [ ] Label conversations for gender/racial/cultural bias
- [ ] Fine-tune RoBERTa-large for multi-task bias detection
- [ ] Validate fairness metrics on held-out test set
- [ ] Create bias adversarial examples for robustness testing
- [ ] Integrate with BiasDetector for comparison

### Development Commands
```bash
# Generate synthetic biased data
uv run python -m ai.models.data.generate_biased_conversations \
  --base-dataset data/therapeutic/processed/ \
  --output data/therapeutic/synthetic/biased

# Train
uv run python -m ai.models.training.bias_classifier_train \
  --biased-data data/therapeutic/synthetic/biased \
  --output-dir checkpoints/bias-classifier
```

---

## Task 3: Conversation Quality Evaluator

Create metrics for assessing therapeutic conversation quality.

### Quality Dimensions

1. **Therapeutic Effectiveness**
   - Therapist alignment with therapeutic technique
   - Patient engagement/response quality
   - Progress toward therapeutic goals

2. **Safety**
   - Appropriate crisis response
   - Validation and empathy
   - No harmful advice

3. **Cultural Competency**
   - Culturally sensitive language
   - Acknowledgment of cultural context
   - Appropriate case formulation

4. **Coherence**
   - Logical flow and topic continuity
   - Turn-taking appropriateness
   - Length/depth balance

### Files to Create

**`ai/models/conversation_evaluator.py`**
```python
# Multi-metric conversation quality assessment
# Returns: effectiveness_score, safety_score, cultural_score, coherence_score
# Each 0-1
```

**`ai/evals/conversation_eval_metrics.py`**
```python
# Metric implementations for evaluation
# BLEU, ROUGE, BERTScore for baseline
# Custom therapeutic-specific metrics
```

### Implementation Checklist
- [ ] Define quality scoring rubric (expert-validated)
- [ ] Collect human annotations of conversation quality
- [ ] Fine-tune regression model to predict quality scores
- [ ] Validate inter-rater reliability
- [ ] Create eval dataset with diverse examples
- [ ] Integrate into training loop as auxiliary loss

### Development Commands
```bash
# Evaluate conversations
uv run python -m ai.models.evaluation.evaluate_conversation_quality \
  --conversations data/therapeutic/test/ \
  --output reports/quality_metrics.json

# Generate quality report
uv run python -m ai.evals.generate_quality_report \
  --metrics reports/quality_metrics.json
```

---

## Task 4: Integrate Models into Data Pipeline

Connect trained models to therapeutic_data_pipeline for automatic enrichment.

### Files to Create

**`ai/foundation/data_enrichment.py`**
```python
# Pipeline extension to enrich conversations with:
# - Emotion scores (valence/arousal, primary emotion)
# - Crisis risk flags
# - Bias measurements
# - Quality metrics
# - Therapeutic technique classification
```

### Implementation Checklist
- [ ] Load trained emotion classifier
- [ ] Load trained bias detector
- [ ] Create batch enrichment pipeline
- [ ] Enrich all conversations in therapeutic dataset
- [ ] Save enriched conversations to processed/
- [ ] Generate enrichment statistics report
- [ ] Create monitoring for enrichment quality

### Development Commands
```bash
# Enrich dataset
uv run python -m ai.foundation.data_enrichment \
  --input data/therapeutic/raw/ \
  --models-dir checkpoints/ \
  --output data/therapeutic/processed/

# Generate enrichment report
uv run python -m ai.foundation.data_enrichment_report \
  --enriched-data data/therapeutic/processed/
```

---

## Testing Strategy

### Unit Tests
```python
# tests/test_emotion_classifier.py
# tests/test_bias_classifier.py
# tests/test_conversation_evaluator.py
```

### Integration Tests
```python
# tests/test_data_enrichment.py
# Verify pipeline produces valid enriched conversations
```

### Validation Tests
```python
# tests/test_model_performance.py
# F1/accuracy on held-out sets
# Fairness metrics validation
```

### Development Commands
```bash
# Run all Phase 2 tests
uv run pytest tests/test_emotion_classifier.py \
               tests/test_bias_classifier.py \
               tests/test_conversation_evaluator.py \
               -v --cov=ai.models

# Check coverage
uv run pytest --cov=ai.models --cov-report=html
```

---

## Timeline & Milestones

**Week 3**: Task 1 (Emotion Classifier)
- Prepare dataset, start training
- Target: Baseline model with >85% F1

**Week 4**: Task 2 (Bias Classifier)
- Synthetic data generation, model training
- Target: Multi-task model ready for integration

**Week 5**: Task 3 (Quality Evaluator)
- Collect human annotations, train regression
- Target: Validated quality metrics

**Week 6**: Task 4 (Pipeline Integration)
- Enrich full dataset
- Final Phase 2 validation
- Target: Ready for Phase 3 (Integration)

---

## Success Criteria

✅ **Emotion Recognition**: >85% F1 on therapeutic dialogue test set, crisis signals detected with >80% recall

✅ **Bias Detection**: Fairness metrics (demographic parity, equalized odds) tracked and measured

✅ **Quality Evaluation**: Human-validated quality scores correlated with automatic metrics (r > 0.7)

✅ **Data Pipeline**: All conversations enriched with emotion, bias, quality metadata; ready for training

---

## Resource Requirements

- **Compute**: GPU for fine-tuning (single GPU ~2-4 hrs per model)
- **Data**: Therapeutic conversations with ground-truth emotion, bias, quality labels
- **Libraries**: transformers, datasets, scikit-learn, torch, wandb (for experiment tracking)
- **Team**: ML engineer (primary), NLP specialist (optional), domain expert for validation
