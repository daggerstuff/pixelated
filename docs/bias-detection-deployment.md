# Bias Detection Engine Deployment & Configuration Guide

## Overview

This guide covers deploying the Bias Detection Engine in local, staging, and production environments, including configuration, health checks, and scaling.

---

## 1. Local Development Deployment

### Manual Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/pixelated-empathy/bias-detection-engine.git
   cd bias-detection-engine
   ```

2. **Install dependencies:**
   ```bash
   pnpm install --no-frozen-lockfile
   ```

3. **Set up environment variables:**
   ```bash
   cp env.example .env.local
   # Edit .env.local as needed
   ```

4. **Start the Python backend:**
   ```bash
   cd src/lib/ai/bias-detection/python-service
   pip install -r requirements.txt
   python bias_detection_service.py
   ```

5. **Start the development server:**
   ```bash
   pnpm dev
   ```

### Docker Compose (Recommended)

1. **Build and start all services:**
   ```bash
   docker-compose up --build
   ```
   - Includes Node.js app, Python backend, Redis, and database (if configured).

---

## 2. Staging & Production Deployment

### Docker

1. **Build the Docker image:**
   ```bash
   docker build -t bias-detection-engine:latest .
   ```

2. **Run the container:**
   ```bash
   docker run --env-file .env.production -p 3000:3000 bias-detection-engine:latest
   ```

3. **Deploy Python backend as a separate service/container.**

### Kubernetes

- Use provided manifests in `kubernetes/` or Helm charts.
- Set environment variables/secrets using ConfigMaps and Secrets.
- Expose services via Ingress or LoadBalancer.

### CI/CD Pipeline

- Configure environment variables/secrets in your CI/CD system (e.g., GitHub Actions, Forgejo, Azure DevOps).
- Use pipeline scripts to build, test, and deploy to staging/production.
- See [CI/CD Guide](./ci-cd/ENTERPRISE_PIPELINE_SYSTEM.md).

---

## 3. Environment Configuration

- **Local:** `.env.local`
- **Staging:** `.env.staging` or CI/CD secrets
- **Production:** `.env.production` or CI/CD secrets

See [Environment Setup](./environment-setup.md) for variable details.

---

## 4. Health Checks & Monitoring

- **Health endpoint:**  
  `GET /api/bias-detection/health`
- **Monitoring:**  
  Integrate with Prometheus, Grafana, or your preferred monitoring stack.
- **Alerts:**  
  Set up alerts for error rates, latency, and resource usage.

---

## 5. Scaling & High Availability

- Use Docker Compose or Kubernetes for multi-service orchestration.
- Enable Redis caching for performance.
- Use horizontal pod autoscaling in Kubernetes for high load.
- Ensure database and backend services are highly available.

---

## References

- [Developer Setup Guide](./bias-detection-engine-setup.md)
- [Performance Benchmarks](./bias-detection-performance.md)
- [Environment Setup](./environment-setup.md)
- [CI/CD Pipeline Guide](./ci-cd/ENTERPRISE_PIPELINE_SYSTEM.md)
- [General Deployment Guide](../src/content/docs/deployment.md)
- [Kubernetes Manifests](../kubernetes/)
