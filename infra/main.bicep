targetScope = 'resourceGroup'

@description('Environment name (e.g., production, staging, development)')
param environmentName string

@description('Azure region for resource deployment')
param location string = resourceGroup().location

@description('Prefix for resource names')
param resourcePrefix string = 'pixelated'

@description('Current timestamp for resource creation')
param createdDate string = utcNow('yyyy-MM-dd')

// Generate a shorter unique suffix for resources that require global uniqueness
var uniqueSuffix = take(uniqueString(subscription().id, resourceGroup().id), 6)

// Base names for resources (more readable)
var baseName = '${resourcePrefix}-${environmentName}'
var shortBaseName = '${take(resourcePrefix, 8)}${take(environmentName, 4)}${uniqueSuffix}' // For resources with strict length limits

// Tags applied to all resources
var commonTags = {
  Environment: environmentName
  Project: 'PixelatedEmpathy'
  ManagedBy: 'AzureDevOps'
  CreatedDate: createdDate
  'azd-env-name': environmentName
}

// Tag the resource group with azd-env-name
resource resourceGroupTags 'Microsoft.Resources/tags@2021-04-01' = {
  name: 'default'
  properties: {
    tags: {
      'azd-env-name': environmentName
      Environment: environmentName
      Project: 'PixelatedEmpathy'
      ManagedBy: 'AzureDevOps'
      CreatedDate: createdDate
    }
  }
}

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${baseName}-logs'
  location: location
  tags: commonTags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    workspaceCapping: {
      dailyQuotaGb: 1
    }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${baseName}-insights'
  location: location
  kind: 'web'
  tags: commonTags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    DisableIpMasking: false
    DisableLocalAuth: false
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: shortBaseName  // Must be ≤24 chars, no hyphens
  location: location
  tags: commonTags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    accessPolicies: []
    enabledForDeployment: true
    enabledForTemplateDeployment: true
    enableSoftDelete: true
    enablePurgeProtection: true
    softDeleteRetentionInDays: 7
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'  // Changed from Deny to Allow to prevent deployment issues
    }
  }
}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: 'pixeltech'  // Custom name as requested
  location: location
  tags: commonTags
  sku: {
    name: 'Standard'
  }
  properties: {
    adminUserEnabled: true  // Changed to true to match pipeline expectations
    publicNetworkAccess: 'Enabled'
    dataEndpointEnabled: false
  }
}

resource containerAppEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${baseName}-apps-env'
  location: location
  tags: commonTags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
    zoneRedundant: false
  }
}

// Container Apps are created dynamically by the Azure DevOps pipeline
// Each build creates a new Container App with the naming pattern: pixel-{BuildId}
// This allows for:
// - Blue-green deployments
// - Easy rollbacks
// - Isolated testing of each build
// - Automatic cleanup of old deployments
//
// The Container App Environment (pixel-env-{resourceToken}) is shared across all apps
// and is created here as infrastructure.
//
// If you need to create a Container App manually for testing, use:
// az containerapp create \
//   --name "pixel-manual-test" \
//   --resource-group "{resourceGroup}" \
//   --environment "pixel-env-{resourceToken}" \
//   --image "pixelatedcr.azurecr.io/your-image:tag" \
//   --target-port 4321 \
//   --ingress external

// User Identity for Container Apps to pull from ACR
resource userIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${baseName}-identity'
  location: location
  tags: commonTags
}

module acrPullRoleAssignment 'roleAssignment.bicep' = {
  name: 'acrPullRoleAssignment'
  params: {
    containerRegistryName: containerRegistry.name
    userIdentityName: userIdentity.name
  }
}

// Outputs for infrastructure resources
// Note: Container App URLs are dynamic and created by the pipeline
output containerAppEnvironmentId string = containerAppEnv.id
output containerAppEnvironmentName string = containerAppEnv.name
output RESOURCE_GROUP_ID string = resourceGroup().id
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerRegistry.properties.loginServer
output keyVaultName string = keyVault.name
output appInsightsName string = appInsights.name
output logAnalyticsName string = logAnalytics.name
output containerRegistryName string = containerRegistry.name
output userIdentityId string = userIdentity.id
output userIdentityName string = userIdentity.name
output userIdentityClientId string = userIdentity.properties.clientId
