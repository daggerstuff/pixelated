# KSV041 Security Fix: Flux ClusterRole Secret Access

## Vulnerability Details

**Issue**: ClusterRole 'crd-controller-flux-system' had cluster-wide read access to secrets
**Severity**: CRITICAL
**Rule ID**: KSV041
**Detection Tool**: Trivy
**Date Fixed**: October 7, 2025

## Problem Description

The Flux system ClusterRole `crd-controller-flux-system` had the following overly permissive rule:

```yaml
- apiGroups: [ "" ]
  resources:
  - namespaces
  - secrets        # CRITICAL: Cluster-wide secret access
  - configmaps
  - serviceaccounts
  verbs:
  - get
  - list
  - watch
```

### Security Risk

According to Kubernetes security best practices and the KSV041 rule:

> Viewing secrets at the cluster-scope is akin to cluster-admin in most clusters as there are typically at least one service account (their token stored in a secret) bound to cluster-admin directly or a role/clusterrole that gives similar permissions.

This means:
- Any compromise of a Flux controller pod could expose ALL secrets across ALL namespaces
- This violates the principle of least privilege
- It's equivalent to granting cluster-admin access in practice

## Solution Implemented

### 1. Removed Cluster-Wide Secret Access

Created a strategic merge patch (`flux-clusterrole-secrets-patch.yaml`) that removes the `secrets` resource from the ClusterRole while preserving all other necessary permissions.

### 2. Added Namespace-Scoped Secret Access

Created a namespace-scoped Role and RoleBinding (`flux-namespace-secret-role.yaml`) that grants Flux controllers access to secrets ONLY within the `flux-system` namespace.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: flux-secret-reader
  namespace: flux-system
rules:
- apiGroups: [ "" ]
  resources:
  - secrets
  verbs:
  - get
  - list
  - watch
```

### 3. Updated Kustomization

Modified `clusters/pixelkube/flux-system/kustomization.yaml` to apply the patch and include the namespace-scoped role.

## Files Modified

- `clusters/pixelkube/flux-system/kustomization.yaml` - Added patch configuration
- `clusters/pixelkube/flux-system/flux-clusterrole-secrets-patch.yaml` - Patch to remove cluster-wide secret access
- `clusters/pixelkube/flux-system/flux-namespace-secret-role.yaml` - Namespace-scoped secret access

## Impact Assessment

### What Still Works
- Flux can read secrets in the `flux-system` namespace (for Git credentials, Helm repo auth, etc.)
- All other Flux operations remain unchanged
- ConfigMaps, ServiceAccounts, and other resources still have appropriate cluster-wide read access

### What Changes
- Flux controllers can no longer read secrets in namespaces outside `flux-system`
- If Flux needs to access secrets in other namespaces, additional namespace-scoped Roles must be created

### Additional Namespace Support

If Flux needs to manage secrets in other namespaces (e.g., for HelmRelease with credentials), create additional Roles:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: flux-secret-reader
  namespace: <target-namespace>
rules:
- apiGroups: [ "" ]
  resources:
  - secrets
  verbs:
  - get
  - list
  - watch
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: flux-secret-reader
  namespace: <target-namespace>
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: flux-secret-reader
subjects:
- kind: ServiceAccount
  name: helm-controller
  namespace: flux-system
```

## Verification

To verify the fix is applied correctly:

```bash
# Check the ClusterRole no longer has cluster-wide secret access
kubectl get clusterrole crd-controller-flux-system -o yaml | grep -A 5 "secrets"

# Verify the namespace-scoped Role exists
kubectl get role flux-secret-reader -n flux-system

# Verify the RoleBinding
kubectl get rolebinding flux-secret-reader -n flux-system

# Test with kustomize build
kustomize build clusters/pixelkube/flux-system/
```

## Testing

After applying this fix:

1. Flux should continue to reconcile GitRepositories, Kustomizations, and HelmReleases normally
2. Flux should still be able to use secrets in the flux-system namespace (e.g., Git credentials)
3. Security scanners (Trivy, Checkov) should no longer report KSV041 for this ClusterRole

## References

- [KSV041 Documentation](https://avd.aquasec.com/misconfig/ksv041/)
- [Kubernetes RBAC Best Practices](https://kubernetes.io/docs/reference/access-authn-authz/rbac/#privilege-escalation-prevention-and-bootstrapping)
- [Flux Security Documentation](https://fluxcd.io/flux/security/)

## Related Security Fixes

This fix follows the same pattern as the previous KSV041 fix for the Caddy Ingress Controller ClusterRole. See:
- `docs/security/KSV041-caddy-clusterrole-fix.md`
- `SECURITY-FIX-KSV045.md`
