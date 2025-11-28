import importlib.util
from pathlib import Path


def load_pipeline_module():
    module_path = (
        Path(__file__)
        .resolve()
        .parents[2]
        / 'ai'
        / 'dataset_pipeline'
        / 'unified_preprocessing_pipeline.py'
    )
    spec = importlib.util.spec_from_file_location(
        'unified_preprocessing_pipeline', module_path
    )
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


pipeline_module = load_pipeline_module()
ProcessingConfig = pipeline_module.ProcessingConfig
UnifiedPreprocessingPipeline = pipeline_module.UnifiedPreprocessingPipeline


def build_pipeline():
    config = ProcessingConfig(
        target_quality_threshold=0.0,
        validation_enabled=False,
        psychology_integration_enabled=False,
        youtube_rag_integration_enabled=False,
    )
    return UnifiedPreprocessingPipeline(config=config)


def base_record():
    return {
        'text': 'supportive message content that exceeds minimum length',
        'metadata': {
            'quality_score': 1.0,
            'empathy_score': 0.9,
        },
    }


def test_stage3_non_crisis_low_safety_is_rejected():
    pipeline = build_pipeline()
    record = base_record()
    record['metadata'].update(
        {
            'stage': 'stage3_edge_stress_test',
            'safety_score': 0.3,
        }
    )

    assert pipeline.validate_record(record) is False


def test_stage3_crisis_low_safety_is_allowed():
    pipeline = build_pipeline()
    record = base_record()
    record['metadata'].update(
        {
            'stage': 'stage3_edge_stress_test',
            'safety_score': 0.3,
            'crisis_intensity': 'high',
        }
    )

    assert pipeline.validate_record(record) is True


def test_safety_filtering_respects_policy_minimums_for_non_crisis_records():
    pipeline = build_pipeline()

    non_crisis_record = base_record()
    non_crisis_record['metadata'].update(
        {
            'stage': 'stage3_edge_stress_test',
            'safety_score': 0.3,
        }
    )

    crisis_record = base_record()
    crisis_record['metadata'].update(
        {
            'stage': 'stage3_edge_stress_test',
            'safety_score': 0.6,
            'crisis_intensity': 'high',
        }
    )

    filtered = pipeline.apply_safety_filtering(
        [non_crisis_record, crisis_record]
    )

    assert crisis_record in filtered
    assert non_crisis_record not in filtered

