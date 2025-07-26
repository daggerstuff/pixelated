from pixel_voice import feature_extraction


def test_extract_features_basic():
    # Minimal segment with text
    segment = {"text": "I am happy to help you today."}
    features = feature_extraction.extract_features(segment)
    assert "length" in features
    assert "num_words" in features
    assert "avg_word_length" in features
    assert "emotion" in features
    assert "sentiment" in features
    assert features["length"] == len(segment["text"])
    assert features["num_words"] == len(segment["text"].split())
    assert features["avg_word_length"] > 0
