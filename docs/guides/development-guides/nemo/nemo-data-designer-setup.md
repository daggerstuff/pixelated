# NVIDIA NeMo Data Designer Setup Guide

## What is NVIDIA NeMo Data Designer?

[NVIDIA NeMo Data Designer](https://docs.nvidia.com/nemo/microservices/latest/design-synthetic-data-from-scratch-or-seeds/index.html) is a powerful tool for generating high-quality, domain-specific synthetic datasets. It uses large language models (LLMs) to create realistic data that can be used for:

- **Training AI models** - Generate diverse training data
- **Fine-tuning** - Create domain-specific datasets
- **Testing & Evaluation** - Generate test datasets with known characteristics
- **Bias Detection** - Create datasets with protected attributes for fairness analysis
- **Data Augmentation** - Expand existing datasets with synthetic data

## Important: Deployment Required

**NeMo Data Designer must be deployed locally or on a cluster** - it is not a cloud API service. According to the [official documentation](https://docs.nvidia.com/nemo/microservices/latest/design-synthetic-data-from-scratch-or-seeds/index.html), getting started requires:

1. Data Designer **deployed on your laptop or compute instance**
2. The NeMo Microservices SDK installed
3. Connectivity to models that are available via API or deployed in the same environment

## Key Features

### 1. **Intelligent Data Generation**
- Uses LLMs to generate realistic, contextually appropriate data
- Supports multiple data types (categorical, integer, float, text)
- Custom constraints and value ranges
- Relationship modeling between columns

### 2. **Domain-Specific Templates**
- Pre-configured templates for therapeutic datasets
- Bias detection datasets with protected attributes
- Custom dataset builders

### 3. **Scalable Processing**
- Batch processing for large datasets
- RESTful API for programmatic access
- Configurable timeouts and retries

### 4. **Deployment Options**
- Docker Compose deployment for local development (recommended)
- Kubernetes/Helm charts for production

## Setup Instructions

### Step 1: Get Your NVIDIA API Key

1. Visit https://build.nvidia.com
2. Sign up or log in to NVIDIA Build
3. Navigate to API Keys section
4. Generate a new API key
5. Copy the API key (you'll need it for deployment)

### Step 2: Install Python SDK

The package is already added to `pyproject.toml`. Install it with:

```bash
# Make sure you're in the uv shell
uv pip install 'nemo-microservices[data-designer]'
```

### Step 3: Deploy NeMo Data Designer

**Option A: Using Docker Compose (Recommended for Local Development)**

1. Ensure Docker and Docker Compose are installed
2. Run the deployment script:

```bash
./scripts/deploy-nemo-data-designer.sh
```

Or manually:

```bash
docker-compose -f docker-compose.nemo-data-designer.yml up -d
```

3. Wait for the service to be healthy (check with `curl http://localhost:8000/health`)

**Option B: Remote Server Deployment**

For deploying on a remote server (e.g., `vivi@212.2.244.60`):

```bash
./scripts/deploy-nemo-data-designer-remote.sh
```

This will automatically:
- Connect to the remote server via SSH
- Download and set up NeMo Microservices
- Start the Data Designer service
- Configure the service to be accessible remotely

See [Remote Deployment Guide](./nemo-data-designer-remote-deployment.md) for detailed instructions.

**Option C: Using Helm (For Kubernetes/Production)**

For Kubernetes deployment, you can use the new deployment script:

```bash
./scripts/infrastructure/deploy-nemo-data-designer-k8s.sh
```

This script will:
- Create the necessary Kubernetes namespace
- Deploy NeMo Data Designer using Helm charts
- Set up ingress for external access
- Configure the service with your NVIDIA API key

Alternatively, you can manually deploy using the provided Kubernetes manifest:

```bash
kubectl apply -f ai/deployment/nemo-data-designer-k8s.yaml
```

See the [official deployment guide](https://docs.nvidia.com/nemo/microservices/latest/set-up/deploy-as-microservices/data-designer/parent-chart.html) for Helm chart deployment.

### Step 4: Configure Environment Variables

Update your `.env` file with the local deployment URL:

```env
# NVIDIA NeMo Data Designer Configuration
NVIDIA_API_KEY=your-api-key-here
# Use localhost when running Docker Compose locally (direct access)
NEMO_DATA_DESIGNER_BASE_URL=http://localhost:8000
# For remote server via Envoy gateway (includes /v1/data-designer path)
# NEMO_DATA_DESIGNER_BASE_URL=http://212.2.244.60:8080/v1/data-designer
# For Kubernetes/production, use your cluster ingress URL
# NEMO_DATA_DESIGNER_BASE_URL=https://nemo-data-designer.your-cluster-domain.com
NEMO_DATA_DESIGNER_TIMEOUT=300
NEMO_DATA_DESIGNER_MAX_RETRIES=3
NEMO_DATA_DESIGNER_BATCH_SIZE=1000
```

**Important**:
- Replace `your-api-key-here` with your actual API key
- Use `http://localhost:8000` for local Docker Compose deployment
- For Kubernetes, use your cluster's ingress URL (e.g., `https://nemo-data-designer.your-cluster-domain.com`)

### Step 5: Verify Installation

1. Check that the service is running:

For local Docker Compose deployment:
```bash
curl http://localhost:8000/health
```

For Kubernetes deployment:
```bash
curl https://nemo-data-designer.your-cluster-domain.com/health
```

2. Run the example script:

```bash
uv run python ai/data_designer/examples.py
```

You should see output like:
```
================================================================================
Example 1: Generating Therapeutic Dataset
================================================================================
Generated 100 samples
Generation time: 12.34 seconds
Columns: age, gender, ethnicity, primary_diagnosis, ...
```

## Usage Examples

### Example 1: Generate Therapeutic Dataset

```python
from ai.data_designer import NeMoDataDesignerService

# Initialize service
service = NeMoDataDesignerService()

# Generate 1000 samples
result = service.generate_therapeutic_dataset(num_samples=1000)

# Access the data
data = result['data']
print(f"Generated {result['num_samples']} samples")
```

### Example 2: Generate Bias Detection Dataset

```python
from ai.data_designer import NeMoDataDesignerService

service = NeMoDataDesignerService()

# Generate dataset for bias analysis
result = service.generate_bias_detection_dataset(
    num_samples=500,
    protected_attributes=["gender", "ethnicity", "age_group"],
)

# Use with bias detection system
from src.lib.ai.bias_detection.python_service.bias_detection_service import BiasDetectionService
bias_service = BiasDetectionService()
analysis = bias_service.analyze_session_bias(result['data'])
```

### Example 3: Custom Dataset

```python
from ai.data_designer import NeMoDataDesignerService
from nemo_microservices.data_designer.essentials import (
    SamplerColumnConfig,
    SamplerType,
    CategorySamplerParams,
    IntegerSamplerParams,
)

service = NeMoDataDesignerService()

# Define your own columns
columns = [
    SamplerColumnConfig(
        name="patient_id",
        sampler_type=SamplerType.INTEGER,
        params=IntegerSamplerParams(min_value=1, max_value=10000),
    ),
    SamplerColumnConfig(
        name="therapy_type",
        sampler_type=SamplerType.CATEGORY,
        params=CategorySamplerParams(
            values=["Individual", "Group", "Couples"],
        ),
    ),
]

result = service.generate_custom_dataset(
    column_configs=columns,
    num_samples=200,
)
```

## Integration with Pixelated Empathy

### Bias Detection Integration

The generated datasets integrate seamlessly with the existing bias detection system:

```python
from ai.data_designer import NeMoDataDesignerService

# Generate synthetic data for bias testing
designer = NeMoDataDesignerService()
dataset = designer.generate_bias_detection_dataset(
    num_samples=1000,
    protected_attributes=["gender", "ethnicity"],
)

# Use with existing bias detection
from src.lib.ai.bias_detection.python_service.bias_detection_service import BiasDetectionService
bias_service = BiasDetectionService()
results = bias_service.analyze_session_bias(dataset['data'])
```

### Dataset Pipeline Integration

Integrate with the existing dataset pipeline:

```python
from ai.data_designer import NeMoDataDesignerService
from ai.dataset_pipeline.main_orchestrator import DatasetOrchestrator

# Generate synthetic therapeutic data
designer = NeMoDataDesignerService()
synthetic = designer.generate_therapeutic_dataset(num_samples=5000)

# Process through existing pipeline
orchestrator = DatasetOrchestrator()
processed = orchestrator.process_dataset(synthetic['data'])
```

## Deployment Options

### Option 1: Docker Compose (Recommended for Local Development)

Docker Compose is the easiest way to get started with NeMo Data Designer locally.

**Pros:**
- Easy to set up and run
- No Kubernetes required
- Good for development and testing
- Isolated environment

**Cons:**
- Requires Docker and Docker Compose
- Local resource usage
- Not suitable for high-scale production

**Deployment Steps:**

```bash
# Using the provided script
./scripts/deploy-nemo-data-designer.sh

# Or manually
docker-compose -f docker-compose.nemo-data-designer.yml up -d
```

### Option 2: Kubernetes/Helm (Recommended for Production)

For production deployments, use Kubernetes with Helm charts.

#### Docker Compose Deployment

```bash
# Clone NeMo microservices repository
git clone https://github.com/NVIDIA/NeMo-Microservices.git
cd NeMo-Microservices

# Deploy data designer service
docker-compose -f docker-compose.data-designer.yml up -d
```

#### Kubernetes Deployment

Using the new deployment script (recommended):
```bash
./scripts/infrastructure/deploy-nemo-data-designer-k8s.sh
```

Or manually with Helm:
```bash
# Add NVIDIA Helm repository
helm repo add nvidia https://helm.ngc.nvidia.com/nvidia
helm repo update

# Install data designer
helm install nemo-data-designer nvidia/nemo-data-designer
```

Or using the provided Kubernetes manifest:
```bash
kubectl apply -f ai/deployment/nemo-data-designer-k8s.yaml
```

See [NVIDIA Documentation](https://docs.nvidia.com/nemo/microservices/latest/set-up/deploy-as-microservices/data-designer/parent-chart.html) for detailed deployment instructions.

## Configuration Reference

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NVIDIA_API_KEY` | Your NVIDIA API key | - | Yes |
| `NEMO_DATA_DESIGNER_BASE_URL` | API base URL (local or cluster) | `http://localhost:8000` | Yes |
| `NEMO_DATA_DESIGNER_TIMEOUT` | Request timeout (seconds) | `300` | No |
| `NEMO_DATA_DESIGNER_MAX_RETRIES` | Max retry attempts | `3` | No |
| `NEMO_DATA_DESIGNER_BATCH_SIZE` | Batch size for processing | `1000` | No |

**Note**: `NEMO_DATA_DESIGNER_BASE_URL` should be:
- `http://localhost:8000` for local Docker Compose deployment
- Your cluster ingress URL for Kubernetes (e.g., `https://nemo-data-designer.your-cluster-domain.com`)

### Custom Configuration

```python
from ai.data_designer import NeMoDataDesignerService, DataDesignerConfig

config = DataDesignerConfig(
    base_url="https://nemo-data-designer.your-cluster-domain.com",
    api_key="your-api-key",
    timeout=600,  # 10 minutes
    max_retries=5,
    batch_size=500,
)

service = NeMoDataDesignerService(config=config)
```

## Troubleshooting

### Issue: "NVIDIA_API_KEY environment variable is required"

**Solution**: Set the `NVIDIA_API_KEY` environment variable:
```bash
export NVIDIA_API_KEY="your-api-key-here"
```

Or add it to your `.env` file.

### Issue: "ImportError: nemo-microservices[data-designer] is not installed"

**Solution**: Install the package:
```bash
uv pip install 'nemo-microservices[data-designer]'
```

### Issue: Timeout errors when generating large datasets

**Solution**: 
1. Increase the timeout:
   ```bash
   export NEMO_DATA_DESIGNER_TIMEOUT=600
   ```
2. Generate in smaller batches:
   ```python
   # Generate 1000 samples at a time
   for i in range(10):
       result = service.generate_therapeutic_dataset(num_samples=1000)
   ```

### Issue: Rate limiting errors

**Solution**:
1. Implement retry logic with exponential backoff
2. Reduce batch size
3. Add delays between requests
4. Consider self-hosting for production

## Best Practices

1. **Start Small**: Begin with small datasets (100-1000 samples) to test your configuration
2. **Use Appropriate Timeouts**: Set timeouts based on expected dataset size
3. **Batch Processing**: For large datasets, generate in batches
4. **Validate Data**: Always validate generated data before using in production
5. **Monitor Costs**: Be aware of API usage and costs if using cloud API
6. **Cache Results**: Cache generated datasets to avoid regenerating
7. **Version Control**: Track dataset versions and configurations

## Resources

- [NVIDIA NeMo Data Designer Documentation](https://docs.nvidia.com/nemo/microservices/latest/set-up/deploy-as-microservices/data-designer/parent-chart.html)
- [NVIDIA Build Platform](https://build.nvidia.com/nemo/data-designer)
- [NeMo Microservices SDK](https://github.com/NVIDIA/NeMo-Microservices)
- [API Reference](./ai/data_designer/README.md)

## Support

For issues specific to this integration:
- Check the [troubleshooting section](#troubleshooting) above
- Review the example scripts in `ai/data_designer/examples.py`
- Check project documentation

For issues with NVIDIA NeMo Data Designer:
- Visit [NVIDIA NeMo Documentation](https://docs.nvidia.com/nemo/)
- Check [NVIDIA Developer Forums](https://forums.developer.nvidia.com/)

