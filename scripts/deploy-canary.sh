#!/bin/bash
set -euo pipefail

echo "🚀 Executing canary deployment strategy..."

# Configuration
CANARY_PERCENTAGE=${CANARY_PERCENTAGE:-25}
CANARY_SUFFIX=${CANARY_SUFFIX:-canary}
STABLE_SUFFIX=${STABLE_SUFFIX:-stable}

# Calculate replica distribution
TOTAL_REPLICAS=$REPLICAS
CANARY_REPLICAS=$((TOTAL_REPLICAS * CANARY_PERCENTAGE / 100))
STABLE_REPLICAS=$((TOTAL_REPLICAS - CANARY_REPLICAS))

if [ $CANARY_REPLICAS -lt 1 ]; then
    CANARY_REPLICAS=1
    STABLE_REPLICAS=$((TOTAL_REPLICAS - 1))
fi

echo "📊 Canary deployment configuration:"
echo "  - Total replicas: $TOTAL_REPLICAS"
echo "  - Canary replicas: $CANARY_REPLICAS ($CANARY_PERCENTAGE%)"
echo "  - Stable replicas: $STABLE_REPLICAS"

# Check if stable deployment exists
STABLE_DEPLOYMENT="${GKE_DEPLOYMENT_NAME}-${STABLE_SUFFIX}"
CANARY_DEPLOYMENT="${GKE_DEPLOYMENT_NAME}-${CANARY_SUFFIX}"

if kubectl get deployment $STABLE_DEPLOYMENT >/dev/null 2>&1; then
    echo "📋 Stable deployment exists: $STABLE_DEPLOYMENT"
    STABLE_EXISTS=true
    
    # Scale down stable deployment temporarily
    echo "📉 Scaling down stable deployment for canary rollout..."
    kubectl scale deployment $STABLE_DEPLOYMENT --replicas=$STABLE_REPLICAS
else
    echo "🆕 Creating new stable deployment"
    STABLE_EXISTS=false
    STABLE_REPLICAS=$TOTAL_REPLICAS
fi

# Create canary deployment
echo "📋 Creating canary deployment: $CANARY_DEPLOYMENT"
cat > deployment-${CANARY_SUFFIX}.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $CANARY_DEPLOYMENT
  namespace: $GKE_NAMESPACE
  labels:
    app: pixelated
    version: $CI_COMMIT_SHORT_SHA
    deployment-strategy: canary
    deployment-tier: canary
spec:
  replicas: $CANARY_REPLICAS
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: pixelated
      deployment-tier: canary
  template:
    metadata:
      labels:
        app: pixelated
        version: $CI_COMMIT_SHORT_SHA
        deployment-tier: canary
        deployment-timestamp: "$(date -u +%Y%m%d%H%M%S)"
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "4321"
        prometheus.io/path: "/metrics"
        deployment.kubernetes.io/revision: "$CI_COMMIT_SHORT_SHA"
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
      containers:
      - name: pixelated
        image: $CONTAINER_IMAGE
        imagePullPolicy: Always
        ports:
        - containerPort: 4321
          name: http
          protocol: TCP
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "4321"
        - name: ASTRO_TELEMETRY_DISABLED
          value: "1"
        - name: KUBERNETES_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
        - name: KUBERNETES_POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: DEPLOYMENT_STRATEGY
          value: "canary"
        - name: DEPLOYMENT_TIER
          value: "canary"
        - name: CANARY_PERCENTAGE
          value: "$CANARY_PERCENTAGE"
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 4321
            scheme: HTTP
          initialDelaySeconds: 30
          periodSeconds: 30
          timeoutSeconds: 10
          failureThreshold: 3
          successThreshold: 1
        readinessProbe:
          httpGet:
            path: /api/health
            port: 4321
            scheme: HTTP
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
          successThreshold: 1
        startupProbe:
          httpGet:
            path: /api/health
            port: 4321
            scheme: HTTP
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 5
          failureThreshold: 30
          successThreshold: 1
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
            add:
            - CHOWN
            - SETGID
            - SETUID
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: var-tmp
          mountPath: /var/tmp
      volumes:
      - name: tmp
        emptyDir:
          sizeLimit: 100Mi
      - name: var-tmp
        emptyDir:
          sizeLimit: 50Mi
      imagePullSecrets:
      - name: gitlab-registry
EOF

# Apply canary deployment
kubectl apply -f deployment-${CANARY_SUFFIX}.yaml

# Wait for canary deployment to be ready
echo "⏳ Waiting for canary deployment to be ready..."
if ! kubectl rollout status deployment/$CANARY_DEPLOYMENT --timeout=600s; then
    echo "❌ Canary deployment failed to become ready"
    kubectl describe deployment $CANARY_DEPLOYMENT
    kubectl get events --sort-by=.metadata.creationTimestamp
    exit 1
fi

# Create canary service for testing
CANARY_SERVICE="${CANARY_DEPLOYMENT}-service"
echo "🌐 Creating canary service: $CANARY_SERVICE"
cat > service-${CANARY_SUFFIX}.yaml << EOF
apiVersion: v1
kind: Service
metadata:
  name: $CANARY_SERVICE
  namespace: $GKE_NAMESPACE
  labels:
    app: pixelated
    deployment-strategy: canary
    deployment-tier: canary
spec:
  selector:
    app: pixelated
    deployment-tier: canary
  ports:
  - name: http
    port: 80
    targetPort: 4321
    protocol: TCP
  type: ClusterIP
EOF

kubectl apply -f service-${CANARY_SUFFIX}.yaml

# Test canary deployment
echo "🧪 Testing canary deployment..."
CANARY_SERVICE_IP=$(kubectl get service $CANARY_SERVICE -o json | jq -r '.spec.clusterIP')

# Wait for service to have endpoints
sleep 10

# Run health check on canary
if kubectl run health-check-${CANARY_SUFFIX} --image=curlimages/curl:latest --rm -i --restart=Never -- \
   curl -f --connect-timeout 10 --max-time 30 "http://$CANARY_SERVICE_IP:80/api/health" >/dev/null 2>&1; then
    echo "✅ Canary deployment health check passed"
    
    # Additional validation
    echo "🔍 Running additional canary validation..."
    if . ./scripts/validate-deployment.sh $CANARY_DEPLOYMENT; then
        echo "✅ Canary deployment validation completed"
        
        # Update main service to split traffic
        echo "🔄 Updating main service for canary traffic splitting..."
        
        # Create ingress or update service for traffic splitting
        if [ "$STABLE_EXISTS" = "true" ]; then
            # Update existing service to include both deployments
            kubectl patch service $GKE_SERVICE_NAME -p "{\"spec\":{\"selector\":{\"app\":\"pixelated\"}}}"
            
            # Create canary ingress for weighted routing (if ingress controller available)
            if kubectl get ingressclass >/dev/null 2>&1; then
                echo "🌐 Creating canary ingress for weighted traffic splitting..."
                . ./scripts/create-canary-ingress.sh
            fi
        else
            # First deployment, just use canary
            kubectl patch service $GKE_SERVICE_NAME -p "{\"spec\":{\"selector\":{\"deployment-tier\":\"canary\"}}}"
        fi
        
        echo "✅ Canary deployment completed successfully"
        echo "📊 Traffic distribution: $CANARY_PERCENTAGE% canary, $((100 - CANARY_PERCENTAGE))% stable"
        
        return 0
    else
        echo "❌ Canary deployment validation failed"
        exit 1
    fi
else
    echo "❌ Canary deployment health check failed"
    kubectl describe pods -l deployment-tier=canary
    kubectl logs -l deployment-tier=canary --tail=50
    exit 1
fi