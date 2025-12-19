# How to Interact with Ollama Server

## Overview

Ollama is deployed in Kubernetes and accessible via:
- **HTTPS**: `https://ollama.pixelatedempathy.com` (via Ingress)
- **Port-forward**: Local access via `kubectl port-forward`
- **Direct API**: REST API on port 11434

## Quick Access Methods

### 1. Via HTTPS (Production Access)

```bash
# Test if Ollama is accessible
curl https://ollama.pixelatedempathy.com/api/tags

# Or in browser
open https://ollama.pixelatedempathy.com/api/tags
```

**Note**: TLS certificates are automatically managed by cert-manager. If certificates are still provisioning, you may see a warning.

### 2. Via Port-Forward (Local Development)

```bash
# Set kubeconfig
export KUBECONFIG=./terraform/kubeconfig-staging.config

# Port-forward Ollama service to localhost
kubectl port-forward -n ollama service/ollama 11434:11434

# In another terminal, test it
curl http://localhost:11434/api/tags
```

### 3. Via kubectl exec (Direct Pod Access)

```bash
# Get pod name
kubectl get pods -n ollama

# Exec into the pod
kubectl exec -it -n ollama deployment/ollama -- /bin/sh

# Inside the pod, you can use ollama CLI directly
ollama list
ollama pull llama2
ollama run llama2
```

## Using the Ollama API

### Check Available Models

```bash
# Via HTTPS
curl https://ollama.pixelatedempathy.com/api/tags

# Via port-forward
curl http://localhost:11434/api/tags
```

### Pull a Model

```bash
# Pull a model (e.g., llama2)
curl -X POST https://ollama.pixelatedempathy.com/api/pull \
  -H "Content-Type: application/json" \
  -d '{"name": "llama2"}'

# Or via port-forward
curl -X POST http://localhost:11434/api/pull \
  -H "Content-Type: application/json" \
  -d '{"name": "llama2"}'
```

**Note**: Model downloads can be large (several GB). The first pull may take time.

### Generate Text (Chat Completion)

```bash
# Simple completion
curl -X POST https://ollama.pixelatedempathy.com/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama2",
    "prompt": "Why is the sky blue?",
    "stream": false
  }'

# Streaming response
curl -X POST https://ollama.pixelatedempathy.com/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama2",
    "prompt": "Explain quantum computing in simple terms",
    "stream": true
  }'
```

### Chat API (Conversational)

```bash
curl -X POST https://ollama.pixelatedempathy.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama2",
    "messages": [
      {
        "role": "user",
        "content": "What is machine learning?"
      }
    ],
    "stream": false
  }'
```

### List Models

```bash
curl https://ollama.pixelatedempathy.com/api/tags
```

### Show Model Info

```bash
curl -X POST https://ollama.pixelatedempathy.com/api/show \
  -H "Content-Type: application/json" \
  -d '{"name": "llama2"}'
```

## Using Ollama CLI (Inside Pod)

If you need to use the Ollama CLI directly:

```bash
# Exec into the pod
kubectl exec -it -n ollama deployment/ollama -- /bin/sh

# Inside the pod
ollama list                    # List installed models
ollama pull llama2             # Pull a model
ollama pull mistral            # Pull another model
ollama run llama2              # Run interactive chat
ollama show llama2             # Show model info
ollama rm llama2               # Remove a model
```

## Python Client Example

```python
import requests
import json

# Ollama API endpoint
OLLAMA_URL = "https://ollama.pixelatedempathy.com"
# Or for local port-forward: "http://localhost:11434"

# Generate text
response = requests.post(
    f"{OLLAMA_URL}/api/generate",
    json={
        "model": "llama2",
        "prompt": "Explain AI in one sentence",
        "stream": False
    }
)

result = response.json()
print(result["response"])

# Chat API
response = requests.post(
    f"{OLLAMA_URL}/api/chat",
    json={
        "model": "llama2",
        "messages": [
            {"role": "user", "content": "Hello!"}
        ],
        "stream": False
    }
)

result = response.json()
print(result["message"]["content"])
```

## JavaScript/TypeScript Client Example

```typescript
// Using fetch
const ollamaUrl = 'https://ollama.pixelatedempathy.com';

// Generate text
const response = await fetch(`${ollamaUrl}/api/generate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama2',
    prompt: 'Explain TypeScript in one sentence',
    stream: false
  })
});

const result = await response.json();
console.log(result.response);

// Chat API
const chatResponse = await fetch(`${ollamaUrl}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama2',
    messages: [
      { role: 'user', content: 'Hello!' }
    ],
    stream: false
  })
});

const chatResult = await chatResponse.json();
console.log(chatResult.message.content);
```

## Checking Ollama Status

```bash
# Check if Ollama pod is running
kubectl get pods -n ollama

# Check Ollama logs
kubectl logs -n ollama deployment/ollama --tail=50

# Check service
kubectl get svc -n ollama

# Check ingress
kubectl get ingress -n ollama

# Test health endpoint
curl https://ollama.pixelatedempathy.com/api/tags
```

## Troubleshooting

### Ollama Not Responding

```bash
# Check pod status
kubectl describe pod -n ollama -l app=ollama

# Check logs
kubectl logs -n ollama deployment/ollama

# Restart deployment
kubectl rollout restart deployment/ollama -n ollama
```

### Model Download Issues

- Models are stored in persistent volume (`/root/.ollama` in the pod)
- First model pull may take several minutes depending on model size
- Check pod logs for download progress: `kubectl logs -f -n ollama deployment/ollama`

### Connection Issues

```bash
# Verify ingress is working
kubectl get ingress -n ollama

# Check if DNS is resolving
nslookup ollama.pixelatedempathy.com

# Test direct service access (from within cluster)
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://ollama.ollama.svc.cluster.local:11434/api/tags
```

## Available Models

Popular models you can pull:

- `llama2` - Meta's Llama 2 (7B, 13B, 70B variants)
- `mistral` - Mistral AI model
- `codellama` - Code-focused Llama variant
- `phi` - Microsoft's Phi model
- `neural-chat` - Intel's neural chat model
- `starling-lm` - Starling language model

To see all available models: https://ollama.com/library

## Resource Limits

Current Ollama deployment has:
- **Memory**: 8-16 Gi
- **CPU**: 2-4 cores
- **Storage**: 100 Gi persistent volume

Adjust these in `k8s/azure/ollama-deployment.yaml` if needed.

## Security Notes

- Ollama is configured with `OLLAMA_ORIGINS: "*"` (allows all origins)
- For production, consider restricting origins
- TLS is handled by cert-manager automatically
- Access is via ingress (not directly exposed)

## Next Steps

1. **Pull your first model**: `curl -X POST https://ollama.pixelatedempathy.com/api/pull -d '{"name":"llama2"}'`
2. **Test generation**: Use the examples above
3. **Integrate with your app**: Use the Python/JavaScript examples
4. **Monitor usage**: Check logs and resource usage
