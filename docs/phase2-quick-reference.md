# Phase 2 Quick Reference — Commands & Usage

## 🚀 Get Started (5 minutes)

### 1. Environment Setup
```bash
cd /home/vivi/pixelated
uv install  # Install all dependencies
```

### 2. Run All Tests
```bash
uv run pytest tests/test_phase2_models.py -v
```

### 3. Quick Demo
```bash
# Train emotion classifier (synthetic data)
uv run python -m ai.models.training.emotion_classifier_train --num-epochs 1

# Evaluate
uv run python -m ai.models.evaluation.emotion_classifier_eval --checkpoint checkpoints/emotion-classifier
```

---

## 📦 Models Available

### EmotionClassifier
```python
from ai.models.emotion_classifier import TherapeuticEmotionClassifier, EmotionClassifierTrainer

model = TherapeuticEmotionClassifier()
trainer = EmotionClassifierTrainer(model, device='cuda')

# Single prediction
result = trainer.predict("I'm feeling anxious")
print(result)
# {
#   'valence': 0.25,
#   'arousal': 0.75,
#   'primary_emotion': 'anxiety',
#   'emotion_scores': {...}
# }

# Batch prediction
results = trainer.predict_batch([text1, text2, text3])
```

### BiasClassifier
```python
from ai.models.bias_classifier import BiasDetectionClassifier, BiasDetectionTrainer

model = BiasDetectionClassifier()
trainer = BiasDetectionTrainer(model, device='cuda')

result = trainer.predict("Women are better at caregiving than men")
print(result)
# {
#   'gender_bias': 'biased',
#   'gender_confidence': 0.92,
#   'racial_bias': 'no_bias',
#   'cultural_bias': 'no_bias',
#   'overall_bias_score': 0.35
# }
```

### ConversationQualityEvaluator
```python
from ai.models.conversation_evaluator import ConversationQualityModel, ConversationQualityInferencer

model = ConversationQualityModel()
inferencer = ConversationQualityInferencer(model, device='cuda')

scores = inferencer.evaluate("Great conversation text here...")
print(scores)
# {
#   'effectiveness': 0.82,
#   'safety': 0.95,
#   'cultural_competency': 0.78,
#   'coherence': 0.88
# }

overall = inferencer.compute_overall_score(scores)
print(f"Overall quality: {overall:.2f}")  # 0.86
```

### DataEnrichment (Full Pipeline)
```python
from ai.foundation.data_enrichment import ConversationEnricher

enricher = ConversationEnricher(
    emotion_model_path="checkpoints/emotion-classifier/best_model.pt",
    bias_model_path="checkpoints/bias-classifier/best_model.pt",
    quality_model_path="checkpoints/quality-evaluator/best_model.pt",
)

# Single conversation
enriched = enricher.enrich_conversation({
    "text": "I'm feeling anxious about my therapy progress...",
    "speaker": "patient"
})

# Batch processing
conversations = [{"text": "..."}, {"text": "..."}]
enriched_batch = enricher.enrich_batch(conversations)

# File-based
enricher.enrich_from_file(
    input_path="data/therapeutic/raw/conversations.json",
    output_path="data/therapeutic/enriched/conversations.json"
)
```

---

## 🏋️ Training Commands

### Emotion Classifier
```bash
# Basic training
uv run python -m ai.models.training.emotion_classifier_train

# Custom parameters
uv run python -m ai.models.training.emotion_classifier_train \
    --data-path data/therapeutic/processed/ \
    --output-dir checkpoints/emotion-classifier \
    --batch-size 32 \
    --num-epochs 5 \
    --learning-rate 1e-5 \
    --device cuda
```

### Bias Classifier
```bash
# With synthetic data generation
uv run python -m ai.models.training.bias_classifier_train \
    --output-dir checkpoints/bias-classifier \
    --batch-size 16 \
    --num-epochs 3 \
    --device cuda

# With custom data
uv run python -m ai.models.training.bias_classifier_train \
    --biased-data data/therapeutic/synthetic/biased/ \
    --output-dir checkpoints/bias-classifier
```

---

## 📊 Evaluation Commands

### Emotion Classifier Evaluation
```bash
uv run python -m ai.models.evaluation.emotion_classifier_eval \
    --checkpoint checkpoints/emotion-classifier \
    --test-data data/therapeutic/test/ \
    --output reports/emotion_eval.json \
    --batch-size 32 \
    --device cuda
```

