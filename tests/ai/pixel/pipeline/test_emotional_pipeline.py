import pytest
import yaml
from ai.pixel.pipeline.emotional_pipeline import EmotionalPipeline
from ai.pixel.pipeline.schemas import FullPipelineOutput


def test_pipeline_instantiation():
    """Tests that the pipeline can be instantiated with the default config."""
    try:
        _ = EmotionalPipeline()
    except Exception as e:
        pytest.fail(f"Pipeline instantiation failed: {e}")


def test_pipeline_forward_pass():
    """Tests the forward pass of the default pipeline."""
    pipeline = EmotionalPipeline()
    output = pipeline.forward("This is a test")
    assert isinstance(output, FullPipelineOutput)
    assert len(output.emotion_features.features) == 32


def test_pipeline_reconfiguration(tmp_path):
    """Tests that the pipeline can be reconfigured to disable a module."""
    config_content = {
        'modules': [
            {'name': 'emotional_cnn_layer', 'enabled': True},
            {'name': 'emotional_resnet_memory', 'enabled': False}, # Disabled
            {'name': 'emotional_flow_dynamics', 'enabled': True},
            {'name': 'meta_emotional_intelligence', 'enabled': True},
        ]
    }
    config_path = tmp_path / "test_config.yaml"
    with open(config_path, 'w') as f:
        yaml.dump(config_content, f)

    pipeline = EmotionalPipeline(config_path=str(config_path))

    # Check that the disabled module is not in the pipeline
    assert 'emotional_resnet_memory' not in pipeline.modules_map

    # Check that the forward pass still works
    output = pipeline.forward("This is another test")
    assert isinstance(output, FullPipelineOutput)
