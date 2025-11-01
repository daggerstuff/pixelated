# Service Architecture Decision

## Current Setup

**Traffic Flow:**
```
Internet → Ingress (Traefik) → Service (port 80) → Pod (containerPort 4321)
```

## Why This Configuration

1. **Ingress + ClusterIP Service** (not LoadBalancer)
   - Ingress handles TLS termination and routing
   - ClusterIP service is for internal cluster communication only
   - LoadBalancer is redundant when using Ingress

2. **Service Port 80 → Container Port 4321**
   - Service port 80 is standard HTTP port (common practice)
   - Container port 4321 is where the app actually runs
   - This abstraction allows changing container port without affecting Ingress

3. **Deployment Name: `pixelated`**
   - Matches namespace and app name
   - Selector: `app: pixelated` (consistent labeling)

## What Changed From Old Setup

**Old (conflicting):**
- Deployment: `pixelated-app` (selector: `app: pixelated-app`)
- Service: LoadBalancer on port 80
- No GitOps management

**New (correct):**
- Deployment: `pixelated` (selector: `app: pixelated`)
- Service: ClusterIP on port 80 → targetPort 4321
- Managed by Flux GitOps
- Ingress handles external traffic

## Migration Path

1. Delete old `pixelated-app` deployment
2. Flux will create new `pixelated` deployment
3. Service will be updated by Flux
4. Ingress already exists and will work with new service

