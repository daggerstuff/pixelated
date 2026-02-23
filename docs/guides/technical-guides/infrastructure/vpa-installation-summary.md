## VPA Installation Summary

**Date:** 2025-11-09  
**Cluster:** pixelated-empathy-civo  
**Status:** ✅ Successfully Installed

---

## Installation Method

**Method:** Helm (Fairwinds Stable Chart)  
**Chart:** `fairwinds-stable/vpa`  
**Namespace:** `vpa-system`

### Installation Command

```bash
helm repo add fairwinds-stable https://charts.fairwinds.com/stable
helm repo update
helm install vpa fairwinds-stable/vpa --namespace vpa-system --create-namespace
```

---

## VPA Components

### Installed Components

1. **VPA Recommender**
   - Monitors resource usage and provides recommendations
   - Deployment: `vpa-recommender`
   - Status: ✅ Running

2. **VPA Updater**
   - Updates pod resource requests (disabled in 'Off' mode)
   - Deployment: `vpa-updater`
   - Status: ✅ Running

3. **VPA Admission Controller**
   - Sets resource requests on new pods (disabled in 'Off' mode)
   - Deployment: `vpa-admission-controller`
   - Status: ✅ Running

### Resource Configuration

VPA components are configured with:
- **Recommender:** 100m CPU, 256Mi memory requests; 500m CPU, 512Mi memory limits
- **Updater:** 100m CPU, 256Mi memory requests; 500m CPU, 512Mi memory limits
- **Admission Controller:** 100m CPU, 128Mi memory requests; 200m CPU, 256Mi memory limits

---

## VPA Configurations

### Workloads with VPA

All VPA configurations are in **'Off' mode** (recommendations only):

1. **Cert-Manager Controller**
   - Namespace: `cert-manager`
   - VPA Name: `cert-manager-vpa`
   - Target: `cert-manager` deployment
   - Mode: `Off`
   - Min Allowed: 50m CPU, 64Mi memory
   - Max Allowed: 500m CPU, 512Mi memory

2. **Cert-Manager CA Injector**
   - Namespace: `cert-manager`
   - VPA Name: `cert-manager-cainjector-vpa`
   - Target: `cert-manager-cainjector` deployment
   - Mode: `Off`
   - Min Allowed: 50m CPU, 64Mi memory
   - Max Allowed: 500m CPU, 512Mi memory

3. **Cert-Manager Webhook**
   - Namespace: `cert-manager`
   - VPA Name: `cert-manager-webhook-vpa`
   - Target: `cert-manager-webhook` deployment
   - Mode: `Off`
   - Min Allowed: 50m CPU, 64Mi memory
   - Max Allowed: 500m CPU, 512Mi memory

4. **Metoro Exporter**
   - Namespace: `metoro`
   - VPA Name: `metoro-exporter-vpa`
   - Target: `metoro-exporter` deployment
   - Mode: `Off`
   - Min Allowed: 50m CPU, 128Mi memory
   - Max Allowed: 500m CPU, 1Gi memory

### VPA Configuration Files

All VPA configurations are stored in: `manifests/vpa/`

- `cert-manager-vpa.yaml`
- `cert-manager-cainjector-vpa.yaml`
- `cert-manager-webhook-vpa.yaml`
- `metoro-exporter-vpa.yaml`

---

## Current Status

### VPA Components

```text
NAME                                       READY   STATUS    RESTARTS   AGE
vpa-admission-controller-bcc9d9c77-rhkrw   1/1     Running   0          <1m
vpa-recommender-754d7df577-cv9wf           1/1     Running   0          <1m
vpa-updater-8546c4f7d6-gqvvf               1/1     Running   0          <1m
```

### VPA Resources

```text
NAMESPACE      NAME                          MODE   CPU   MEM   PROVIDED   AGE
cert-manager   cert-manager-cainjector-vpa   Off                           2s
cert-manager   cert-manager-vpa              Off                           2s
cert-manager   cert-manager-webhook-vpa      Off                           2s
metoro         metoro-exporter-vpa           Off                           2s
```

### Recommendations

**Status:** Recommendations will appear after VPA collects usage data (usually 24-48 hours)

VPA needs time to:
1. Collect resource usage metrics
2. Analyze historical usage patterns
3. Generate recommendations based on actual usage

---

## Monitoring VPA

### Check VPA Status

```bash
# List all VPA resources
kubectl get vpa --all-namespaces

# Describe a specific VPA
kubectl describe vpa <vpa-name> -n <namespace>

# Check VPA recommendations
kubectl get vpa <vpa-name> -n <namespace> -o yaml
```

### Check VPA Component Logs

```bash
# VPA Recommender logs
kubectl logs -n vpa-system deployment/vpa-recommender

# VPA Updater logs
kubectl logs -n vpa-system deployment/vpa-updater

# VPA Admission Controller logs
kubectl logs -n vpa-system deployment/vpa-admission-controller
```

### Check VPA Component Status

```bash
# VPA deployments
kubectl get deployment -n vpa-system

# VPA pods
kubectl get pods -n vpa-system

# VPA component resources
kubectl top pods -n vpa-system
```

---

## Next Steps

### Phase 1: Monitor Recommendations (Week 1-2)

1. **Wait for Recommendations:**
   - VPA needs 24-48 hours to collect usage data
   - Monitor VPA resources: `kubectl get vpa --all-namespaces`

2. **Review Recommendations:**
   - Check recommendations: `kubectl describe vpa <vpa-name> -n <namespace>`
   - Compare recommendations with current resource requests
   - Document baseline recommendations

