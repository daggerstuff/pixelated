"""
Comprehensive test suite for Phase 2 models.

Tests:
- Emotion classifier model architecture and predictions
- Bias classifier detection accuracy
- Conversation quality evaluator
- Data enrichment pipeline
"""

import sys
from pathlib import Path

import pytest
import torch

sys.path.insert(0, str(Path(__file__).parent.parent))

from ai.foundation.data_enrichment import (
    ConversationEnricher,
    generate_enrichment_statistics,
)
from ai.models.bias_classifier import (
    BiasDetectionClassifier,
    BiasDetectionTrainer,
)
from ai.models.conversation_evaluator import (
    ConversationQualityInferencer,
    ConversationQualityModel,
)
from ai.models.emotion_classifier import (
    EmotionClassifierTrainer,
    TherapeuticEmotionClassifier,
)


class TestEmotionClassifier:
    """Tests for emotion classifier."""

    @pytest.fixture
    def model(self):
        """Create emotion classifier model."""
        return TherapeuticEmotionClassifier()

    @pytest.fixture
    def trainer(self, model):
        """Create emotion classifier trainer."""
        device = "cuda" if torch.cuda.is_available() else "cpu"
        return EmotionClassifierTrainer(model, device=device)

    def test_model_initialization(self, model):
        """Test model initializes correctly."""
        assert model is not None
        assert len(model.EMOTION_CLASSES) == 10
        assert hasattr(model, "valence_head")
        assert hasattr(model, "arousal_head")
        assert hasattr(model, "emotion_head")

    def test_forward_pass(self, model):
        """Test forward pass produces correct outputs."""
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model.to(device)

        batch_size = 2
        seq_len = 128
        input_ids = torch.randint(0, 1000, (batch_size, seq_len)).to(device)
        attention_mask = torch.ones(batch_size, seq_len).to(device)

        valence, arousal, emotion_logits = model(input_ids, attention_mask)

        assert valence.shape == (batch_size, 1)
        assert arousal.shape == (batch_size, 1)
        assert emotion_logits.shape == (batch_size, 10)

        # Check output ranges
        assert (valence >= 0).all()
        assert (valence <= 1).all()
        assert (arousal >= 0).all()
        assert (arousal <= 1).all()

    def test_prediction(self, trainer):
        """Test single example prediction."""
        text = "I'm feeling really anxious about this situation."
        result = trainer.predict(text)

        assert "valence" in result
        assert "arousal" in result
        assert "primary_emotion" in result
        assert "emotion_scores" in result

        assert 0 <= result["valence"] <= 1
        assert 0 <= result["arousal"] <= 1
        assert result["primary_emotion"] in trainer.model.EMOTION_CLASSES

    def test_batch_prediction(self, trainer):
        """Test batch prediction."""
        texts = [
            "I feel happy and joyful!",
            "I'm so angry right now.",
            "I feel sad and empty.",
        ]

        results = trainer.predict_batch(texts)

        assert len(results) == 3
        assert all(isinstance(result, dict) for result in results)
        assert all("valence" in result for result in results)
        assert all("arousal" in result for result in results)


class TestBiasClassifier:
    """Tests for bias detection classifier."""

    @pytest.fixture
    def model(self):
        """Create bias classifier."""
        return BiasDetectionClassifier()

    @pytest.fixture
    def trainer(self, model):
        """Create bias trainer."""
        device = "cuda" if torch.cuda.is_available() else "cpu"
        return BiasDetectionTrainer(model, device=device)

    def test_model_initialization(self, model):
        """Test bias model initializes."""
        assert model is not None
        assert hasattr(model, "gender_head")
        assert hasattr(model, "racial_head")
        assert hasattr(model, "cultural_head")

    def test_forward_pass(self, model):
        """Test forward pass."""
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model.to(device)

        batch_size = 2
        seq_len = 128
        input_ids = torch.randint(0, 1000, (batch_size, seq_len)).to(device)
        attention_mask = torch.ones(batch_size, seq_len).to(device)

        gender, racial, cultural = model(input_ids, attention_mask)

        assert gender.shape[0] == batch_size
        assert racial.shape[0] == batch_size
        assert cultural.shape[0] == batch_size

    def test_bias_prediction(self, trainer):
        """Test bias prediction."""
        text = "Women are naturally better caregivers than men."
        result = trainer.predict(text)

        assert "gender_bias" in result
        assert "racial_bias" in result
        assert "cultural_bias" in result
        assert "overall_bias_score" in result

        assert 0 <= result["overall_bias_score"] <= 1


