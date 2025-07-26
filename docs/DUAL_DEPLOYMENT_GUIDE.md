# Dual Deployment Guide: Azure & Vercel

This guide explains how to use the optimized dual deployment setup for both Azure and Vercel platforms with the same codebase.

## 🏗️ Architecture Overview

The repository is configured for optimal deployment to both platforms:

- **Azure**: Server-side rendering with Docker containers on Azure App Service
- **Vercel**: Hybrid static/serverless deployment with edge optimization

## 📁 Configuration Files

### Platform-Specific Configurations

| File | Purpose | Platform |
|------|---------|----------|
| `astro.config.azure.mjs` | Azure-optimized Astro configuration | Azure |
| `astro.config.vercel.mjs` | Vercel-optimized Astro configuration | Vercel |
| `vercel.json` | Vercel deployment configuration | Vercel |
| `Dockerfile.azure` | Docker configuration for Azure | Azure |
| `azure-pipelines.yml` | Azure DevOps CI/CD pipeline | Azure |
| `.github/workflows/vercel-deployment.yml` | GitHub Actions for Vercel | Vercel |

### Key Differences

#### Azure Configuration
- **Output**: Server-side rendering (`output: 'server'`)
- **Adapter**: Node.js standalone adapter
- **Build**: Optimized for Docker containers
- **Concurrency**: Conservative (2 threads)
- **Minification**: Terser for better compression

#### Vercel Configuration
- **Output**: Hybrid mode (`output: 'hybrid'`)
- **Adapter**: Vercel serverless adapter
- **Build**: Optimized for edge functions
- **Concurrency**: Higher (4 threads)
- **Minification**: ESBuild for faster builds

## 🚀 Quick Start

### 1. Validate Configuration

```bash
# Check all configurations
bash scripts/deployment-manager.sh validate
```

### 2. Build for Specific Platform

```bash
# Build for Azure
pnpm run build:azure

# Build for Vercel
pnpm run build:vercel

# Build for both platforms
bash scripts/deployment-manager.sh build both
```

### 3. Deploy

```bash
# Deploy to Azure
pnpm run deploy:azure

# Deploy to Vercel
pnpm run deploy:vercel

# Deploy to both platforms
bash scripts/deployment-manager.sh deploy both
```

## 🔧 Environment Setup

### Azure Environment Variables

Required for Azure deployment:

```bash
# Azure Resource Configuration
AZURE_RESOURCE_GROUP=your-resource-group
AZURE_APP_SERVICE_NAME=your-app-service
AZURE_CONTAINER_REGISTRY=your-registry

# Azure Services
AZURE_OPENAI_API_KEY=your-openai-key
AZURE_OPENAI_ENDPOINT=your-openai-endpoint
AZURE_STORAGE_CONNECTION_STRING=your-storage-connection

# Authentication
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id
```

### Vercel Environment Variables

Required for Vercel deployment:

```bash
# Vercel Configuration
VERCEL_TOKEN=your-vercel-token
VERCEL_ORG_ID=your-org-id
VERCEL_PROJECT_ID=your-project-id

# Application
PUBLIC_SITE_URL=https://your-domain.com
VERCEL_ENV=production
```

## 📋 Available Scripts

### Build Scripts

```bash
# Standard build (uses default astro.config.mjs)
pnpm build

# Platform-specific builds
pnpm run build:azure    # Uses astro.config.azure.mjs
pnpm run build:vercel   # Uses astro.config.vercel.mjs
```

### Deployment Scripts

```bash
# Platform-specific deployments
pnpm run deploy:azure         # Deploy to Azure
pnpm run deploy:vercel        # Deploy to Vercel (preview)
pnpm run deploy:vercel:prod   # Deploy to Vercel (production)
```

### Management Scripts

```bash
# Deployment manager
bash scripts/deployment-manager.sh validate  # Validate configurations
bash scripts/deployment-manager.sh status    # Check deployment status
bash scripts/deployment-manager.sh clean     # Clean build artifacts
bash scripts/deployment-manager.sh switch azure   # Switch to Azure config
bash scripts/deployment-manager.sh switch vercel  # Switch to Vercel config
```

## 🔄 CI/CD Pipelines

### Azure DevOps Pipeline

**File**: `azure-pipelines.yml`

**Triggers**:
- Push to `master` or `develop` branches
- Changes to Azure-related files

**Stages**:
1. **Validation**: Validate Azure configuration
2. **Build**: Build with Azure configuration
3. **Docker Build**: Create and push Docker image
4. **Infrastructure**: Deploy Azure infrastructure
5. **Deploy**: Deploy to Azure App Service
6. **Tests**: Post-deployment health checks

### GitHub Actions (Vercel)

**File**: `.github/workflows/vercel-deployment.yml`

**Triggers**:
- Push to `master` or `develop` branches
- Pull requests
- Manual workflow dispatch

**Jobs**:
1. **Build**: Build with Vercel configuration
2. **Deploy**: Deploy to Vercel
3. **Tests**: Post-deployment validation

## 🛠️ Troubleshooting

### Common Issues

#### Build Failures

```bash
# Check configuration
bash scripts/deployment-manager.sh validate

# Clean and rebuild
bash scripts/deployment-manager.sh clean
pnpm run build:azure  # or build:vercel
```

#### Azure Deployment Issues

```bash
# Check Azure CLI
az --version

# Verify resource group
az group show --name $AZURE_RESOURCE_GROUP

# Check app service
az webapp show --name $AZURE_APP_SERVICE_NAME --resource-group $AZURE_RESOURCE_GROUP
```

#### Vercel Deployment Issues

```bash
# Check Vercel CLI
vercel --version

# Login to Vercel
vercel login

# Check project configuration
vercel ls
```

### Health Checks

Both platforms include health check endpoints:

```bash
# Check Azure deployment
curl https://your-azure-app.azurewebsites.net/api/health/simple

# Check Vercel deployment
curl https://your-vercel-app.vercel.app/api/health/simple
```

## 📊 Performance Optimization

### Azure Optimizations

- **Docker multi-stage builds** for smaller images
- **Terser minification** for better compression
- **Server-side rendering** for dynamic content
- **Azure CDN integration** for static assets

### Vercel Optimizations

- **Hybrid rendering** for optimal performance
- **Edge functions** for global distribution
- **ESBuild minification** for faster builds
- **Automatic code splitting** for smaller bundles

## 🔐 Security Considerations

### Azure Security

- Container registry authentication
- App Service managed identity
- Key Vault integration for secrets
- Network security groups

### Vercel Security

- Environment variable encryption
- Edge middleware for security headers
- Automatic HTTPS
- DDoS protection

## 📈 Monitoring

### Azure Monitoring

- Application Insights integration
- Log Analytics workspace
- Health check endpoints
- Performance counters

### Vercel Monitoring

- Built-in analytics
- Speed Insights
- Function logs
- Error tracking

## 🤝 Contributing

When contributing to the dual deployment setup:

1. Test changes on both platforms
2. Update relevant configuration files
3. Validate with the deployment manager
4. Update documentation if needed

```bash
# Before submitting PR
bash scripts/deployment-manager.sh validate
bash scripts/deployment-manager.sh build both
```

## 📚 Additional Resources

- [Azure App Service Documentation](https://docs.microsoft.com/en-us/azure/app-service/)
- [Vercel Documentation](https://vercel.com/docs)
- [Astro Documentation](https://docs.astro.build/)
- [Docker Documentation](https://docs.docker.com/)

---

For questions or issues with the dual deployment setup, please check the troubleshooting section or create an issue in the repository.
