# VPA Optimization Report

**Generated:** 2025-11-09  
**Cluster:** pixelated-empathy-civo  
**Analysis Date:** 2025-11-09

---

## Executive Summary

VPA has been collecting usage data and providing recommendations. This report analyzes current resource requests, VPA recommendations, and actual usage to identify optimization opportunities.

### Key Findings

1. **Cert-Manager pods** need memory increase (64Mi → 100Mi)
2. **Metoro Exporter** resources are well-aligned with recommendations
3. **Actual usage** is significantly lower than requests, indicating potential for further optimization
4. **VPA constraints** (minAllowed) are preventing more aggressive optimization

---

## Detailed Analysis

### 1. Cert-Manager Controller

**Current Configuration:**
- CPU Request: 50m
- Memory Request: 64Mi
- CPU Limit: 200m
- Memory Limit: 128Mi

**Actual Usage:**
- CPU: 1-2m (2-4% of request)
- Memory: 55Mi (86% of request)

**VPA Recommendations:**
- Target CPU: 50m (matches current)
- Target Memory: 100Mi (56% increase needed)
- Uncapped CPU: 15m (70% lower than current)
- Uncapped Memory: 100Mi

**Analysis:**
- ✅ CPU request matches VPA recommendation (constrained by minAllowed: 50m)
- ⚠️ Memory request is below VPA recommendation
- 📊 Actual CPU usage (1-2m) is much lower than request (50m), but VPA recommends 50m due to minAllowed constraint
- 📊 Actual memory usage (55Mi) is close to request (64Mi), but VPA recommends 100Mi for safety margin

**Recommendation:**
1. **Increase memory request to 100Mi** (matches VPA target)
2. **Keep CPU at 50m** (matches VPA target, respects minAllowed)
3. **Consider reducing minAllowed CPU to 15m** if you want more aggressive optimization (requires VPA config update)

---

### 2. Cert-Manager CA Injector

**Current Configuration:**
- CPU Request: 50m
- Memory Request: 64Mi
- CPU Limit: 200m
- Memory Limit: 128Mi

**Actual Usage:**
- CPU: 2m (4% of request)
- Memory: 31Mi (48% of request)

**VPA Recommendations:**
- Target CPU: 50m (matches current)
- Target Memory: 100Mi (56% increase needed)
- Uncapped CPU: 15m (70% lower than current)
- Uncapped Memory: 100Mi

**Analysis:**
- ✅ CPU request matches VPA recommendation
- ⚠️ Memory request is below VPA recommendation
- 📊 Actual CPU usage (2m) is much lower than request
- 📊 Actual memory usage (31Mi) is well below request (64Mi) and recommendation (100Mi)

**Recommendation:**
1. **Increase memory request to 100Mi** (matches VPA target, provides safety margin)
2. **Keep CPU at 50m** (matches VPA target)

---

### 3. Cert-Manager Webhook

**Current Configuration:**
- CPU Request: 50m
- Memory Request: 64Mi
- CPU Limit: 200m
- Memory Limit: 128Mi

**Actual Usage:**
- CPU: 1m (2% of request)
- Memory: 31Mi (48% of request)

**VPA Recommendations:**
- Target CPU: 50m (matches current)
- Target Memory: 100Mi (56% increase needed)
- Uncapped CPU: 15m (70% lower than current)
- Uncapped Memory: 100Mi

**Analysis:**
- ✅ CPU request matches VPA recommendation
- ⚠️ Memory request is below VPA recommendation
- 📊 Actual CPU usage (1m) is very low
- 📊 Actual memory usage (31Mi) is well below request

**Recommendation:**
1. **Increase memory request to 100Mi** (matches VPA target)
2. **Keep CPU at 50m** (matches VPA target)

---

### 4. Metoro Exporter

**Current Configuration:**
- CPU Request: 50m
- Memory Request: 128Mi
- CPU Limit: 200m
- Memory Limit: 512Mi

**Actual Usage:**
- CPU: 8m (16% of request)
- Memory: 100Mi (78% of request)

**VPA Recommendations:**
- Target CPU: 50m (matches current)
- Target Memory: 128Mi (matches current)
- Uncapped CPU: 23m (54% lower than current)
- Uncapped Memory: 120Mi (6% lower than current)

