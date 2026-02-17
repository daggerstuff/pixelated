import json
from unittest.mock import patch

import pytest

from ai.utils.transcript_corrector import TranscriptCorrector

# Sample test data
SAMPLE_TERMS = {
    "cptsd_terms": ["emotional flashback", "inner critic"],
    "medical_terms": ["amygdala"],
    "common_misinterpretations": {"complex ptsd": "C-PTSD", "EMD R": "EMDR"},
}


@pytest.fixture
def mock_config_file(tmp_path):
    config_file = tmp_path / "test_terms.json"
    with open(config_file, "w") as f:
        json.dump(SAMPLE_TERMS, f)
    return str(config_file)


class TestTranscriptCorrector:
    def test_initialization(self, mock_config_file):
        corrector = TranscriptCorrector(config_path=mock_config_file)
        assert corrector.terms == SAMPLE_TERMS

    @patch("ai.utils.transcript_corrector.Path.exists")
    def test_initialization_missing_file(self, mock_exists):
        # Force both primary and fallback paths to not exist
        mock_exists.return_value = False
        corrector = TranscriptCorrector(config_path="non_existent.json")
        assert corrector.terms == {
            "cptsd_terms": [],
            "medical_terms": [],
            "common_misinterpretations": {},
        }

    def test_clean_structure(self, mock_config_file):
        corrector = TranscriptCorrector(config_path=mock_config_file)
        input_text = "Um, I think, uh, like, I have anxiety."
        # "Um, " -> ""
        # "uh, " -> "" (if comma follows) -> let's check regex: r"\b...b,?\s*"
        # "Um, " matches. "uh, " matches. "like, " matches.
        # Expected: "I think, I have anxiety."
        # Wait, "I think, " <- comma is from "think,".
        # " uh, " -> matches "uh, " -> empty.
        # " like, " -> matches "like, " -> empty.
        expected_text = "I think, I have anxiety."
        assert corrector._clean_structure(input_text) == expected_text

    def test_apply_terminology_fixes(self, mock_config_file):
        corrector = TranscriptCorrector(config_path=mock_config_file)
        input_text = "I have complex ptsd and try EMD R."
        expected_text = "I have C-PTSD and try EMDR."
        assert corrector._apply_terminology_fixes(input_text) == expected_text

    def test_process_full_correction_flow(self, mock_config_file):
        corrector = TranscriptCorrector(config_path=mock_config_file)
        input_text = "Um, I suffer from complex ptsd."
        # 1. Clean structure: "Um, " -> "" => "I suffer from complex ptsd."
        # 2. Terminology: "complex ptsd" -> "C-PTSD"
        expected_text = "I suffer from C-PTSD."
        assert corrector.correct_transcript(input_text) == expected_text

    def test_validate_term_coverage(self, mock_config_file):
        corrector = TranscriptCorrector(config_path=mock_config_file)
        text = "My inner critic is loud and I feel an emotional flashback."
        metrics = corrector.validate_term_coverage(text)

        assert metrics["cptsd_term_count"] == 2  # inner critic, emotional flashback
        assert metrics["medical_term_count"] == 0
        # Total terms in sample: 2 cptsd + 1 medical = 3.
        # Score = 2/3 = 0.6667
        assert metrics["domain_coverage_score"] == 0.6667
