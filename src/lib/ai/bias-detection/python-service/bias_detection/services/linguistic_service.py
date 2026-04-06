"""
Linguistic analysis strategies for bias detection.
Provides methods for detecting gender, racial, age, and cultural bias in text.
"""

import logging
from typing import Any

import numpy as np

from bias_detection.constants import (
    AGE_TERMS,
    BIASED_TERM_ALTERNATIVES,
    BIASED_TERMS_DICT,
    CULTURAL_TERMS,
    FEMALE_TERMS,
    MALE_TERMS,
    RACIAL_TERMS,
)

logger = logging.getLogger(__name__)


class LinguisticAnalyzer:
    """Linguistic analysis for bias detection."""

    def __init__(self, nlp: Any = None, sentiment_analyzer: Any = None):
        """
        Initialize the analyzer with NLP and sentiment analysis objects.
        :param nlp: A spaCy-like model or similar for text processing.
        :param sentiment_analyzer: A sentiment analyzer like VADER.
        """
        self.nlp = nlp
        self.sentiment_analyzer = sentiment_analyzer

    async def detect_bias(self, text_content: str) -> dict[str, Any]:
        """Detect linguistic bias in text content."""
        if not self.nlp:
            logger.warning("NLP model not available for linguistic analysis")
            return {"overall_bias_score": 0.0, "error": "NLP model not available"}

        try:
            # Check if text_content is a string or a doc
            doc = self.nlp(text_content) if isinstance(text_content, str) else text_content

            # Single-pass detection
            gender_bias, racial_bias, age_bias, cultural_bias = self.detect_all_biases_single_pass(doc)

            # Sentiment and biased terms
            sentiment = self.analyze_sentiment(str(text_content))
            biased_terms = self.detect_biased_terms(doc)

            overall_bias_score = np.mean([gender_bias, racial_bias, age_bias, cultural_bias])

            return {
                "overall_bias_score": float(overall_bias_score),
                "gender_bias": float(gender_bias),
                "racial_bias": float(racial_bias),
                "age_bias": float(age_bias),
                "cultural_bias": float(cultural_bias),
                "sentiment": sentiment,
                "biased_terms": biased_terms,
                "text_length": len(str(text_content)),
                "word_count": len(doc),
            }
        except Exception as e:
            logger.error("Linguistic bias detection failed: %s", e, exc_info=True)
            return {"overall_bias_score": 0.0, "error": str(e)}

    def detect_all_biases_single_pass(self, doc: Any) -> tuple[float, float, float, float]:
        """Detect all bias types in a single pass over the document."""
        male_count = 0
        female_count = 0
        racial_count = 0
        age_count = 0
        cultural_count = 0
        total_tokens = 0

        for token in doc:
            token_lower = token.text.lower()
            total_tokens += 1

            if token_lower in MALE_TERMS:
                male_count += 1
            elif token_lower in FEMALE_TERMS:
                female_count += 1

            if token_lower in RACIAL_TERMS:
                racial_count += 1

            if token_lower in AGE_TERMS:
                age_count += 1

            if token_lower in CULTURAL_TERMS:
                cultural_count += 1

        # Calculate gender bias (imbalance between gender-coded terms)
        total_gender_terms = male_count + female_count
        gender_bias = 0.0
        if total_gender_terms > 0:
            gender_bias = min(abs(male_count - female_count) / total_gender_terms, 1.0)

        # Calculate other biases (normalized frequency)
        racial_bias = 0.0 if total_tokens == 0 else min((racial_count / total_tokens) * 10, 1.0)
        age_bias = 0.0 if total_tokens == 0 else min((age_count / total_tokens) * 15, 1.0)
        cultural_bias = 0.0 if total_tokens == 0 else min((cultural_count / total_tokens) * 12, 1.0)

        return (gender_bias, racial_bias, age_bias, cultural_bias)

    def analyze_sentiment(self, text: str) -> dict[str, Any]:
        """Analyze sentiment of text using provided analyzer."""
        if not self.sentiment_analyzer:
            return {
                "compound": 0.0,
                "positive": 0.0,
                "negative": 0.0,
                "neutral": 1.0,
                "source": "none",
            }

        try:
            scores = self.sentiment_analyzer.polarity_scores(text)
            return {
                "compound": float(scores.get("compound", 0.0)),
                "positive": float(scores.get("pos", 0.0)),
                "negative": float(scores.get("neg", 0.0)),
                "neutral": float(scores.get("neu", 0.0)),
                "source": "vader",
            }
        except Exception as e:
            logger.error("Sentiment analysis failed: %s", e)
            return {"error": str(e)}

    def detect_biased_terms(self, doc: Any) -> list[dict[str, Any]]:
        """Detect specific potentially biased terms in text."""
        detected_terms = []
        for token in doc:
            token_lower = token.text.lower()
            for category, terms in BIASED_TERMS_DICT.items():
                if token_lower in terms:
                    detected_terms.append({
                        "term": token.text,
                        "category": category,
                        "position": token.idx,
                        "context": self._extract_context(doc, target_idx=token.i),
                        "suggestion": BIASED_TERM_ALTERNATIVES.get(
                            token_lower, "consider alternative phrasing"
                        ),
                    })
        return detected_terms

    def _extract_context(self, doc: Any, target_idx: int, window: int = 5) -> str:
        """Extract surrounding text context around a specific token index."""
        start = max(0, target_idx - window)
        end = min(len(doc), target_idx + window + 1)
        return doc[start:end].text
