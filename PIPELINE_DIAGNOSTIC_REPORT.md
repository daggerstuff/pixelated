# Azure Pipelines Diagnostic Report

**Generated:** $(date)  
**Pipeline File:** `azure-pipelines.yml`  
**Total Lines:** 1,227

## 🔍 Executive Summary

This report analyzes the Azure Pipelines configuration for potential issues, configuration problems, and areas for improvement. The pipeline appears well-structured but has several areas that could cause failures or unexpected behavior.

## ⚠️ Critical Issues

### 1. **Timeout Configuration Type Mismatch** (Line 144)

**Issue:**
```yaml
timeoutInMinutes: "30"  # ❌ String instead of number
```

**Problem:** While Azure DevOps might accept this, the value should be a number according to YAML schema.

**Fix:**
```yaml
timeoutInMinutes: 30  # ✅ Number
```

**Location:** Line 144 in `BuildApplication` job

---

### 2. **Build Metadata Capture May Fail Silently** (Lines 228-264)

**Issue:** The build metadata capture step has `continueOnError: "true"`, which means failures won't stop the pipeline but could hide important issues.

**Problems:**
- Docker image may not be available locally after Docker@2 task completes
- `docker inspect` command might fail if image is only in registry, not local cache
- No validation that metadata file was actually created before publishing

**Recommendations:**
1. Add explicit validation that metadata file exists
2. Use registry API or Docker manifest to get digest instead of local inspect
3. Consider making this step fail the build if metadata is critical

**Current Code:**
```yaml
- script: |
    # ... metadata capture ...
  continueOnError: "true"
```

**Suggested Improvement:**
```yaml
- script: |
    # Validate metadata file exists and has content
    if [ ! -f "$METADATA_FILE" ] || [ ! -s "$METADATA_FILE" ]; then
      echo "❌ Metadata file missing or empty"
      exit 1
    fi
```

---

### 3. **Docker Permission Workarounds Suggest Agent Issues** (Lines 151-211, 275-335)

**Issue:** Extensive Docker permission fix scripts in multiple stages suggest underlying agent configuration problems.

**Problems:**
- Scripts attempt to fix permissions at runtime, which is unreliable
- Uses `sudo` operations that may not work on Microsoft-hosted agents
- Multiple identical scripts duplicated across stages

**Recommendations:**
1. **For Microsoft-hosted agents:** Docker should work out-of-the-box. If it doesn't, there's a service issue.
2. **For self-hosted agents:** Fix Docker permissions permanently on the agent machine:
   ```bash
   sudo usermod -aG docker azureuser
   sudo systemctl restart docker
   ```

3. **Simplify the script** - Remove complex permission fixing and fail fast if Docker isn't accessible

---

### 4. **Sentry Release Creation May Fail Silently** (Lines 438-549, 621-693)

**Issue:** Both staging and production Sentry release steps exit with `exit 0` on errors, hiding failures.

**Problems:**
- Token authentication failures → exit 0 (silent)
- Project not found → exit 0 (silent)  
- Release creation failures → exit 0 (silent)

**Current Behavior:**
```bash
if ! sentry-cli info; then
  echo "❌ Failed to verify Sentry authentication"
  exit 0  # ⚠️ Silently continues
fi
```

**Recommendations:**
- Log errors to Azure DevOps as warnings/errors: `##vso[task.logissue type=error]...`
- Consider making Sentry releases optional but visible when they fail
- Add telemetry/logging for monitoring

---

### 5. **Trivy Installation Uses Deprecated apt-key** (Lines 343-353)

**Issue:** Uses deprecated `apt-key add` which is being phased out.

**Problems:**
- `apt-key` is deprecated and will be removed in future Debian/Ubuntu versions
- Current approach might fail on newer Ubuntu versions

**Current Code:**
```bash
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
```

