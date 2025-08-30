import pytest
import torch
from ai.pixel.research.refactored_neuroplasticity_layer import RefactoredNeuroplasticityLayer

def test_layer_stability():
    """Tests that the refactored layer's weights remain stable after many updates."""
    input_dim = 16
    output_dim = 8
    batch_size = 4
    num_iterations = 100

    layer = RefactoredNeuroplasticityLayer(input_dim, output_dim, plasticity_rate=0.01)

    for i in range(num_iterations):
        # Create random input and reward signals
        x = torch.randn(batch_size, input_dim)
        reward = torch.randn(batch_size, output_dim)

        # Run the forward pass to update the weights
        _ = layer(x, reward_signal=reward)

        # Check for NaN or infinity in the weights
        assert not torch.isnan(layer.weight).any(), f"NaN found in weights at iteration {i}"
        assert torch.isfinite(layer.weight).all(), f"Infinity found in weights at iteration {i}"