class TestConversationQualityEvaluator:
    """Tests for quality evaluator."""

    @pytest.fixture
    def model(self):
        """Create quality model."""
        return ConversationQualityModel()

    @pytest.fixture
    def inferencer(self, model):
        """Create quality inferencer."""
        device = "cuda" if torch.cuda.is_available() else "cpu"
        return ConversationQualityInferencer(model, device=device)

    def test_model_initialization(self, model):
        """Test quality model initializes."""
        assert model is not None
        assert hasattr(model, "effectiveness_head")
        assert hasattr(model, "safety_head")
        assert hasattr(model, "cultural_competency_head")
        assert hasattr(model, "coherence_head")

    def test_forward_pass(self, model):
        """Test forward pass."""
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model.to(device)

        batch_size = 2
        seq_len = 128
        input_ids = torch.randint(0, 1000, (batch_size, seq_len)).to(device)
        attention_mask = torch.ones(batch_size, seq_len).to(device)

        scores = model(input_ids, attention_mask)

        assert all(dim in scores for dim in model.QUALITY_DIMENSIONS)
        assert all(scores[dim].shape[0] == batch_size for dim in model.QUALITY_DIMENSIONS)

    def test_quality_evaluation(self, inferencer):
        """Test quality evaluation."""
        text = "You're facing a difficult situation, but I believe you have the strength to work through this."
        scores = inferencer.evaluate(text)

        assert "effectiveness" in scores
        assert "safety" in scores
        assert "cultural_competency" in scores
        assert "coherence" in scores

        assert all(0 <= scores[dim] <= 1 for dim in inferencer.model.QUALITY_DIMENSIONS)

    def test_batch_evaluation(self, inferencer):
        """Test batch evaluation."""
        conversations = [
            "Let's explore your feelings about this situation.",
            "I can see you're struggling with this.",
            "What do you think might help you feel better?",
        ]

        results = inferencer.evaluate_batch(conversations)

        assert len(results) == 3
        assert all(len(result) == len(inferencer.model.QUALITY_DIMENSIONS) for result in results)

    def test_overall_score_computation(self, inferencer):
        """Test overall score computation."""
        quality_dict = {
            "effectiveness": 0.8,
            "safety": 0.9,
            "cultural_competency": 0.7,
            "coherence": 0.85,
        }

        overall = inferencer.compute_overall_score(quality_dict)

        assert 0 <= overall <= 1
        assert overall == 0.8125  # Mean of the scores


class TestDataEnrichment:
    """Tests for data enrichment pipeline."""

    @pytest.fixture
    def enricher(self):
        """Create conversation enricher."""
        device = "cuda" if torch.cuda.is_available() else "cpu"
        return ConversationEnricher(device=device)

    def test_enricher_initialization(self, enricher):
        """Test enricher initializes."""
        assert enricher is not None
        assert enricher.emotion_trainer is not None
        assert enricher.bias_trainer is not None
        assert enricher.quality_inferencer is not None

    def test_single_conversation_enrichment(self, enricher):
        """Test enriching single conversation."""
        conversation = {
            "text": "I'm feeling anxious about my upcoming presentation.",
            "speaker": "patient",
        }

        enriched = enricher.enrich_conversation(conversation)

        assert enriched["text"] == conversation["text"]
        assert enriched.get("emotion_predictions") is not None
        assert enriched.get("bias_predictions") is not None
        assert enriched.get("quality_scores") is not None

    def test_batch_enrichment(self, enricher):
        """Test batch enrichment."""
        conversations = [
            {"text": "I feel happy today."},
            {"text": "I'm struggling with anxiety."},
            {"text": "Things are getting better."},
        ]

        enriched_batch = enricher.enrich_batch(conversations)

        assert len(enriched_batch) == 3
        assert all("emotion_predictions" in enriched for enriched in enriched_batch)
        assert all("bias_predictions" in enriched for enriched in enriched_batch)
        assert all("quality_scores" in enriched for enriched in enriched_batch)

    def test_enrichment_statistics(self, enricher):
        """Test enrichment statistics generation."""
        conversations = [
            {"text": "I feel happy and hopeful."},
            {"text": "I'm struggling with sadness."},
        ]

        enriched = enricher.enrich_batch(conversations)
        stats = generate_enrichment_statistics(enriched)

        assert "total_conversations" in stats
        assert stats["total_conversations"] == 2
        assert "emotion_predictions" in stats
        assert "bias_predictions" in stats
        assert "quality_scores" in stats


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