**Recommended Fix:**
```bash
# Use modern approach with trusted GPG keyring
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | \
  sudo gpg --dearmor -o /usr/share/keyrings/trivy.gpg

echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] \
  https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | \
  sudo tee -a /etc/apt/sources.list.d/trivy.list
```

---

## ⚠️ High Priority Issues

### 6. **Variable Reference Issues**

**Missing Variable Validation:**
- No validation that required variables from `pixelated-pipeline-variables` group exist
- Pipeline will fail at runtime if variables are missing, but error messages may be unclear

**Potential Missing Variables:**
- `NODE_VERSION` - Used but may not be defined in variable group
- `AZURE_CONTAINER_REGISTRY` - Required for Docker registry
- `IMAGE_REPOSITORY` - Required for image naming
- `KUBE_NAMESPACE` - Required for deployments
- `SENTRY_AUTH_TOKEN` - Required for Sentry releases

**Recommendation:** Add validation step early in pipeline:
```yaml
- script: |
    required_vars=("NODE_VERSION" "AZURE_CONTAINER_REGISTRY" "IMAGE_REPOSITORY")
    missing_vars=()
    for var in "${required_vars[@]}"; do
      if [ -z "${!var}" ]; then
        missing_vars+=("$var")
      fi
    done
    if [ ${#missing_vars[@]} -gt 0 ]; then
      echo "❌ Missing required variables: ${missing_vars[*]}"
      exit 1
    fi
  displayName: "Validate Required Variables"
```

---

### 7. **Production URL Mismatch** (Line 79)

**Issue:** Production URL variable doesn't match documentation.

**Current:**
```yaml
- name: PRODUCTION_URL
  value: "https://pixelatedempathy.com"
```

**Documentation says:** `https://azure.pixelatedempathy.tech` (from variable-setup.md)

**Fix:** Align with documentation or update documentation.

---

### 8. **Health Check Stage Missing Checkout** (Lines 696-723)

**Issue:** HealthCheck stage doesn't have `checkout: self`, so if any scripts or configs are needed, they won't be available.

**Current:** No checkout step

**Recommendation:** Add checkout if any files are needed, or remove if not required.

---

## ⚠️ Medium Priority Issues

### 9. **E2E Test Stage Missing pnpm Setup** (Lines 862-988)

**Issue:** E2ETest stage installs Playwright but doesn't enable pnpm or install dependencies.

**Missing Steps:**
- `corepack enable pnpm`
- `pnpm install --frozen-lockfile`

**Fix:** Add dependency installation before Playwright install:
```yaml
- script: |
    corepack enable pnpm
    pnpm install --frozen-lockfile
  displayName: "Install Dependencies"
```

---

### 10. **OVH Ollama Build Stage Registry Detection** (Line 1170)

**Issue:** Registry detection uses fragile parsing:

```bash
REGISTRY=$(ovhai registry list | tail -n +2 | awk '{print $NF}' || echo "")
```

**Problems:**
- Parsing assumes specific output format
- No validation that registry URL is valid
- Different approach than training stage (which uses JSON parsing)

**Recommendation:** Use consistent JSON parsing like training stage:
```bash
REGISTRY=$(ovhai registry list --json | jq -r '.[0].url' || echo "")
```

---

### 11. **Conditional Logic for OVH Stages** (Lines 996, 1134)

**Issue:** Conditions check variables that may not exist in all pipeline runs.

**Current:**
```yaml
condition: eq(variables['TRIGGER_AI_TRAINING'], 'true')
```

**Problem:** If variable is not set, condition might fail or behave unexpectedly.

**Recommendation:** Add explicit defaults:
```yaml
condition: and(succeeded(), eq(coalesce(variables['TRIGGER_AI_TRAINING'], 'false'), 'true'))
```

---

## 📊 Configuration Analysis

### Variable Dependencies