3. **Analyze Recommendations:**
   - Verify recommendations are reasonable
   - Check if recommendations align with actual usage
   - Identify workloads that could benefit from optimization

### Phase 2: Apply Recommendations Manually (Week 3-4)

1. **Manual Application:**
   - Review VPA recommendations
   - Manually update resource requests for non-critical workloads
   - Monitor performance after changes

2. **Validation:**
   - Verify workloads perform well with new resources
   - Check for any performance degradation
   - Monitor error rates and response times

### Phase 3: Enable 'Initial' Mode (Week 5-6)

1. **Select Workloads:**
   - Choose non-critical workloads for 'Initial' mode
   - Start with cert-manager or metoro-exporter

2. **Enable 'Initial' Mode:**
   - Update VPA configuration: `updateMode: "Initial"`
   - Apply updated configuration
   - Monitor pod creation and resource allocation

3. **Validate:**
   - Verify resources are set correctly on new pods
   - Monitor workload performance
   - Check for any issues

### Phase 4: Enable 'Auto' Mode (Optional, Week 7+)

1. **Consider 'Auto' Mode:**
   - Only for non-production or well-tested workloads
   - Requires careful monitoring
   - Can cause pod evictions

2. **Enable 'Auto' Mode:**
   - Update VPA configuration: `updateMode: "Auto"`
   - Apply updated configuration
   - Monitor pod evictions and service disruptions

3. **Monitor:**
   - Watch for pod evictions
   - Monitor service disruptions
   - Adjust configuration as needed

---

## VPA Mode Comparison

### Off Mode (Current)

- **Behavior:** Only provides recommendations, no automatic updates
- **Safety:** ✅ Safe for production
- **Use Case:** Getting recommendations, evaluating VPA
- **Pod Evictions:** ❌ None

### Initial Mode

- **Behavior:** Sets resources when pod is created, doesn't update existing pods
- **Safety:** ✅ Safe for production
- **Use Case:** Applying recommendations to new pods
- **Pod Evictions:** ❌ None (only affects new pods)

### Auto Mode

- **Behavior:** Automatically updates resources on existing pods
- **Safety:** ⚠️ Use with caution
- **Use Case:** Continuous optimization
- **Pod Evictions:** ⚠️ Yes (can cause service disruptions)

---

## Updating VPA Configurations

### Change Update Mode

```bash
# Edit VPA configuration
kubectl edit vpa <vpa-name> -n <namespace>

# Or update YAML file and apply
kubectl apply -f manifests/vpa/<vpa-name>.yaml
```

### Example: Enable 'Initial' Mode

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: cert-manager-vpa
  namespace: cert-manager
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: cert-manager
  updatePolicy:
    updateMode: "Initial"  # Changed from "Off" to "Initial"
  resourcePolicy:
    containerPolicies:
    - containerName: cert-manager-controller
      minAllowed:
        cpu: 50m
        memory: 64Mi
      maxAllowed:
        cpu: 500m
        memory: 512Mi
```

---

## Troubleshooting

### VPA Not Providing Recommendations

1. **Check Metrics Server:**
   ```bash
   kubectl get deployment metrics-server -n kube-system
   ```

2. **Check VPA Recommender:**
   ```bash
   kubectl logs -n vpa-system deployment/vpa-recommender
   ```

3. **Check Pod Metrics:**
   ```bash
   kubectl top pods --all-namespaces
   ```

4. **Wait for Data Collection:**
   - VPA needs 24-48 hours to collect usage data
   - Recommendations appear after sufficient data is collected

### VPA Components Not Running

1. **Check Pod Status:**
   ```bash
   kubectl get pods -n vpa-system
   ```

2. **Check Pod Logs:**
   ```bash
   kubectl logs -n vpa-system <pod-name>
   ```

3. **Check Resource Limits:**
   ```bash
   kubectl describe pod -n vpa-system <pod-name>
   ```

### VPA Recommendations Not Applied

1. **Check Update Mode:**
   - 'Off' mode: Recommendations are not applied automatically
   - 'Initial' mode: Only applies to new pods
   - 'Auto' mode: Applies to all pods (can cause evictions)

2. **Check VPA Status:**
   ```bash
   kubectl describe vpa <vpa-name> -n <namespace>
   ```

---

## Security Considerations

1. **RBAC:** VPA components have appropriate RBAC permissions
2. **Resource Limits:** VPA components have resource limits set
3. **Namespace Isolation:** VPA is installed in dedicated namespace
4. **Update Mode:** Currently in 'Off' mode (safe for production)

---

## Cost Impact

### VPA Components

- **CPU:** ~300m CPU requests (0.3 cores)
- **Memory:** ~640Mi memory requests (~0.63GB)
- **Cost Impact:** Minimal (small resource footprint)

### Benefits

- **Resource Optimization:** Better resource utilization
- **Cost Savings:** Potential 10-20% resource savings
- **Automated Optimization:** Continuous resource optimization
- **Better Predictability:** Data-driven resource recommendations

---

## References

- **VPA Documentation:** [Kubernetes Autoscaler VPA](https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler)
- **Fairwinds VPA Chart:** [FairwindsOps VPA Chart](https://github.com/FairwindsOps/charts/tree/master/stable/vpa)
- **VPA Best Practices:** [VPA README](https://github.com/kubernetes/autoscaler/blob/master/vertical-pod-autoscaler/README.md)

---

**Installation Date:** 2025-11-09  
**Next Review:** 2025-11-11 (check for recommendations)  
**Status:** ✅ Installed and configured in 'Off' mode

