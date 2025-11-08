# NeMo Data Designer Jobs Authentication Setup

## Issue

The jobs-controller requires Docker registry authentication to pull images for job execution. Currently, jobs fail with a 401 Unauthorized error because the Docker-in-Docker service doesn't have access to NGC registry credentials.

## Solution

The jobs-controller needs the `NIM_API_KEY` environment variable to authenticate to the NVIDIA container registry. This key should be the same as your `NVIDIA_API_KEY` from build.nvidia.com.

## Setup Steps

### 1. Create `.env` file on remote server

On the remote server, create a `.env` file in the quickstart directory:

```bash
ssh vivi@212.2.244.60
cd ~/nemo-microservices/nemo-microservices-quickstart_v25.10

cat > .env << 'EOF'
NEMO_MICROSERVICES_IMAGE_REGISTRY=nvcr.io/nvidia/nemo-microservices
NEMO_MICROSERVICES_IMAGE_TAG=25.10
NIM_API_KEY=your-nvidia-api-key-here
NVIDIA_API_KEY=your-nvidia-api-key-here
EOF
```

### 2. Restart services

```bash
docker compose down jobs-controller
docker compose up -d jobs-controller
```

### 3. Verify authentication

Check the jobs-controller logs:

```bash
docker compose logs jobs-controller --tail 20 | grep -i "auth\|error"
```

You should **not** see 401 Unauthorized errors.

## Alternative: Manual Docker Login in Container

If the above doesn't work, you may need to manually configure Docker authentication within the Docker-in-Docker service. However, this is more complex and may require custom configuration.

## Note

- The preview API (≤10 samples) works without job execution and doesn't require this setup
- For larger datasets (>10 samples), jobs are required, which need proper authentication
- The `NIM_API_KEY` must be the same as your `NVIDIA_API_KEY` from build.nvidia.com

## Troubleshooting

If authentication still fails:

1. **Verify API key is correct:**
   ```bash
   echo $NIM_API_KEY | docker login nvcr.io -u '$oauthtoken' --password-stdin
   ```

2. **Check jobs-controller environment:**
   ```bash
   docker compose exec jobs-controller env | grep NIM
   ```

3. **Check Docker service logs:**
   ```bash
   docker compose logs docker --tail 20
   ```

4. **Restart all services:**
   ```bash
   docker compose restart
   ```

