param azureLocation string = resourceGroup().location
param environment string = 'production'
param containerRegistryName string = 'pixelatedbox'
param appServiceName string = 'pixelated'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: containerRegistryName
  location: azureLocation
  sku: {
    name: 'Standard'
  }
  properties: {
    adminUserEnabled: true
    publicNetworkAccess: 'Enabled'
  }
}

// App Service Plan (Linux) - Using Consumption tier (serverless, no VM quota)
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${appServiceName}-plan'
  location: azureLocation
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
    size: 'Y1'
    family: 'Y'
    capacity: 0
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

// Key Vault (for secrets; RBAC must be granted separately)
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${appServiceName}-kv'
  location: azureLocation
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    publicNetworkAccess: 'Disabled'
    enablePurgeProtection: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Deny'
    }
  }
}



resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: appServiceName
  location: azureLocation
  kind: 'app,linux,container'
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    clientCertEnabled: true
    publicNetworkAccess: 'Disabled'
    siteConfig: {
      minTlsVersion: '1.2'
      http20Enabled: true
      appSettings: [
        {
          name: 'NODE_ENV'
          value: environment
        }
        {
          name: 'PORT'
          value: '3000'
        }
        {
          name: 'WEBSITES_PORT'
          value: '3000'
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${acr.properties.loginServer}'
        }
      ]
      linuxFxVersion: 'DOCKER|${acr.properties.loginServer}/pixelated:latest'
      healthCheckPath: '/api/health'
      ftpsState: 'Disabled'
      acrUseManagedIdentityCreds: true
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

// Role assignments for ACR access
resource acrPullRoleDefinition 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  scope: subscription()
  name: '7f951dda-4ed3-4680-a7ca-43fe172d538d' // AcrPull role
}

resource appServiceAcrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: acr
  name: guid(acr.id, appService.id, acrPullRoleDefinition.id)
  properties: {
    roleDefinitionId: acrPullRoleDefinition.id
    principalId: appService.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output containerRegistryEndpoint string = acr.properties.loginServer
output appServiceDefaultHostName string = appService.properties.defaultHostName
output appServiceName string = appService.name
output containerRegistryName string = acr.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = acr.properties.loginServer
output keyVaultName string = keyVault.name
