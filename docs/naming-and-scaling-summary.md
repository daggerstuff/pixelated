# Cluster Naming & Scaling Summary

**Date:** 2025-11-09  
**Cluster:** pixelated-empathy-civo  
**Tasks:** Simplify names, scale to 2 nodes

---

## ✅ Task 1: Simplify Cluster Names - COMPLETED

### Node Labeling
All nodes now have friendly labels:
- **node-1** (e7rjo): `k3s-pixelated-empathy-civo-cefd-5cd7ce-node-pool-5582-e7rjo`
- **node-2** (nh4ec): `k3s-pixelated-empathy-civo-cefd-5cd7ce-node-pool-5582-nh4ec`
- **node-3** (wm259): `k3s-pixelated-empathy-civo-cefd-5cd7ce-node-pool-5582-wm259`

**Labels Added:**
- `cluster.pixelated.io/friendly-name`: node-1, node-2, node-3
- `cluster.pixelated.io/short-id`: e7rjo, nh4ec, wm259

### kubectl Aliases Created
Created `.kubectl-aliases.sh` with helper functions:
- `kgn` - Get nodes with friendly names
- `kgp` - Get pods with shorter node names
- `kgs` - Get services

**Usage:**
```bash
source .kubectl-aliases.sh
kgn    # Show nodes with friendly names
kgp    # Show pods with shortened node names
kgp pixelated  # Show pods in specific namespace
```

### Deployment & Service Names
Current names are already short and clear:
- **Deployments:** `pixelated`, `metoro-exporter`
- **Services:** `pixelated-service`, `metoro-exporter`, `metoro-redis-master`
- **Pods:** Include hash suffixes (Kubernetes standard, can't be changed without recreating)

**Note:** Pod names include hash suffixes from ReplicaSets (e.g., `pixelated-579c764dcb-nkq7d`). This is Kubernetes standard behavior and cannot be changed without recreating deployments.

---

## 📊 Task 2: Scale Down to 2 Nodes - READY

### Current Cluster State

**Nodes:**
- 3 nodes, each with 1820m CPU, ~3.1GB memory
- Total capacity: 5460m CPU, ~9.3GB memory
- Current usage: ~586m CPU, ~4.3GB memory

**Workload Distribution:**
- **node-1 (e7rjo):** 4 workload pods (least loaded)
- **node-2 (nh4ec):** 7 workload pods
- **node-3 (wm259):** 9 workload pods (most loaded)

### Resource Analysis for 2 Nodes

**2-Node Capacity:**
- Total CPU: 3640m (3.64 cores)
- Total Memory: ~6.2GB

**Estimated Requirements:**
- **DaemonSets** (run on all nodes):
  - metoro-node-agent: 300m CPU, 1Gi memory × 2 = 600m CPU, 2Gi memory
  - civo-csi-node: minimal
  - otel-collector: minimal
  - traefik: minimal

- **Workload Pods:**
  - metoro-exporter: 50m CPU, 128Mi memory
  - metoro-redis: 500m CPU, 1Gi memory
  - pixelated: 400m CPU, 1Gi memory (2 pods)
  - cert-manager: ~200m CPU, ~200Mi memory (3 pods)
  - flux-system: ~550m CPU, ~384Mi memory (5 pods)
  - kube-system: ~400m CPU, ~500Mi memory

**Total Estimated:**
- CPU: ~2700m (74% of 2-node capacity)
- Memory: ~5.2GB (84% of 2-node capacity)

**Verdict:** ✅ **Fits comfortably on 2 nodes**

### Recommended Node to Remove

**Node-1 (e7rjo)** is the best candidate:
- Least workload (4 pods)
- No critical single-instance pods
- All pods can be rescheduled to other nodes

### Scale-Down Script

**Script:** `scripts/scale-down-to-2-nodes.sh`

**Features:**
- Analyzes cluster state
- Selects node with least workload (or uses specified node)
- Drains node gracefully (moves pods to other nodes)
- Verifies pods rescheduled
- Removes node from cluster
- Verifies cluster health

**Usage:**
```bash
# Auto-select node to remove
./scripts/scale-down-to-2-nodes.sh

# Remove specific node
./scripts/scale-down-to-2-nodes.sh node-1
./scripts/scale-down-to-2-nodes.sh k3s-pixelated-empathy-civo-cefd-5cd7ce-node-pool-5582-e7rjo
```

### Scale-Down Process

1. **Pre-flight Checks:**
   - Verify cluster connectivity
   - Analyze current state
   - Select node to remove

2. **Drain Node:**
   - Cordon node (prevent new pods)
   - Evict pods gracefully
   - Wait for rescheduling

3. **Remove Node:**
   - Delete node from cluster
   - Verify cluster health
   - Check critical pods

4. **Post-Scale Verification:**
   - Verify all pods running
   - Check resource usage
   - Monitor for issues

### Expected Results

**After Scale-Down:**
- 2 nodes remaining
- All pods rescheduled
- No service interruptions
- Resource usage: ~74% CPU, ~84% memory (well within limits)

**Cost Savings:**
- **33% node reduction** (3 → 2 nodes)
- **Estimated savings: 10-15% cluster cost** (additional to Priority 1 optimizations)

### Risk Assessment

**Risk Level:** 🟡 **Medium-Low**

**Risks:**
- Pod rescheduling may take a few minutes
- Temporary resource pressure during migration
- Single node failure reduces redundancy (but HPA enabled)

**Mitigation:**
- HPA enabled for Pixelated (auto-scales if needed)
- Graceful pod eviction (no forced termination)
- Monitoring during process
- Rollback plan available (re-add node if needed)

---

## 📋 Implementation Checklist

### Naming Simplification
- [x] Add friendly labels to nodes
- [x] Create kubectl aliases
- [x] Test alias functions
- [x] Document usage

### Scaling to 2 Nodes
- [x] Analyze workload distribution
- [x] Verify resource requirements
- [x] Create scale-down script
- [x] Test script (dry-run)
- [ ] Execute scale-down (pending user approval)
- [ ] Verify cluster health after scale-down
- [ ] Monitor for 24 hours
- [ ] Delete node from Civo (manual step)

---

## 🚀 Next Steps

1. **Review this summary**
2. **Execute scale-down:**
   ```bash
   ./scripts/scale-down-to-2-nodes.sh
   ```
3. **Monitor cluster for 24 hours**
4. **Delete node from Civo dashboard** (to save costs)
5. **Update documentation** with final node count

---

## 📝 Notes

- Node names are auto-generated by Civo/K3s and cannot be changed without recreating the cluster
- Pod names include hash suffixes (Kubernetes standard)
- Deployment/service names are already short and clear
- Friendly labels make nodes easier to identify in kubectl output
- kubectl aliases provide prettier output for daily use

---

**Status:** ✅ Naming simplified, scaling ready for execution  
**Estimated Time:** 5-10 minutes for scale-down process  
**Downtime:** None (zero-downtime migration)

