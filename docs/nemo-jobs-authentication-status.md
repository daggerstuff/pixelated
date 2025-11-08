# NeMo Data Designer Jobs Authentication - Current Status

## Issue

Jobs-controller requires Docker registry authentication to execute jobs (for datasets >10 samples). Currently, authentication is failing because:

1. **Jobs-controller** connects to a **Docker-in-Docker** service
2. The Docker-in-Docker service needs credentials to pull images from `nvcr.io`
3. The authentication isn't being passed correctly to the Docker daemon

## Current Status

✅ **Preview API works** (≤10 samples) - No job execution needed  
❌ **Jobs API fails** (>10 samples) - Requires Docker registry authentication

## Workaround

For now, use the **Preview API** for datasets up to 10 samples. This works perfectly and is fast (~0.3 seconds).

```python
from ai.data_designer.service import NeMoDataDesignerService

service = NeMoDataDesignerService()
# This uses Preview API (works without job execution)
result = service.generate_therapeutic_dataset(num_samples=10)
```

## Solution (Requires Manual Setup)

To enable jobs for larger datasets, you need to:

1. **Ensure NIM_API_KEY is in .env file:**
   ```bash
   ssh vivi@212.2.244.60
   cd ~/nemo-microservices/nemo-microservices-quickstart_v25.10
   echo "NIM_API_KEY=your-nvidia-api-key" >> .env
   ```

2. **Configure Docker-in-Docker service** to use the credentials
   - This may require custom configuration of the Docker service
   - Or mounting Docker credentials into the Docker-in-Docker container

3. **Restart services:**
   ```bash
   docker compose restart jobs-controller docker
   ```

## References

- NeMo Microservices documentation
- Docker-in-Docker authentication setup
- NVIDIA NGC registry authentication