**Analysis:**
- ✅ CPU request matches VPA recommendation
- ✅ Memory request matches VPA recommendation
- 📊 Actual CPU usage (8m) is lower than request but higher than uncapped (23m)
- 📊 Actual memory usage (100Mi) is close to request (128Mi) and recommendation

**Recommendation:**
1. **Keep current resources** (already optimized)
2. **Consider monitoring** for potential future optimization opportunities

---

## Optimization Opportunities

### Immediate Actions (Low Risk)

#### 1. Increase Cert-Manager Memory Requests

**Action:** Update Cert-Manager deployments to use 100Mi memory requests (from 64Mi)

**Impact:**
- Better safety margin for memory usage
- Aligns with VPA recommendations
- Low risk (memory is not currently constrained)

**Estimated Resource Impact:**
- Memory: +108Mi total (36Mi per pod × 3 pods)
- CPU: No change

**Implementation:**
```bash
# Update cert-manager controller
kubectl patch deployment cert-manager -n cert-manager --type='json' -p='[
  {
    "op": "replace",
    "path": "/spec/template/spec/containers/0/resources/requests/memory",
    "value": "100Mi"
  }
]'

# Update cert-manager cainjector
kubectl patch deployment cert-manager-cainjector -n cert-manager --type='json' -p='[
  {
    "op": "replace",
    "path": "/spec/template/spec/containers/0/resources/requests/memory",
    "value": "100Mi"
  }
]'

# Update cert-manager webhook
kubectl patch deployment cert-manager-webhook -n cert-manager --type='json' -p='[
  {
    "op": "replace",
    "path": "/spec/template/spec/containers/0/resources/requests/memory",
    "value": "100Mi"
  }
]'
```

### Future Considerations (Medium Risk)

#### 2. Reduce VPA minAllowed CPU Constraints

**Action:** Update VPA configurations to allow lower CPU requests (reduce minAllowed from 50m to 15m)

**Impact:**
- Potential CPU savings: 105m total (35m per pod × 3 pods)
- More aggressive optimization
- Higher risk (need to monitor for CPU spikes)

**Considerations:**
- Cert-Manager is critical infrastructure
- CPU spikes may occur during certificate operations
- Need to monitor closely after changes

**Implementation:**
Update VPA configurations in `manifests/vpa/` to reduce minAllowed CPU:
```yaml
resourcePolicy:
  containerPolicies:
  - containerName: cert-manager-controller
    minAllowed:
      cpu: 15m  # Reduced from 50m
      memory: 64Mi
```

Then enable VPA in 'Initial' mode to apply recommendations automatically to new pods.

---

## Resource Impact Summary

### Current State

| Workload | CPU Request | Memory Request | CPU Usage | Memory Usage |
|----------|-------------|----------------|-----------|--------------|
| cert-manager | 50m | 64Mi | 1-2m | 55Mi |
| cert-manager-cainjector | 50m | 64Mi | 2m | 31Mi |
| cert-manager-webhook | 50m | 64Mi | 1m | 31Mi |
| metoro-exporter | 50m | 128Mi | 8m | 100Mi |
| **Total** | **200m** | **320Mi** | **12-13m** | **217Mi** |

### After Optimization (Immediate)

| Workload | CPU Request | Memory Request | Change |
|----------|-------------|----------------|--------|
| cert-manager | 50m | 100Mi | +36Mi |
| cert-manager-cainjector | 50m | 100Mi | +36Mi |
| cert-manager-webhook | 50m | 100Mi | +36Mi |
| metoro-exporter | 50m | 128Mi | No change |
| **Total** | **200m** | **428Mi** | **+108Mi** |

### Potential Future Optimization (If minAllowed Reduced)

| Workload | CPU Request | Memory Request | CPU Savings |
|----------|-------------|----------------|-------------|
| cert-manager | 15m | 100Mi | -35m |
| cert-manager-cainjector | 15m | 100Mi | -35m |
| cert-manager-webhook | 15m | 100Mi | -35m |
| metoro-exporter | 23m | 128Mi | -27m |
| **Total** | **68m** | **428Mi** | **-132m** |

---

## Risk Assessment

### Immediate Actions (Memory Increase)

