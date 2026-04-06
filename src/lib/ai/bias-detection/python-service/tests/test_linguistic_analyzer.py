#!/usr/bin/env python3
"""
Unit tests for LinguisticAnalyzer.
"""

import unittest
from unittest.mock import MagicMock, Mock

from bias_detection.constants import BIASED_TERMS_DICT
from bias_detection.services.linguistic_service import LinguisticAnalyzer


class TestLinguisticAnalyzer(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_nlp = MagicMock()
        self.mock_sentiment = MagicMock()
        self.analyzer = LinguisticAnalyzer(nlp=self.mock_nlp, sentiment_analyzer=self.mock_sentiment)

    async def test_detect_bias_integration(self):
        """Integration-style test for detect_bias async method"""
        # Mock spaCy doc
        mock_token = Mock(text="he", i=0, idx=0)
        mock_doc = MagicMock()
        mock_doc.__iter__.return_value = [mock_token]
        mock_doc.__len__.return_value = 1
        mock_doc.text = "he"
        self.mock_nlp.return_value = mock_doc

        # Mock sentiment
        self.mock_sentiment.polarity_scores.return_value = {
            "compound": 0.0, "pos": 0.0, "neg": 0.0, "neu": 1.0
        }

        result = await self.analyzer.detect_bias("he")

        # Expected: gender_bias=1.0 (unbalanced), others=0.0
        # overall_bias_score = (1.0 + 0.0 + 0.0 + 0.0) / 4 = 0.25
        assert result["gender_bias"] == 1.0
        assert result["overall_bias_score"] == 0.25
        assert result["word_count"] == 1

    def test_detect_all_biases_single_pass_gender(self):
        """Test gender bias logic in single pass"""
        # Balanced: he, she
        doc = [Mock(text="he"), Mock(text="she")]
        # Note: the pass also checks against words like 'he' and 'she'
        g, _, _, _ = self.analyzer.detect_all_biases_single_pass(doc)
        assert g == 0.0

        # Unbalanced: he, him, he
        doc = [Mock(text="he"), Mock(text="him"), Mock(text="he")]
        g, _, _, _ = self.analyzer.detect_all_biases_single_pass(doc)
        assert g == 1.0  # 3 males, 0 females

        # Partially unbalanced
        doc = [Mock(text="he"), Mock(text="he"), Mock(text="she")] # 2 males, 1 female. Ratio abs(2-1)/3 = 0.33
        g, _, _, _ = self.analyzer.detect_all_biases_single_pass(doc)
        assert abs(g - 0.333) < 0.01

        # Racial term density: 1 racial term in 10 tokens
        doc = [Mock(text="black")] + [Mock(text="token")] * 9
        _, r, _, _ = self.analyzer.detect_all_biases_single_pass(doc)
        # racial_bias = min((1 / 10) * 10, 1.0) = 1.0
        assert r == 1.0

        # Lower density
        doc = [Mock(text="black")] + [Mock(text="token")] * 99 # 1 in 100
        _, r, _, _ = self.analyzer.detect_all_biases_single_pass(doc)
        # racial_bias = min((1 / 100) * 10, 1.0) = 0.1
        assert abs(r - 0.1) < 0.001

    def test_analyze_sentiment_success(self):
        """Test sentiment analysis wrapper"""
        self.mock_sentiment.polarity_scores.return_value = {
            "compound": 0.8, "pos": 0.9, "neg": 0.0, "neu": 0.1
        }
        result = self.analyzer.analyze_sentiment("Excellent work!")
        assert result["compound"] == 0.8
        assert result["source"] == "vader"

    def test_analyze_sentiment_no_analyzer(self):
        """Test sentiment analysis when analyzer is missing"""
        local_analyzer = LinguisticAnalyzer(nlp=self.mock_nlp, sentiment_analyzer=None)
        result = local_analyzer.analyze_sentiment("Hello")
        assert result["compound"] == 0.0
        assert result["source"] == "none"

    def test_detect_biased_terms(self):
        """Test detect_biased_terms logic"""
        # Pick a term from the real constants to avoid mocking them (less fragile)
        term = BIASED_TERMS_DICT["gender"][0] # mankind

        mock_token = Mock(text=term, i=0, idx=0)
        mock_doc = MagicMock()
        mock_doc.__iter__.return_value = [mock_token]
        mock_doc.__getitem__.return_value = mock_token # Mock context window slice

        result = self.analyzer.detect_biased_terms(mock_doc)

        assert len(result) == 1
        assert result[0]["term"] == term
        assert result[0]["category"] == "gender"

if __name__ == "__main__":
    unittest.main()
