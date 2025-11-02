#!/bin/bash
set -euo pipefail

echo "🚀 Executing blue-green deployment strategy..."

# Configuration
BLUE_GREEN_SUFFIX=${BLUE_GREEN_SUFFIX:-green}
BLUE_DEPLOYMENT="${GKE_DEPLOYMENT_NAME}-blue"
GREEN_DEPLOYMENT="${GKE_DEPLOYMENT_NAME}-${BLUE_GREEN_SUFFIX}"

# Determine current active deployment
echo "🔍 Determining current active deployment..."
if kubectl get deployment $BLUE_DEPLOYMENT >/dev/null 2>&1; then
    CURRENT_ACTIVE=$BLUE_DEPLOYMENT
    NEW_DEPLOYMENT=$GREEN_DEPLOYMENT
    echo "📋 Current active: Blue ($BLUE_DEPLOYMENT)"
    echo "🎯 New deployment: Green ($GREEN_DEPLOYMENT)"
else
    CURRENT_ACTIVE=$GREEN_DEPLOYMENT
    NEW_DEPLOYMENT=$BLUE_DEPLOYMENT
    echo "📋 Current active: Green ($GREEN_DEPLOYMENT)"
    echo "🎯 New deployment: Blue ($BLUE_DEPLOYMENT)"
fi

# Create new deployment (inactive initially)
echo "📋 Creating new deployment: $NEW_DEPLOYMENT"
cat > deployment-${BLUE_GREEN_SUFFIX}.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $NEW_DEPLOYMENT
  namespace: $GKE_NAMESPACE
  labels:
    app: pixelated
    version: $CI_COMMIT_SHORT_SHA
    deployment-strategy: blue-green
    deployment-color: ${BLUE_GREEN_SUFFIX}
spec:
  replicas: $REPLICAS
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: pixelated
      deployment-color: ${BLUE_GREEN_SUFFIX}
  template:
    metadata:
      labels:
        app: pixelated
        version: $CI_COMMIT_SHORT_SHA
        deployment-color: ${BLUE_GREEN_SUFFIX}
        deployment-timestamp: "$(date -u +%Y%m%d%H%M%S)"
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "4321"
        prometheus.io/path: "/metrics"
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
          value: "blue-green"
        - name: DEPLOYMENT_COLOR
          value: "${BLUE_GREEN_SUFFIX}"
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

# Apply the new deployment
kubectl apply -f deployment-${BLUE_GREEN_SUFFIX}.yaml

# Wait for new deployment to be ready
echo "⏳ Waiting for new deployment to be ready..."
if ! kubectl rollout status deployment/$NEW_DEPLOYMENT --timeout=600s; then
    echo "❌ New deployment failed to become ready"
    kubectl describe deployment $NEW_DEPLOYMENT
    kubectl get events --sort-by=.metadata.creationTimestamp
    exit 1
fi

# Create temporary service for testing
TEST_SERVICE="${NEW_DEPLOYMENT}-test"
echo "🌐 Creating test service: $TEST_SERVICE"
cat > service-${BLUE_GREEN_SUFFIX}-test.yaml << EOF
apiVersion: v1
kind: Service
metadata:
  name: $TEST_SERVICE
  namespace: $GKE_NAMESPACE
  labels:
    app: pixelated
    deployment-strategy: blue-green
    deployment-color: ${BLUE_GREEN_SUFFIX}-test
spec:
  selector:
    app: pixelated
    deployment-color: ${BLUE_GREEN_SUFFIX}
  ports:
  - name: http
    port: 80
    targetPort: 4321
    protocol: TCP
  type: ClusterIP
EOF

kubectl apply -f service-${BLUE_GREEN_SUFFIX}-test.yaml

# Test new deployment
echo "🧪 Testing new deployment..."
TEST_SERVICE_IP=$(kubectl get service $TEST_SERVICE -o json | jq -r '.spec.clusterIP')

# Wait for service to have endpoints
sleep 10

# Run health check on new deployment
if kubectl run health-check-${BLUE_GREEN_SUFFIX} --image=curlimages/curl:latest --rm -i --restart=Never -- \
   curl -f --connect-timeout 10 --max-time 30 "http://$TEST_SERVICE_IP:80/api/health" >/dev/null 2>&1; then
    echo "✅ New deployment health check passed"
    
    # Additional validation
    echo "🔍 Running additional validation..."
    if . ./scripts/validate-deployment.sh $NEW_DEPLOYMENT; then
        echo "✅ New deployment validation completed"
        
        # Switch traffic (update main service selector)
        echo "🔄 Switching traffic to new deployment..."
        kubectl patch service $GKE_SERVICE_NAME -p "{\"spec\":{\"selector\":{\"deployment-color\":\"${BLUE_GREEN_SUFFIX}\"}}}"
        
        # Wait for traffic switch
        sleep 15
        
        # Verify traffic switch
        echo "🔍 Verifying traffic switch..."
        if . ./scripts/verify-traffic-switch.sh; then
            echo "✅ Traffic switch completed successfully"
            
            # Clean up old deployment
            echo "🧹 Cleaning up old deployment..."
            kubectl delete deployment $CURRENT_ACTIVE --ignore-not-found=true
            kubectl delete service $TEST_SERVICE --ignore-not-found=true
            
            echo "✅ Blue-green deployment completed successfully"
            return 0
        else
            echo "❌ Traffic switch verification failed"
            echo "🔄 Rolling back traffic to original deployment..."
            kubectl patch service $GKE_SERVICE_NAME -p "{\"spec\":{\"selector\":{\"deployment-color\":\"${CURRENT_ACTIVE##*-}\"}}}"
            exit 1
        fi
    else
        echo "❌ New deployment validation failed"
        exit 1
    fi
else
    echo "❌ New deployment health check failed"
    kubectl describe pods -l deployment-color=${BLUE_GREEN_SUFFIX}
    kubectl logs -l deployment-color=${BLUE_GREEN_SUFFIX} --tail=50
    exit 1
fi