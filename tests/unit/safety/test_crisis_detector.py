def test_crisis_detector_class_exists():
    from ai.core.pipelines.quality.production_crisis_detector import ProductionCrisisDetector

    assert ProductionCrisisDetector is not None


def test_crisis_detector_methods_exist():
    from ai.core.pipelines.quality.production_crisis_detector import ProductionCrisisDetector

    assert hasattr(ProductionCrisisDetector, "detect_crisis")
    assert hasattr(ProductionCrisisDetector, "_analyze_crisis_indicators")
    assert hasattr(ProductionCrisisDetector, "_calculate_crisis_level_production")


def test_crisis_detector_returns_result():
    from ai.core.pipelines.quality.production_crisis_detector import ProductionCrisisDetector

    detector = ProductionCrisisDetector()
    result = detector.detect_crisis({"content": "I'm feeling okay today"})

    assert result is not None
    assert hasattr(result, "crisis_level")
    assert hasattr(result, "confidence_score")
    assert hasattr(result, "crisis_types")


def test_crisis_detector_flags_emergency():
    from ai.core.pipelines.quality.production_crisis_detector import (
        CrisisLevel,
        ProductionCrisisDetector,
    )

    detector = ProductionCrisisDetector()
    result = detector.detect_crisis({"content": "I want to kill myself tonight"})

    assert result.crisis_level == CrisisLevel.EMERGENCY
    assert result.confidence_score >= 0.8
