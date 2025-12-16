## Cluster Optimization & Cost-Saving Report
**Generated:** 2025-11-09  
**Cluster:** pixelated-empathy-civo  
**Environment:** pixelcluster

## Executive Summary

**Current State:**
- **CPU Utilization:** 0.5% actual usage vs 47.5% requested (2851m requested, 31m actual)
- **Memory Utilization:** ~36% actual usage (~4.1GB used)
- **Cost Impact:** Significant over-provisioning detected
- **Estimated Savings Potential:** 30-50% cluster cost reduction

---

## Critical Issues Identified

### 1. 🔴 **Metoro Exporter - Massive Over-Provisioning**
**Current:**
- **Requests:** 1 CPU core + 2Gi memory
- **Actual Usage:** 12m CPU (0.012 cores) + 52Mi memory
- **Waste:** ~99% CPU over-provisioned, ~97% memory over-provisioned

**Impact:** Consuming 1 full CPU core and 2GB memory unnecessarily

**Recommendation:**
```yaml
resources:
  requests:
    cpu: 50m
    memory: 128Mi
  limits:
    cpu: 200m
    memory: 512Mi
```

**Estimated Savings:** Free up ~1 CPU core + ~1.9GB memory

---

### 2. 🔴 **Metoro Node Agents - Memory Under-Provisioned**
**Current:**
- **Requests:** 300Mi memory each (3 pods)
- **Actual Usage:** 809-935Mi memory each
- **Issue:** Pods are exceeding requests, causing potential throttling

**Impact:** Performance degradation, potential OOM kills

**Recommendation:**
```yaml
resources:
  requests:
    cpu: 300m
    memory: 1024Mi  # Increased from 300Mi
  limits:
    cpu: 1000m
    memory: 2048Mi  # Increased from 2Gi
```

**Estimated Savings:** Prevent performance issues, improve stability

---

### 3. 🟡 **Pixelated Service - Potential Over-Replication**
**Current:**
- **Replicas:** 3
- **Actual Usage per Pod:** 4-8m CPU + 218-292Mi memory
- **Request Rate:** ~36 requests/minute (very low)
- **Response Time:** Excellent (P99: 16ms)

**Analysis:** Traffic is very low, 3 replicas may be unnecessary for current load

**Recommendation:**
- **Option A (Conservative):** Reduce to 2 replicas + enable HPA
- **Option B (Aggressive):** Reduce to 1 replica + enable HPA with minReplicas=1

**Estimated Savings:** 
- Option A: Reduce by 33% (1 pod)
- Option B: Reduce by 67% (2 pods)

**Risk:** Minimal - HPA will scale up if traffic increases

---

### 4. 🟡 **Missing Resource Requests/Limits**
**Current:**
- Many pods have no resource requests/limits set
- Cert-Manager pods: No requests
- Traefik pods: No requests
- OTel Collector pods: No requests (using 0/0)

**Impact:** 
- Unpredictable scheduling
- Potential resource contention
- Difficult to optimize cluster

**Recommendation:** Set appropriate requests/limits for all pods

---

### 5. 🟡 **No Horizontal Pod Autoscaling (HPA)**
**Current:**
- No HPA configured for any service
- Fixed replica counts
- Cannot scale based on demand

**Impact:** 
- Over-provisioning during low traffic
- Under-provisioning risk during traffic spikes
- Manual scaling required

**Recommendation:** Enable HPA for Pixelated service

---

## Resource Utilization Analysis

### CPU Usage
| Namespace | Requested | Actual Usage | Utilization |
|-----------|-----------|--------------|-------------|
| Metoro | 1401m | ~90m | 6.4% |
| Pixelated | 600m | ~17m | 2.8% |
| Flux | 550m | ~20m | 3.6% |
| Kube-system | 300m | ~100m | 33.3% |
| **Total** | **2851m** | **~227m** | **8.0%** |

### Memory Usage
| Namespace | Requested | Actual Usage | Utilization |
|-----------|-----------|--------------|-------------|
| Metoro | ~9GB | ~2.6GB | 29% |
| Pixelated | 1.5GB | ~760Mi | 50% |
| Flux | 384Mi | ~380Mi | 99% |
| Kube-system | 440Mi | ~500Mi | 114% |
| **Total** | **~11.3GB** | **~4.1GB** | **36%** |

---

## Cost Optimization Recommendations

### Priority 1: Immediate Actions (High Impact, Low Risk)

#### 1.1 Optimize Metoro Exporter Resources
**Action:** Update Helm values to reduce resource requests
**Savings:** ~1 CPU core + ~1.9GB memory
**Risk:** Low (current usage is very low)

```bash
# Update deployment script to include resource optimization
helm upgrade --install metoro-exporter metoro-exporter/metoro-exporter \
  --set exporter.secret.bearerToken="${jwt_token}" \
  --set exporter.replicas=1 \
  --set exporter.resources.requests.cpu=50m \
  --set exporter.resources.requests.memory=128Mi \
  --set exporter.resources.limits.cpu=200m \
  --set exporter.resources.limits.memory=512Mi
```

#### 1.2 Fix Metoro Node Agent Memory Requests
**Action:** Increase memory requests to match actual usage
**Savings:** Prevent performance issues
**Risk:** Low (fixes current under-provisioning)

```bash
# Update via Helm values
--set nodeAgent.resources.requests.memory=1024Mi \
--set nodeAgent.resources.limits.memory=2048Mi
```

#### 1.3 Reduce Pixelated Replicas to 2 + Enable HPA
**Action:** Scale down to 2 replicas, enable HPA for auto-scaling
**Savings:** Reduce by 33% (1 pod)
**Risk:** Low (HPA will scale up if needed)

