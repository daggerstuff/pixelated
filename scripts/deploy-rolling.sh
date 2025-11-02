#!/bin/bash
set -euo pipefail

echo "🚀 Executing rolling deployment strategy..."

# Create deployment manifest for rolling update
cat > deployment.yaml << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $GKE_DEPLOYMENT_NAME
  namespace: $GKE_NAMESPACE
  labels:
    app: pixelated
    version: $CI_COMMIT_SHORT_SHA
    deployment-strategy: rolling
spec:
  replicas: $REPLICAS
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: $MAX_SURGE
      maxUnavailable: $MAX_UNAVAILABLE
  selector:
    matchLabels:
      app: pixelated
  template:
    metadata:
      labels:
        app: pixelated
        version: $CI_COMMIT_SHORT_SHA
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
          value: "rolling"
        - name: DEPLOYMENT_VERSION
          value: "$CI_COMMIT_SHORT_SHA"
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

# Apply the deployment
echo "📋 Applying rolling deployment configuration..."
kubectl apply -f deployment.yaml

# Create or update service
if ! kubectl get service $GKE_SERVICE_NAME >/dev/null 2>&1; then
  echo "🌐 Creating service..."
  cat > service.yaml << EOF
apiVersion: v1
kind: Service
metadata:
  name: $GKE_SERVICE_NAME
  namespace: $GKE_NAMESPACE
  labels:
    app: pixelated
    deployment-strategy: rolling
spec:
  selector:
    app: pixelated
  ports:
  - name: http
    port: 80
    targetPort: 4321
    protocol: TCP
  type: ClusterIP
EOF
  kubectl apply -f service.yaml
fi

echo "✅ Rolling deployment configuration applied successfully"