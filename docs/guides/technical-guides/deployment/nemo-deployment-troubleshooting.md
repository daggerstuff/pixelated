# NeMo Data Designer Deployment Troubleshooting

## Issue: Download Failed (0-byte file)

**Problem**: The automated download creates a 0-byte file and stops.

**Cause**: NGC (NVIDIA GPU Cloud) requires authentication to download resources. Direct curl/wget downloads don't work without proper authentication.

## Solutions

### Solution 1: Use NGC CLI (Recommended)

The easiest way is to install NGC CLI on the remote server:

```bash
# Option A: Use the automated script
./scripts/install-ngc-cli-and-deploy.sh

# Option B: Manual installation
ssh vivi@212.2.244.60
pip3 install --user nvidia-pyindex ngcsdk
export PATH=$HOME/.local/bin:$PATH
ngc config set  # Enter your NGC API key when prompted
```

**Get your NGC API key:**
1. Visit https://catalog.ngc.nvidia.com
2. Sign in with your NVIDIA account
3. Go to your profile → Setup → Generate API Key
4. Copy the API key (this is different from your NVIDIA_API_KEY for build.nvidia.com)

### Solution 2: Manual Download

1. **Download from NGC Catalog:**
   - Visit: https://catalog.ngc.nvidia.com/orgs/nvidia/teams/nemo/resources/nemo-microservices-quickstart
   - Sign in with your NVIDIA account
   - Download version 25.10 (or latest)
   - Save as `nemo-microservices-quickstart_v25.10.zip`

2. **Upload to remote server:**
   ```bash
   scp nemo-microservices-quickstart_v25.10.zip vivi@212.2.244.60:~/nemo-microservices/
   ```

3. **SSH into server and extract:**
   ```bash
   ssh vivi@212.2.244.60
   cd ~/nemo-microservices
   unzip nemo-microservices-quickstart_v25.10.zip
   cd nemo-microservices-quickstart_v25.10
   ```

4. **Deploy the service:**
   ```bash
   export NEMO_MICROSERVICES_IMAGE_REGISTRY="nvcr.io/nvidia/nemo-microservices"
   export NEMO_MICROSERVICES_IMAGE_TAG="25.10"
   export NIM_API_KEY="your-nvidia-api-key-from-build.nvidia.com"
   
   # Login to Docker registry
   echo $NIM_API_KEY | docker login nvcr.io -u '$oauthtoken' --password-stdin
   
   # Start the service
   docker compose --profile data-designer up -d
   ```

### Solution 3: Check Network/Firewall

If downloads are blocked:

```bash
# Test connectivity
ssh vivi@212.2.244.60 'curl -I https://catalog.ngc.nvidia.com'

# Check if outbound connections are allowed
ssh vivi@212.2.244.60 'curl -I https://api.ngc.nvidia.com'
```

## Common Issues

### Issue: "NGC CLI not found"

**Solution:**
```bash
# Install NGC CLI
pip3 install --user nvidia-pyindex ngcsdk

# Add to PATH
export PATH=$HOME/.local/bin:$PATH
echo 'export PATH=$HOME/.local/bin:$PATH' >> ~/.bashrc
```

### Issue: "Authentication failed"

**Solution:**
- Make sure you're using the correct API key
- NGC API key (from catalog.ngc.nvidia.com) is different from NVIDIA_API_KEY (from build.nvidia.com)
- Verify your API key: `ngc config get`

### Issue: "Docker login failed"

**Solution:**
- Use your NVIDIA_API_KEY (from build.nvidia.com) for Docker registry login
- Make sure the API key is correct
- Try: `echo $NVIDIA_API_KEY | docker login nvcr.io -u '$oauthtoken' --password-stdin`

### Issue: "Service not starting"

**Solution:**
```bash
# Check logs
ssh vivi@212.2.244.60 'cd ~/nemo-microservices/nemo-microservices-quickstart_* && docker compose logs'

# Check system resources
ssh vivi@212.2.244.60 'free -h && df -h'

# Check Docker status
ssh vivi@212.2.244.60 'docker ps -a'
```

## Quick Fix Commands

```bash
# Clean up and retry
ssh vivi@212.2.244.60 'cd ~/nemo-microservices && rm -rf nemo-microservices-quickstart_* quickstart.zip'

# Install NGC CLI and retry
./scripts/install-ngc-cli-and-deploy.sh

# Or use manual download method
./scripts/download-nemo-quickstart-manual.sh
```

## Getting Help

If you continue to have issues:

1. Check the logs: `ssh vivi@212.2.244.60 'cd ~/nemo-microservices && docker compose logs'`
2. Verify your API keys are correct
3. Check network connectivity
4. Review the [official documentation](https://docs.nvidia.com/nemo/microservices/latest/design-synthetic-data-from-scratch-or-seeds/index.html)