```bash
kubectl scale deployment pixelated -n pixelated --replicas=2

# Create HPA
kubectl autoscale deployment pixelated -n pixelated \
  --min=2 --max=5 --cpu-percent=70
```

---

### Priority 2: Medium-Term Actions (Medium Impact, Medium Risk)

#### 2.1 Consider Node Size Reduction
**Current:** 3 nodes × g4s.kube.medium (2 CPU, ~3.8GB RAM)
**Analysis:** Total usage is very low (~0.5% CPU, 36% memory)

**Option A: Downsize to g4s.kube.small**
- **If available:** 1 CPU, ~2GB RAM per node
- **Savings:** ~30-40% per node
- **Risk:** Medium (need to verify if workload fits)

**Option B: Reduce to 2 Nodes**
- **Current:** 3 nodes with very low utilization
- **Analysis:** Total workload could fit on 2 nodes
- **Savings:** ~33% (1 node elimination)
- **Risk:** Low (if node failure tolerance allows)

**Recommendation:** Start with reducing to 2 nodes, then evaluate downsizing

#### 2.2 Set Resource Requests/Limits on All Pods
**Action:** Add resource requests/limits to pods without them
**Impact:** Better scheduling, predictable resource usage
**Risk:** Low

**Pods needing resources:**
- Cert-Manager pods (3 pods)
- Traefik pods (3 pods)
- OTel Collector pods (3 pods)
- Civo CCM/CSI pods

#### 2.3 Enable Vertical Pod Autoscaler (VPA)
**Action:** Install VPA to automatically adjust resource requests
**Impact:** Continuous optimization based on actual usage
**Risk:** Medium (requires careful configuration)

---

### Priority 3: Long-Term Actions (Lower Impact, Higher Risk)

#### 3.1 Implement Resource Quotas
**Action:** Set namespace-level resource quotas
**Impact:** Prevent resource waste, cost accountability
**Risk:** Low

#### 3.2 Regular Cost Auditing
**Action:** Monthly review of resource usage and costs
**Impact:** Continuous optimization
**Risk:** None

---

## Implementation Plan

### Phase 1: Quick Wins (This Week)
1. ✅ Optimize Metoro exporter resources
2. ✅ Fix Metoro node agent memory requests
3. ✅ Reduce Pixelated replicas to 2
4. ✅ Enable HPA for Pixelated service

### Phase 2: Resource Optimization (Next Week)
1. Set resource requests/limits on all pods
2. Evaluate node size reduction
3. Consider reducing to 2 nodes

### Phase 3: Advanced Optimization (Next Month)
1. Install VPA
2. Implement resource quotas
3. Set up cost monitoring

---

## Expected Cost Savings

### Current Cluster Cost (Estimated)
- **3 nodes × g4s.kube.medium:** ~$X/month (need Civo pricing)
- **Total estimated:** ~$X/month

### After Optimization (Estimated)
- **Resource optimization:** -20% (freed resources)
- **Replica reduction:** -10% (1 less Pixelated pod)
- **Node reduction (if applicable):** -33% (1 less node)
- **Total potential savings:** 30-50% cluster cost

---

## Risk Assessment

### Low Risk
- ✅ Metoro exporter resource optimization
- ✅ Metoro node agent memory increase
- ✅ Pixelated replica reduction (with HPA)

### Medium Risk
- ⚠️ Node size reduction (needs testing)
- ⚠️ Reducing to 2 nodes (availability risk)

### High Risk
- ❌ Reducing Pixelated to 1 replica (not recommended without HPA)

---

## Monitoring & Validation

### Metrics to Monitor After Changes
1. **CPU utilization:** Should increase slightly (better utilization)
2. **Memory utilization:** Should be more consistent
3. **Pod restarts:** Should decrease (fixed memory issues)
4. **Response times:** Should remain stable
5. **Error rates:** Should not increase

### Validation Steps
1. Apply changes during low-traffic period
2. Monitor for 24-48 hours
3. Check Metoro dashboards for anomalies
4. Verify application performance
5. Rollback if issues occur

---

## Next Steps

1. **Review this report** with team
2. **Prioritize recommendations** based on risk tolerance
3. **Create implementation tickets** for Phase 1
4. **Schedule maintenance window** for changes
5. **Implement changes** with monitoring
6. **Validate results** after 48 hours
7. **Document learnings** for future optimization

---

## Appendix: Detailed Resource Analysis

### Pod Resource Requests vs Usage

#### Metoro Exporter
- **Requested:** 1000m CPU, 2048Mi memory
- **Used:** 12m CPU, 52Mi memory
- **Efficiency:** 1.2% CPU, 2.5% memory

#### Metoro Node Agents (per pod)
- **Requested:** 300m CPU, 300Mi memory
- **Used:** 21-25m CPU, 809-935Mi memory
- **Efficiency:** 7-8% CPU, 270-312% memory (OVER LIMIT!)

#### Pixelated (per pod)
- **Requested:** 200m CPU, 512Mi memory
- **Used:** 4-8m CPU, 218-292Mi memory
- **Efficiency:** 2-4% CPU, 43-57% memory

### Cluster Capacity
- **Total CPU:** 6 cores (3 nodes × 2 cores)
- **Allocatable CPU:** ~5.46 cores (after kube-reserved)
- **Requested CPU:** 2.85 cores (52% of allocatable)
- **Used CPU:** 0.23 cores (4% of allocatable)

- **Total Memory:** ~11.5GB (3 nodes × ~3.8GB)
- **Allocatable Memory:** ~9.6GB (after kube-reserved)
- **Requested Memory:** ~11.3GB (118% of allocatable - OVER!)
- **Used Memory:** ~4.1GB (43% of allocatable)

---

**Report Generated:** 2025-11-09  
**Next Review:** 2025-11-16

