## Deployment - Single Source of Truth (Civo + Flux)

This repository now uses a single deployment path targeting Civo Kubernetes, managed via FluxCD GitOps.

- Center of attention: `clusters/pixelkube/`
  - Flux system: `clusters/pixelkube/flux-system/`
  - App manifests: `clusters/pixelkube/pixelated/`

All legacy deployment paths (Terraform, Helm charts, standalone `k8s/` manifests, alternate Dockerfiles) have been removed to avoid divergence.

### How to deploy
1) Bootstrap Flux on the Civo cluster (one time), then apply:
   - `clusters/pixelkube/flux-system/kustomization.yaml`
2) Flux syncs from `master` and applies `./clusters/pixelkube/pixelated`.

### Build image
Build using the root `Dockerfile` (or `Dockerfile.production`):
```bash
docker build -t pixelatedempathy/pixelated-empathy:latest .
```
Push to your registry and update the image tag in `clusters/pixelkube/pixelated/deployment.yaml` if needed.

### Notes
- Only Civo Kubernetes is supported now.
- Do not use Terraform, Helm, or `k8s/` ad-hoc manifests.

