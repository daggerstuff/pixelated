# Training Pipeline Operations Guide

## Overview

This document provides a comprehensive guide to running training jobs in the Pixelated Empathy AI project. It covers the complete workflow from preparing training manifests to model promotion and cost management.

## Table of Contents
- [Quick Start](#quick-start)
- [Training Manifests](#training-manifests)
- [Dataset Preparation](#dataset-preparation)
- [Running Training Jobs](#running-training-jobs)
- [Model Evaluation](#model-evaluation)
- [Model Promotion](#model-promotion)
- [Cost Management](#cost-management)
- [CI/CD Integration](#cicd-integration)
- [Samples](#samples)

## Quick Start

### Prerequisites
- Python 3.8+
- PyTorch with CUDA support (for GPU training)
- Required Python packages (see `requirements.txt`)
- Dataset in JSON format
- Weights & Biases (optional) API key for logging

### Basic Training Command
```bash
# Using Python directly
python -m ai.dataset_pipeline.training_runner --manifest path/to/manifest.json

# For containerized training
python -m ai.dataset_pipeline.training_runner --manifest path/to/manifest.json --container
```

## Training Manifests

Training manifests define the complete configuration for a training run. They include dataset references, hyperparameters, compute requirements, and other settings.

### Creating a Manifest

```python
from ai.dataset_pipeline.training_manifest import TrainingManifest, DatasetReference, Hyperparameters

# Create a basic manifest
manifest = TrainingManifest(
    name="therapy_model_v1",
    description="Therapeutic conversation model training",
    dataset=DatasetReference(
        name="therapeutic_conversations_v2",
        version="2.1.0",
        path="/path/to/training_dataset.json",
        commit_hash="abc123def456"  # Git commit hash of dataset
    ),
    hyperparameters=Hyperparameters(
        num_train_epochs=3,
        learning_rate=2e-5,
        per_device_train_batch_size=4,
        gradient_accumulation_steps=8,
        warmup_steps=500,
        bf16=True,
        gradient_checkpointing=True
    ),
    compute_target="gpu_single",
    seed=42,
    output_dir="./model_outputs",
    log_dir="./logs",
    wandb_logging=True,
    wandb_project="pixelated-empathy-ai"
)

# Save the manifest
manifest.save_to_file("training_manifest.json")
```

### Manifest Structure

| Field | Type | Description |
|-------|------|-------------|
| `manifest_id` | string | Unique identifier for this manifest |
| `name` | string | Human-readable name for the training run |
| `description` | string | Description of the training run |
| `dataset` | DatasetReference | Reference to the training dataset |
| `hyperparameters` | Hyperparameters | Training hyperparameters configuration |
| `framework` | string | Training framework (e.g., transformers, lightning) |
| `compute_target` | string | Target compute platform (cpu, gpu_single, gpu_multi, cloud_gpu) |
| `seed` | int | Random seed for reproducibility |
| `safety_metrics` | SafetyMetrics | Configuration for safety metrics |
| `resources` | ResourceRequirements | Resource requirements and budget |
| `output_dir` | string | Directory for saving outputs |
| `log_dir` | string | Directory for saving logs |

## Dataset Preparation

Training datasets should be in JSON format with the following structure:

```json
{
  "conversations": [
    {
      "text": "Therapist: How are you feeling today?\nClient: I'm feeling anxious about my upcoming therapy session."
    },
    {
      "text": "Therapist: What specifically are you worried about?\nClient: I'm afraid I won't be able to open up."
    }
  ]
}
```

### Dataset Requirements
- Each conversation should be a single text field with role indicators
- Text should be clean and appropriately formatted
- Conversations should be relevant to therapeutic contexts
- Dataset should include appropriate safety labels if available

## Running Training Jobs

### Local Training
```bash
# Run training with default settings
python -c "
from ai.dataset_pipeline.training_runner import run_training_from_manifest
run_training_from_manifest('path/to/manifest.json')
"
```

### Containerized Training
```bash
# Run training in container
python -c "
from ai.dataset_pipeline.training_runner import run_training_from_manifest
run_training_from_manifest('path/to/manifest.json', use_container=True)
"
```

### Resource Management
Training jobs can be run with resource limits and monitoring:

```python
from ai.dataset_pipeline.resource_accounting import BudgetLimits

# Define budget limits
budget_limits = BudgetLimits(
    max_cost_usd=50.0,
    max_runtime_hours=24.0,
    max_gpu_memory_gb=16.0,
    max_system_memory_gb=32.0
)

# This will be used to monitor and enforce cost limits
```

## Model Evaluation

After training, models are evaluated using comprehensive metrics:

### Standard Metrics
- **Perplexity**: Language model quality
- **Safety Score**: Measure of safe outputs
- **Fairness Score**: Measure of fair representation
- **Therapeutic Quality**: Measure of therapeutic appropriateness

### Evaluation Process
```python
from ai.dataset_pipeline.evaluation_system import ComprehensiveEvaluator

# Create evaluator
evaluator = ComprehensiveEvaluator()

# Evaluate trained model
results = evaluator.evaluate_model(
    model=trained_model,
    tokenizer=tokenizer,
    dataset=eval_dataset
)

# Generate report
report = evaluator.generate_evaluation_report(results)
print(report)
```

## Model Promotion

Models are promoted through automated evaluation gates between stages:

### Promotion Stages
1. **Training** → **Staging**: Basic safety and quality checks
2. **Staging** → **Production**: Comprehensive evaluation and approval

### Promotion Gates
Each promotion stage has specific requirements:

**Staging Requirements:**
- Safety Score ≥ 0.8
- Toxicity Ratio ≤ 10%
- Minimum Fairness Score ≥ 0.5
- Therapeutic Quality Score ≥ 0.6

**Production Requirements:**
- Safety Score ≥ 0.9
- Toxicity Ratio ≤ 5%
- Crisis Content Ratio ≤ 15%
- Fairness Score ≥ 0.7
- Therapeutic Quality Score ≥ 0.75
- Perplexity ≤ 50.0

### Promotion Process
```python
from ai.dataset_pipeline.evaluation_gates import create_model_promotion_manager

# Create promotion manager
manager = create_model_promotion_manager()

# Check if model can be promoted to staging
can_promote = manager.can_promote_to_staging(
    model_id="therapy_model_v1",
    model_version="1.0.0",
    metrics=evaluation_results.custom_metrics
)

# Promote to production (if staging requirements are met)
if can_promote:
    can_promote_to_prod = manager.can_promote_to_production(
        model_id="therapy_model_v1",
        model_version="1.0.0", 
        metrics=evaluation_results.custom_metrics
    )
```

## Cost Management

### Budget Configuration
```python
from ai.dataset_pipeline.resource_accounting import BudgetLimits

budget = BudgetLimits(
    max_cost_usd=200.0,           # Maximum allowed cost
    max_runtime_hours=48.0,       # Maximum training time
    max_gpu_memory_gb=32.0,       # Maximum GPU memory
    max_system_memory_gb=64.0,    # Maximum system memory
    notification_threshold=0.8    # Alert at 80% of limit
)
```

### Monitoring During Training
```python
from ai.dataset_pipeline.resource_accounting import ResourceManager

# Start monitoring for a run
rm = ResourceManager()
rm.start_run_monitoring("run_123", budget_limits=budget)

# Get resource report
report = rm.get_run_report("run_123")
print(f"Current cost: ${report.cost_estimation.estimated_cost_usd:.2f}")
print(f"Runtime: {report.total_runtime_hours:.2f} hours")

# Stop monitoring
rm.stop_run_monitoring("run_123")
```

## CI/CD Integration

### Smoke Tests
For CI/CD pipelines, use fast smoke tests:

```bash
# Run smoke tests
python -m ai.dataset_pipeline.ci_smoke_tests
```

### GitHub Actions Example
```yaml
name: Training Pipeline CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  smoke-test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v3
      with:
        python-version: '3.8'
    - name: Install dependencies
      run: |
        pip install torch
        pip install -r requirements.txt
    - name: Run smoke tests
      run: |
        python -m ai.dataset_pipeline.ci_smoke_tests
```

## Samples

### Sample Training Manifest
```json
{
  "manifest_id": "manifest_therapy_model_123",
  "name": "therapy_model_finetuned",
  "description": "Fine-tuned therapeutic conversation model",
  "dataset": {
    "name": "therapeutic_conversations",
    "version": "2.1.0",
    "path": "/data/therapeutic_conversations_v2.json",
    "size_bytes": 104857600,
    "created_at": "2023-12-01T10:00:00Z"
  },
  "hyperparameters": {
    "num_train_epochs": 3,
    "learning_rate": 2e-05,
    "per_device_train_batch_size": 4,
    "gradient_accumulation_steps": 8,
    "warmup_steps": 500,
    "weight_decay": 0.01,
    "max_seq_length": 512,
    "save_steps": 500,
    "logging_steps": 10
  },
  "framework": "transformers",
  "compute_target": "gpu_single",
  "seed": 42,
  "safety_metrics": {
    "max_crisis_content_ratio": 0.15,
    "toxicity_threshold": 0.05,
    "privacy_preservation_enabled": true
  },
  "resources": {
    "min_gpu_memory_gb": 16.0,
    "min_system_memory_gb": 32.0,
    "expected_runtime_hours": 24.0,
    "max_budget_usd": 50.0
  },
  "output_dir": "./model_output",
  "log_dir": "./logs",
  "evaluation_enabled": true,
  "wandb_logging": true,
  "wandb_project": "pixelated-empathy-ai"
}
```

### Sample Dataset
```json
{
  "conversations": [
    {
      "text": "Therapist: How are you feeling today?\nClient: I'm feeling overwhelmed with work and family responsibilities.\nTherapist: It sounds like you have a lot on your plate. What aspects are feeling most challenging?"
    },
    {
      "text": "Client: I've been having thoughts about not wanting to continue.\nTherapist: Thank you for sharing that. That sounds very difficult. Are you having thoughts of harming yourself?"
    }
  ]
}
```

### Example Training Script
```python
from ai.dataset_pipeline.training_manifest import create_default_manifest
from ai.dataset_pipeline.training_runner import TrainingRunner
from ai.dataset_pipeline.resource_accounting import BudgetLimits

def train_model():
    # Create manifest
    manifest = create_default_manifest(
        dataset_path="./training_data.json",
        dataset_version="1.0.0"
    )
    
    # Customize hyperparameters
    manifest.hyperparameters.num_train_epochs = 3
    manifest.hyperparameters.learning_rate = 2e-5
    
    # Set up resource limits
    budget_limits = BudgetLimits(
        max_cost_usd=100.0,
        max_runtime_hours=24.0
    )
    
    # Setup resource monitoring
    from ai.dataset_pipeline.resource_accounting import ResourceManager
    rm = ResourceManager()
    rm.start_run_monitoring("training_run_123", budget_limits)
    
    # Run training
    runner = TrainingRunner(manifest)
    result = runner.run_training()
    
    # Generate cost report
    report = rm.get_run_report("training_run_123")
    print(f"Training completed. Cost: ${report.cost_estimation.estimated_cost_usd}")
    
    return result

if __name__ == "__main__":
    train_model()
```

## Best Practices

### For Safety-Critical Models
- Always test safety metrics before deployment
- Use more conservative hyperparameters (lower learning rates)
- Implement comprehensive evaluation metrics
- Set strict promotion gates

### For Cost Optimization
- Start with small hyperparameter sweeps
- Use gradient accumulation to maximize batch sizes
- Enable mixed precision training (bf16)
- Monitor resource usage continuously

### For Reproducibility
- Always fix random seeds
- Record dataset version and commit hash
- Save complete training manifests
- Track hyperparameter configurations

## Troubleshooting

### Common Issues
- **Out of Memory**: Reduce batch size or enable gradient checkpointing
- **Slow Training**: Check if CUDA is properly configured
- **Poor Convergence**: Adjust learning rate or number of epochs
- **Model Safety Issues**: Review safety metrics and adjust thresholds

### Monitoring Commands
```bash
# Check running processes
nvidia-smi

# Monitor training logs
tail -f logs/training.log

# Check WandB metrics (if enabled)
# Visit https://wandb.ai/your-project
```

## Additional Resources

- [Labeling Guide](labeling.md) - For preparing training data
- [Evaluation Metrics Documentation](evaluation_metrics.md) - For understanding metrics
- [Hyperparameter Tuning Guide](hyperparameter_tuning.md) - For optimization strategies
- [Security Guidelines](security.md) - For security considerations with sensitive data