**Risk Level:** 🟢 **Low**

**Risks:**
- Minimal risk (memory is not currently constrained)
- Provides better safety margin
- Aligns with VPA recommendations

**Mitigation:**
- Monitor memory usage after changes
- Verify no OOM kills occur
- Rollback plan available

### Future Considerations (CPU Reduction)

**Risk Level:** 🟡 **Medium**

**Risks:**
- CPU spikes during certificate operations
- Potential performance degradation
- Need careful monitoring

**Mitigation:**
- Start with VPA in 'Initial' mode (only affects new pods)
- Monitor for 1-2 weeks before enabling 'Auto' mode
- Have rollback plan ready
- Test in staging first (if available)

---

## Implementation Plan

### Phase 1: Immediate Optimization (This Week)

1. **Increase Cert-Manager Memory Requests**
   - Update all 3 Cert-Manager deployments
   - Monitor for 24-48 hours
   - Verify no issues

2. **Document Changes**
   - Update deployment configurations
   - Update documentation
   - Record results

### Phase 2: VPA Configuration Update (Next Week)

1. **Review VPA Recommendations**
   - Monitor VPA for 1 week
   - Verify recommendations are stable
   - Analyze usage patterns

2. **Update VPA minAllowed Constraints**
   - Reduce minAllowed CPU to 15m for Cert-Manager
   - Reduce minAllowed CPU to 23m for Metoro Exporter
   - Monitor VPA recommendations

### Phase 3: Enable VPA Initial Mode (Week 3-4)

1. **Enable VPA Initial Mode**
   - Change updateMode to 'Initial' for selected workloads
   - Monitor pod creation and resource allocation
   - Verify resources are set correctly

2. **Validate Performance**
   - Monitor workload performance
   - Check for any issues
   - Adjust as needed

### Phase 4: Continuous Optimization (Ongoing)

1. **Monitor VPA Recommendations**
   - Review recommendations weekly
   - Apply manual updates as needed
   - Document optimization results

2. **Consider Auto Mode** (Optional)
   - Only for non-critical workloads
   - Requires careful monitoring
   - High risk of pod evictions

---

## Monitoring & Validation

### Metrics to Monitor

1. **Resource Usage:**
   - CPU and memory usage vs. requests
   - CPU and memory usage vs. limits
   - Resource utilization trends

2. **Performance:**
   - Pod startup times
   - Response times
   - Error rates

3. **VPA Recommendations:**
   - Recommendation stability
   - Changes in recommendations over time
   - Alignment with actual usage

### Validation Steps

1. **Before Changes:**
   - Document current resource usage
   - Baseline performance metrics
   - Verify VPA recommendations

2. **After Changes:**
   - Monitor resource usage for 24-48 hours
   - Check for performance degradation
   - Verify no OOM kills or CPU throttling
   - Compare with VPA recommendations

3. **Ongoing:**
   - Weekly review of VPA recommendations
   - Monthly optimization review
   - Document learnings and adjustments

---

## Conclusions

### Current State

- VPA is installed and providing recommendations
- Most resources are well-aligned with VPA recommendations
- Cert-Manager memory requests need adjustment
- Actual usage is lower than requests (good safety margin)

### Optimization Opportunities

1. **Immediate:** Increase Cert-Manager memory to 100Mi (low risk)
2. **Future:** Consider reducing CPU requests if VPA minAllowed is adjusted (medium risk)
3. **Ongoing:** Monitor VPA recommendations and apply as needed

### Expected Benefits

- **Better Resource Alignment:** Resources match VPA recommendations
- **Improved Safety Margin:** Memory requests provide better buffer
- **Cost Optimization:** Potential CPU savings if minAllowed is reduced
- **Automated Optimization:** VPA provides continuous optimization

---

## Next Steps

1. **Review this report** with the team
2. **Apply immediate optimizations** (memory increases)
3. **Monitor VPA recommendations** for 1 week
4. **Consider VPA configuration updates** based on findings
5. **Plan for VPA Initial mode** enablement
6. **Document optimization results** for future reference

---

**Report Generated:** 2025-11-09  
**Next Review:** 2025-11-16 (1 week after implementation)  
**Status:** ✅ Ready for implementation

