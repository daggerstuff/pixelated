# Metoro Exporter Deployment Guide

This document describes how to deploy and maintain the Metoro exporter in your GKE cluster.

## Overview

The Metoro exporter is a monitoring solution that collects telemetry data from your Kubernetes cluster and sends it to the Metoro platform for analysis and visualization.

## Deployment Process

The deployment was performed using the following steps:

1. Created a deployment script at `scripts/deploy-metoro-exporter.sh`
2. Added the Metoro Helm repository
3. Deployed the Metoro exporter using Helm in the `metoro` namespace
4. Fixed network connectivity issues between the exporter and Redis

## Network Policy Fix

Initially, the Metoro exporter pods were unable to connect to the Redis service due to restrictive network policies. The issue was resolved by:

1. Deleting the default restrictive network policy
2. Creating a new network policy that allows connections from Metoro exporter pods to Redis

The network policy is defined in `k8s/metoro-redis-network-policy.yaml` and allows ingress traffic from pods with the label `app.kubernetes.io/name: metoro-exporter` to pods with the label `app.kubernetes.io/name: redis` on port 6379.

## Verification

To verify that the deployment is working correctly, you can check:

1. Pod status:
   ```bash
   kubectl get pods -n metoro
   ```

2. Logs from the exporter pods:
   ```bash
   kubectl logs -n metoro -l app.kubernetes.io/name=metoro-exporter
   ```

3. Services:
   ```bash
   kubectl get services -n metoro
   ```

## Maintenance

To redeploy or update the Metoro exporter:

1. Run the deployment script:
   ```bash
   ./scripts/deploy-metoro-exporter.sh
   ```

2. Or manually upgrade using Helm:
   ```bash
   helm upgrade --install --namespace metoro metoro-exporter metoro-exporter/metoro-exporter \
     --set exporter.secret.bearerToken=<your-bearer-token>
   ```

## Troubleshooting

If you encounter connectivity issues:

1. Check the network policy:
   ```bash
   kubectl get networkpolicy -n metoro
   ```

2. Verify pod labels:
   ```bash
   kubectl get pods -n metoro --show-labels
   ```

3. Check Redis connectivity:
   ```bash
   kubectl exec -it <metoro-exporter-pod> -n metoro -- nc -zv metoro-redis-master.metoro.svc.cluster.local 6379
   ```

## Security Considerations

The bearer token is currently hardcoded in the deployment script. For production use, consider:

1. Using Kubernetes secrets to store sensitive information
2. Implementing a secret management solution like HashiCorp Vault or Google Secret Manager
3. Regularly rotating the bearer token

## Future Improvements

Consider implementing:

1. Automated deployment using CI/CD pipelines
2. Monitoring and alerting for the Metoro exporter itself
3. Resource quotas and limits for the metoro namespace
4. Backup and disaster recovery procedures for the Redis data