**Variables from `pixelated-pipeline-variables` group (required):**
- ✅ `NODE_VERSION` - Node.js version
- ✅ `AZURE_CONTAINER_REGISTRY` - ACR name
- ✅ `AZURE_RESOURCE_GROUP` - Resource group
- ✅ `AZURE_SUBSCRIPTION` - Service connection name
- ✅ `AKS_CLUSTER_NAME` - AKS cluster name
- ✅ `IMAGE_REPOSITORY` - Docker image repository name
- ✅ `KUBE_NAMESPACE` - Kubernetes namespace (staging)
- ✅ `KUBE_NAMESPACE_PROD` - Kubernetes namespace (production)
- ⚠️ `SENTRY_AUTH_TOKEN` - Sentry token (if using Sentry)
- ⚠️ `OVH_AI_TOKEN` - OVH token (if using OVH stages)
- ⚠️ `WANDB_API_KEY` - Weights & Biases key (if using training)

### Stage Dependencies

```
Validate → Build → Security → DeployStaging → DeployProduction
                                          ↓
                                    HealthCheck
                                          ↓
                              PerformanceTest, E2ETest
```

**Potential Issues:**
- PerformanceTest and E2ETest both depend on DeployStaging but not on HealthCheck (though HealthCheck is in their dependsOn)
- DeployProduction depends on DeployStaging but should also wait for tests to pass

---

## 🔧 Recommended Fixes Priority

### Immediate (Before Next Run)

1. ✅ Fix `timeoutInMinutes` type (string → number)
2. ✅ Add variable validation step
3. ✅ Add missing pnpm setup in E2E stage
4. ✅ Fix production URL mismatch
5. ✅ Update Trivy installation to modern GPG approach

### Short Term (This Week)

6. ✅ Simplify Docker permission scripts (fail fast instead of fixing)
7. ✅ Improve Sentry error logging (use Azure DevOps logging commands)
8. ✅ Add checkout to HealthCheck stage if needed
9. ✅ Standardize OVH registry detection (use JSON parsing)

### Medium Term (This Month)

10. ✅ Make build metadata capture more robust
11. ✅ Add telemetry for silent failures (Sentry, OVH)
12. ✅ Review and consolidate duplicate scripts
13. ✅ Add pipeline-level timeout

---

## 📝 Testing Recommendations

### Test Scenarios

1. **Missing Variables:** Run pipeline with variable group missing to verify error messages
2. **Docker Failure:** Test behavior when Docker is unavailable
3. **Sentry Failure:** Test behavior when Sentry token is invalid
4. **Partial Failures:** Test `continueOnError` scenarios
5. **OVH Stages:** Test manual trigger conditions

### Monitoring

Add pipeline annotations for better visibility:
```yaml
- script: |
    echo "##vso[task.logissue type=warning]Performance degradation detected"
    echo "##vso[task.complete result=SucceededWithIssues;]Build completed with warnings"
```

---

## 🎯 Success Metrics

Track these metrics to measure pipeline health:

- **Build Success Rate:** Target > 95%
- **Average Build Time:** Track and optimize slow stages
- **Silent Failure Rate:** Monitor `continueOnError` usage
- **Docker Permission Fixes:** Should be 0% on Microsoft-hosted agents
- **Variable Missing Errors:** Should be caught by validation

---

## 📚 Related Documentation

- Variable Setup: `docs/azure-devops/variable-setup.md`
- Pipeline Variables: Azure DevOps → Pipelines → Library → Variable Groups
- Known Issues Memory: Retrieved via `brv retrieve --query "azure pipeline issues errors"`

---

## 🔄 Next Steps

1. **Review this report** with DevOps team
2. **Prioritize fixes** based on current failure patterns
3. **Create tickets** for high-priority issues
4. **Test fixes** in a feature branch pipeline
5. **Update documentation** as issues are resolved

---

**Report Generated:** Using automated analysis of `azure-pipelines.yml`  
**Analysis Tool:** AI-assisted code review  
**Last Updated:** 2025-11-30

