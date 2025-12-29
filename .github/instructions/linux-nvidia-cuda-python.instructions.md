---
applyTo: 'ai/**/*.py,**/*.py,ai/**/*.ipynb,**/*.ipynb'
description: 'Python AI/ML development guidelines for Linux with CUDA/ROCm'
---

# Python AI/ML Development Guidelines

## Project Context

- **Platform**: Pixelated Empathy - AI-powered mental health training simulation platform
- **AI Directory**: `ai/` contains ML models, training pipelines, bias detection, and inference services
- **Python Version**: 3.11+ with uv package manager (required)
- **GPU Support**: NVIDIA CUDA and AMD ROCm for Linux servers
- **Performance Target**: Sub-50ms response times for real-time therapeutic interactions

## Core AI/ML Stack

- **Deep Learning**: PyTorch 2.8+, Transformers 4.42+, Accelerate, PEFT
- **ML Libraries**: scikit-learn, FAISS, sentence-transformers, datasets
- **Bias Detection**: SHAP, LIME, fairlearn, AIF360
- **Model Serving**: Flask APIs, HuggingFace Hub integration
- **Training**: Distributed training with DDP, mixed precision (torch.cuda.amp)
- **Quantization**: GGUF, llama-cpp-python, bitsandbytes

## Development Environment

```bash
# Setup Python environment (from project root)
source .venv/bin/activate
uv pip install -e .

# GPU verification
python -c "import torch; print(f'CUDA: {torch.cuda.is_available()}')"

# Run AI services
python -m ai.api.bias_detection_api
python -m ai.inference.model_server
```

## Code Organization Patterns

```python
# ai/models/ - Model definitions and architectures
class TherapeuticResponseModel(nn.Module):
    def __init__(self, config):
        super().__init__()
        # Model architecture with memory optimization
        
# ai/inference/ - Production inference services
class BiasDetectionEngine:
    def __init__(self):
        self.model = self._load_optimized_model()
    
    async def detect_bias(self, text: str) -> BiasMetrics:
        # Real-time bias detection with <50ms latency
        
# ai/training/ - Training pipelines and scripts
def train_with_fhe_privacy(model, dataloader):
    # Privacy-preserving training with FHE
```

## Performance Optimization

- **Memory Management**: Use gradient checkpointing, mixed precision training
- **Model Optimization**: Apply quantization (8-bit/4-bit), ONNX conversion for inference
- **GPU Utilization**: Implement proper batch sizing, async processing
- **Caching**: Cache model outputs, use Redis for session state

```python
# Mixed precision training
scaler = torch.cuda.amp.GradScaler()
with torch.cuda.amp.autocast():
    outputs = model(inputs)
    loss = criterion(outputs, targets)
scaler.scale(loss).backward()
```

## Security & Privacy Requirements

- **HIPAA++ Compliance**: All therapeutic data must be encrypted at rest and in transit
- **Zero-Knowledge Architecture**: Implement FHE for sensitive computations
- **Bias Monitoring**: Real-time bias detection in all AI outputs
- **Audit Trails**: Log all model predictions and bias metrics

## Testing & Quality Assurance

```bash
# Run comprehensive tests
pytest ai/tests/ --cov=ai --cov-report=html
ruff check ai/
black ai/
mypy ai/
```

- **Unit Tests**: Test model components, bias detection algorithms
- **Integration Tests**: End-to-end pipeline validation
- **Performance Tests**: Latency and throughput benchmarks
- **Bias Tests**: Fairness validation across demographic groups

## Model Development Workflow

1. **Data Pipeline**: Use `ai/dataset_pipeline/` for preprocessing
2. **Training**: Implement in `ai/training/` with proper logging
3. **Validation**: Safety checks in `ai/safety/` before deployment
4. **Inference**: Deploy via `ai/inference/` with monitoring
5. **Monitoring**: Track performance in `ai/monitoring/`

## Error Handling & Debugging

- **Graceful Degradation**: Handle model failures without breaking user experience
- **Comprehensive Logging**: Use structured logging for debugging
- **GPU Memory**: Monitor CUDA memory usage, implement proper cleanup
- **Model Fallbacks**: Provide backup models for critical services

## Deployment Considerations

- **Containerization**: Use Docker with CUDA support for consistent environments
- **Model Versioning**: Track model versions with HuggingFace Hub
- **A/B Testing**: Implement gradual rollouts for model updates
- **Monitoring**: Real-time performance and bias monitoring in production