### View Results
```bash
cat reports/emotion_eval.json | python -m json.tool
```

---

## 🧪 Testing

### Run All Tests
```bash
uv run pytest tests/test_phase2_models.py -v
```

### Run Specific Test Class
```bash
# Emotion classifier tests
uv run pytest tests/test_phase2_models.py::TestEmotionClassifier -v

# Bias classifier tests
uv run pytest tests/test_phase2_models.py::TestBiasClassifier -v

# Quality evaluator tests
uv run pytest tests/test_phase2_models.py::TestConversationQualityEvaluator -v

# Data enrichment tests
uv run pytest tests/test_phase2_models.py::TestDataEnrichment -v
```

### Run Specific Test
```bash
uv run pytest tests/test_phase2_models.py::TestEmotionClassifier::test_forward_pass -v
```

### With Coverage
```bash
uv run pytest tests/test_phase2_models.py \
    --cov=ai.models \
    --cov=ai.foundation \
    --cov=ai.evals \
    --cov-report=html \
    --cov-report=term-missing
```

---

## 📁 File Locations

| Component | Files |
|-----------|-------|
| **Emotion Classifier** | `ai/models/emotion_classifier.py` |
| **Emotion Training** | `ai/models/training/emotion_classifier_train.py` |
| **Emotion Evaluation** | `ai/models/evaluation/emotion_classifier_eval.py` |
| **Bias Classifier** | `ai/models/bias_classifier.py` |
| **Bias Training** | `ai/models/training/bias_classifier_train.py` |
| **Quality Evaluator** | `ai/models/conversation_evaluator.py` |
| **Quality Metrics** | `ai/evals/conversation_eval_metrics.py` |
| **Data Enrichment** | `ai/foundation/data_enrichment.py` |
| **Tests** | `tests/test_phase2_models.py` |
| **Documentation** | `docs/phase2-implementation-summary.md` |
| **This Guide** | `docs/phase2-quick-reference.md` |

---

## 🔧 Troubleshooting

### GPU Not Available
```python
# Check GPU availability
import torch
print(torch.cuda.is_available())
print(torch.cuda.get_device_name(0))

# Force CPU
trainer = EmotionClassifierTrainer(model, device='cpu')
```

### Out of Memory
```bash
# Reduce batch size
--batch-size 8

# Use gradient accumulation in training loop
# (implement in trainer if needed)

# Use mixed precision (add to training)
# from torch.cuda.amp import autocast
```

### Missing Data
```bash
# Training uses synthetic data by default if real data missing
# Synthetic data automatically generated:
# - 100 examples for emotion classifier
# - 200 examples for bias classifier
```

### Import Errors
```bash
# Ensure you're in pixelated root
cd /home/vivi/pixelated

# Reinstall in dev mode
uv install -e .

# Or add to PYTHONPATH
export PYTHONPATH="/home/vivi/pixelated:$PYTHONPATH"
```

---

## 📈 Expected Performance

| Model | Task | Expected Performance | Notes |
|-------|------|---------------------|-------|
| Emotion Classifier | F1 Score | >85% | On held-out test |
| Emotion Classifier | Crisis Detection | >80% recall | High sensitivity priority |
| Bias Classifier | Accuracy | >75% | Multi-class task |
| Quality Evaluator | Correlation | r > 0.7 | vs. human rating |
| Data Enrichment | Latency | <50ms per conversation | With GPU |

---

## 🚀 Next Steps

1. **Load Real Data**: Replace synthetic data with actual therapeutic conversations
2. **Fine-tune Models**: Train on domain-specific data
3. **Validate Fairness**: Ensure bias metrics are balanced across demographics
4. **Monitor Performance**: Set up dashboards and alerts
5. **Deploy Models**: Integrate into production API

---

## 📚 References

- **Phase 2 Guide**: `docs/phase2-model-development-guide.md`
- **Full Implementation Summary**: `docs/phase2-implementation-summary.md`
- **Model Architecture**: Each module has detailed docstrings
- **Tests**: `tests/test_phase2_models.py` has usage examples

---

**Last Updated**: January 7, 2026  
**Status**: ✅ Phase 2 Complete
