# Azure Pipelines Update for Project Reorganization

## Changes Made

The Azure DevOps pipeline (`ci-cd/azure-pipelines.yml`) has been updated to reference the new file locations after the project root reorganization.

### Updated References

#### 1. Docker Build Step
**File:** `ci-cd/azure-pipelines.yml` (Line 467)

**Change:**
```yaml
# Before
Dockerfile: "Dockerfile"

# After
Dockerfile: "docker/Dockerfile"
```

**Impact:** Docker image builds now reference the Dockerfile in its new location at `docker/Dockerfile`.

### Pipeline Structure

The pipeline now correctly references:
- Build context: `.` (root, unchanged)
- Dockerfile location: `docker/Dockerfile` (updated)
- Config files: No hardcoded references in pipeline (good practice)
- Kubernetes manifests: Located in `k8s/azure/` (unchanged)

### No Additional Changes Required

The following pipeline references are **already correct**:
- Ollama Dockerfile: `ai/ovh/Dockerfile.ollama` (correct location)
- Training Dockerfile: `ai/ovh/Dockerfile.training` (correct location)
- Kubernetes manifests: `k8s/azure/*.yaml` (unchanged)
- Configuration variables: All in variable groups (no hardcoded paths)

### Testing the Changes

The pipeline should now:
1. ✅ Build Docker images from `docker/Dockerfile`
2. ✅ Deploy using existing Kubernetes manifests
3. ✅ Reference all configuration through variable groups (no breaking changes)

### Next Steps

- Run a test pipeline execution to verify Docker build succeeds
- Monitor the build logs for any other file path issues
- No additional configuration changes needed in Azure DevOps web UI

### Related Files

For context on the reorganization, see:
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - Complete structure reference
- [ORGANIZATION_GUIDE.md](ORGANIZATION_GUIDE.md) - Detailed changes and checklist
